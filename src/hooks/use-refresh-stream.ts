"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createParser, type EventSourceMessage } from "eventsource-parser";

// Types for refresh job data
export type RefreshJobStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "cancelled";

export interface RefreshJob {
  job_id: string;
  scope: string;
  status: RefreshJobStatus;
  connector_id?: string;
  connector_type?: string;
  attempts: number;
  max_attempts: number;
  entities_updated: number;
  last_error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
}

export interface RefreshStatusSummary {
  has_running: boolean;
  running_count: number;
  running_jobs: RefreshJob[];
  recent_completed: RefreshJob[];
  grouped: {
    metabase: RefreshJob[];
    dbt: RefreshJob[];
    warehouse: RefreshJob[];
    other: RefreshJob[];
  };
  timestamp: string;
}

export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface UseRefreshStreamOptions {
  connectorId?: string;
  connectorType?: string;
  baseUrl?: string;
  onMessage?: (data: RefreshJob | RefreshStatusSummary) => void;
  onJobUpdate?: (job: RefreshJob) => void;
  onStatusSummary?: (summary: RefreshStatusSummary) => void;
  onError?: (error: Error) => void;
  onConnectionChange?: (state: ConnectionState) => void;
  /** Called when the SSE stream returns 401 (session expired). */
  onSessionExpired?: () => void;
}

export interface UseRefreshStreamReturn {
  jobs: RefreshJob[];
  summary: RefreshStatusSummary | null;
  connectionState: ConnectionState;
  error: Error | null;
  reconnectAttempts: number;
  reconnect: () => void;
  disconnect: () => void;
}

// SSE event types
interface JobUpdateEvent {
  event: "job_update";
  data: RefreshJob;
}

interface StatusSummaryEvent {
  event: "status_summary";
  data: RefreshStatusSummary;
}

interface ErrorEvent {
  event: "error";
  data: { error: string; details?: string };
}

type SSEEvent = JobUpdateEvent | StatusSummaryEvent | ErrorEvent;

// Reconnection constants
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 10;

export function useRefreshStream(
  options: UseRefreshStreamOptions = {}
): UseRefreshStreamReturn {
  const {
    connectorId,
    connectorType,
    baseUrl = typeof window !== "undefined"
      ? window.location.origin.replace(/:\d+$/, ":8000") // Default to API port
      : "http://localhost:8000",
    onMessage,
    onJobUpdate,
    onStatusSummary,
    onError,
    onConnectionChange,
    onSessionExpired,
  } = options;

  // State
  const [jobs, setJobs] = useState<RefreshJob[]>([]);
  const [summary, setSummary] = useState<RefreshStatusSummary | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnect = useRef(false);

  // Get SSE URL with optional filters
  const getSseUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (connectorId) params.append("connector_id", connectorId);
    if (connectorType) params.append("connector_type", connectorType);

    const queryString = params.toString();
    return `${baseUrl}/connectors/jobs/stream${queryString ? `?${queryString}` : ""}`;
  }, [baseUrl, connectorId, connectorType]);

  // Calculate reconnect delay with exponential backoff
  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
      MAX_RECONNECT_DELAY
    );
    return delay;
  }, [reconnectAttempts]);

  // Update connection state with callback
  const updateConnectionState = useCallback(
    (state: ConnectionState) => {
      setConnectionState(state);
      onConnectionChange?.(state);
    },
    [onConnectionChange]
  );

  // Handle a parsed SSE event
  const handleSSEEvent = useCallback(
    (event: EventSourceMessage) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;

        switch (data.event) {
          case "job_update": {
            const jobUpdate = data as JobUpdateEvent;
            setJobs((prev) => {
              const existingIndex = prev.findIndex(
                (j) => j.job_id === jobUpdate.data.job_id
              );
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = jobUpdate.data;
                return updated;
              }
              return [jobUpdate.data, ...prev];
            });
            onJobUpdate?.(jobUpdate.data);
            onMessage?.(jobUpdate.data);
            break;
          }

          case "status_summary": {
            const summaryEvent = data as StatusSummaryEvent;
            setSummary(summaryEvent.data);
            onStatusSummary?.(summaryEvent.data);
            onMessage?.(summaryEvent.data);
            break;
          }

          case "error": {
            const errorEvent = data as ErrorEvent;
            const err = new Error(
              errorEvent.data.error || "Unknown SSE error"
            );
            setError(err);
            onError?.(err);
            break;
          }
        }
      } catch (e) {
        console.error("Failed to parse SSE message:", e);
      }
    },
    [onMessage, onJobUpdate, onStatusSummary, onError]
  );

  // Disconnect and cleanup
  const disconnect = useCallback(() => {
    isManualDisconnect.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    updateConnectionState("disconnected");
    setReconnectAttempts(0);
  }, [updateConnectionState]);

  // Connect to SSE endpoint using fetch (not EventSource -- enables credentials: "include")
  const connect = useCallback(() => {
    // Don't reconnect if manually disconnected
    if (isManualDisconnect.current) return;

    // Abort existing connection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    updateConnectionState("connecting");
    setError(null);

    const url = getSseUrl();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    (async () => {
      try {
        const response = await fetch(url, {
          credentials: "include",
          headers: { Accept: "text/event-stream" },
          signal: controller.signal,
        });

        // Handle 401 -- session expired
        if (response.status === 401) {
          onSessionExpired?.();
          updateConnectionState("error");
          return;
        }

        if (!response.ok || !response.body) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        updateConnectionState("connected");
        setReconnectAttempts(0);

        const parser = createParser({
          onEvent(event: EventSourceMessage) {
            handleSSEEvent(event);
          },
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.feed(decoder.decode(value, { stream: true }));
        }

        // Stream ended naturally -- attempt reconnect
        if (!isManualDisconnect.current) {
          throw new Error("SSE stream ended");
        }
      } catch (e) {
        // Ignore abort errors (expected on disconnect/reconnect)
        if (e instanceof DOMException && e.name === "AbortError") return;

        if (!isManualDisconnect.current) {
          console.error("SSE connection error:", e);

          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            updateConnectionState("disconnected");
            const delay = getReconnectDelay();

            reconnectTimeoutRef.current = setTimeout(() => {
              setReconnectAttempts((prev) => prev + 1);
              connect();
            }, delay);
          } else {
            updateConnectionState("error");
            const err = new Error(
              `Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached`
            );
            setError(err);
            onError?.(err);
          }
        }
      }
    })();
  }, [
    getSseUrl,
    reconnectAttempts,
    getReconnectDelay,
    updateConnectionState,
    handleSSEEvent,
    onError,
    onSessionExpired,
  ]);

  // Manual reconnect -- inline cleanup instead of calling disconnect()
  // because disconnect() sets isManualDisconnect=true which blocks connect()
  const reconnect = useCallback(() => {
    // Clean up existing connection without setting isManualDisconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    isManualDisconnect.current = false;
    setReconnectAttempts(0);
    setError(null);
    connect();
  }, [connect]);

  // Auto-connect on mount
  useEffect(() => {
    isManualDisconnect.current = false;
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Reconnect when connector filter changes
  useEffect(() => {
    if (connectionState === "connected") {
      reconnect();
    }
  }, [connectorId, connectorType]);

  return {
    jobs,
    summary,
    connectionState,
    error,
    reconnectAttempts,
    reconnect,
    disconnect,
  };
}

export default useRefreshStream;
