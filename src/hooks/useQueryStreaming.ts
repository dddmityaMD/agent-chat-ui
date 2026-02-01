"use client";

import { useState, useCallback, useEffect, useRef } from "react";

// Types for query streaming
export interface EvidenceItem {
  id: string;
  entity_type: string;
  [key: string]: unknown;
}

export interface ClarificationOption {
  id: string;
  label: string;
  preview: string;
  confidence?: number;
}

export type QueryStatus =
  | "idle"
  | "connecting"
  | "translating"
  | "collecting"
  | "synthesizing"
  | "clarifying"
  | "complete"
  | "error";

export interface QueryResult {
  answer?: string;
  evidence: EvidenceItem[];
  confidence?: number;
}

export interface UseQueryStreamingOptions {
  threadId?: string;
  baseUrl?: string;
  onEvidenceUpdate?: (evidence: EvidenceItem[]) => void;
  onClarificationNeeded?: (options: ClarificationOption[]) => void;
  onComplete?: (result: QueryResult) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: QueryStatus) => void;
}

export interface UseQueryStreamingReturn {
  submitQuery: (query: string) => void;
  submitClarification: (optionId: string) => void;
  cancelQuery: () => void;
  isStreaming: boolean;
  status: QueryStatus;
  evidence: EvidenceItem[];
  answer?: string;
  progress: number;
  error?: Error;
  clarificationOptions?: ClarificationOption[];
}

// WebSocket message types
interface WSMessage {
  type: "status" | "evidence" | "clarification" | "answer" | "error" | "progress";
  payload: unknown;
}

interface StatusMessage {
  type: "status";
  status: QueryStatus;
  message?: string;
}

interface EvidenceMessage {
  type: "evidence";
  items: EvidenceItem[];
  batchIndex?: number;
  totalBatches?: number;
}

interface ClarificationMessage {
  type: "clarification";
  options: ClarificationOption[];
  originalQuery: string;
}

interface AnswerMessage {
  type: "answer";
  answer: string;
  confidence?: number;
  evidenceCount: number;
}

interface ErrorMessage {
  type: "error";
  error: string;
  code?: string;
}

interface ProgressMessage {
  type: "progress";
  progress: number; // 0-100
  stage: string;
}

export function useQueryStreaming(
  options: UseQueryStreamingOptions = {}
): UseQueryStreamingReturn {
  const {
    threadId: initialThreadId,
    baseUrl = typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000",
    onEvidenceUpdate,
    onClarificationNeeded,
    onComplete,
    onError,
    onStatusChange,
  } = options;

  // State
  const [status, setStatus] = useState<QueryStatus>("idle");
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [answer, setAnswer] = useState<string | undefined>();
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<Error | undefined>();
  const [clarificationOptions, setClarificationOptions] = useState<
    ClarificationOption[] | undefined
  >();
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const evidenceAccumulatorRef = useRef<EvidenceItem[]>([]);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;

  const isStreaming = status !== "idle" && status !== "complete" && status !== "error";

  // Update status with callback
  const updateStatus = useCallback(
    (newStatus: QueryStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  // Reset state for new query
  const resetState = useCallback(() => {
    setEvidence([]);
    setAnswer(undefined);
    setProgress(0);
    setError(undefined);
    setClarificationOptions(undefined);
    evidenceAccumulatorRef.current = [];
    reconnectAttemptsRef.current = 0;
  }, []);

  // Close WebSocket connection
  const closeConnection = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Handle WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as WSMessage;

        switch (message.type) {
          case "status": {
            const statusMsg = message as StatusMessage;
            updateStatus(statusMsg.status);
            break;
          }

          case "progress": {
            const progressMsg = message as ProgressMessage;
            setProgress(progressMsg.progress);
            break;
          }

          case "evidence": {
            const evidenceMsg = message as EvidenceMessage;
            const newItems = evidenceMsg.items || [];

            // Accumulate evidence
            evidenceAccumulatorRef.current = [
              ...evidenceAccumulatorRef.current,
              ...newItems,
            ];

            // Update state
            setEvidence(evidenceAccumulatorRef.current);
            onEvidenceUpdate?.(evidenceAccumulatorRef.current);

            // Update progress based on batches
            if (
              evidenceMsg.totalBatches &&
              evidenceMsg.batchIndex !== undefined
            ) {
              const batchProgress =
                (evidenceMsg.batchIndex / evidenceMsg.totalBatches) * 100;
              setProgress(Math.max(progress, batchProgress));
            }
            break;
          }

          case "clarification": {
            const clarificationMsg = message as ClarificationMessage;
            setClarificationOptions(clarificationMsg.options);
            updateStatus("clarifying");
            onClarificationNeeded?.(clarificationMsg.options);
            break;
          }

          case "answer": {
            const answerMsg = message as AnswerMessage;
            setAnswer(answerMsg.answer);
            updateStatus("complete");
            onComplete?.({
              answer: answerMsg.answer,
              evidence: evidenceAccumulatorRef.current,
              confidence: answerMsg.confidence,
            });
            closeConnection();
            break;
          }

          case "error": {
            const errorMsg = message as ErrorMessage;
            const err = new Error(errorMsg.error);
            setError(err);
            updateStatus("error");
            onError?.(err);
            closeConnection();
            break;
          }
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    },
    [updateStatus, onEvidenceUpdate, onClarificationNeeded, onComplete, onError, closeConnection, progress]
  );

  // Connect WebSocket
  const connectWebSocket = useCallback(
    (tid: string, query?: string) => {
      // Close existing connection
      closeConnection();

      // Reset state
      resetState();

      // Create WebSocket connection
      const wsUrl = `${baseUrl.replace(/^http/, "ws")}/ws/query/${tid}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        updateStatus("connecting");

        // Send initial query if provided
        if (query) {
          ws.send(
            JSON.stringify({
              type: "query",
              query,
            })
          );
        }
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        const err = new Error("WebSocket connection failed");
        setError(err);
        updateStatus("error");
        onError?.(err);
      };

      ws.onclose = () => {
        // Attempt reconnection if not complete and attempts remaining
        if (
          status !== "complete" &&
          status !== "error" &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          reconnectAttemptsRef.current++;
          setTimeout(() => {
            connectWebSocket(tid);
          }, 1000 * reconnectAttemptsRef.current);
        }
      };

      wsRef.current = ws;
    },
    [baseUrl, handleMessage, onError, resetState, closeConnection, status, updateStatus]
  );

  // Submit query
  const submitQuery = useCallback(
    (query: string) => {
      // Generate thread ID if not provided
      const tid = threadId || `thread_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      setThreadId(tid);

      connectWebSocket(tid, query);
    },
    [threadId, connectWebSocket]
  );

  // Submit clarification
  const submitClarification = useCallback(
    (optionId: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "clarification",
            optionId,
          })
        );
        setClarificationOptions(undefined);
        updateStatus("translating");
      }
    },
    [updateStatus]
  );

  // Cancel query
  const cancelQuery = useCallback(() => {
    closeConnection();
    updateStatus("idle");
    setProgress(0);
  }, [closeConnection, updateStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeConnection();
    };
  }, [closeConnection]);

  return {
    submitQuery,
    submitClarification,
    cancelQuery,
    isStreaming,
    status,
    evidence,
    answer,
    progress,
    error,
    clarificationOptions,
  };
}

export default useQueryStreaming;
