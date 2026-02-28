/**
 * Custom React hook replacing LangGraph SDK's `useStream`.
 *
 * Simplified for REST-based message architecture (Phase 23.4):
 * - Messages fetched via REST (useMessages hook), NOT from SSE stream
 * - SSE carries only sais_ui updates + "new message available" signals
 * - messagesCache, merge-on-shrink, preStreamIds: DELETED from stream manager
 * - Backward-compatible return shape: messages, saisUi, interrupt, isStreaming, etc.
 *
 * Kept:
 * - Subgraph `values` events processed for sais_ui (not dropped)
 * - sais_ui cache survives stream->idle transitions
 * - Checkpoint-based branching for edit/regenerate
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { Message } from "@langchain/langgraph-sdk";
import {
  uiMessageReducer,
  isUIMessage,
  isRemoveUIMessage,
  type UIMessage,
} from "@langchain/langgraph-sdk/react-ui";
import { SaisStreamManager } from "@/lib/sais-stream/stream-manager";
import { SaisThreadClient } from "@/lib/sais-stream/thread-client";
import { BranchContext, type MessageMetadata } from "@/lib/sais-stream/branch-context";
import { streamRun, joinStream } from "@/lib/sais-stream/sse-client";
import { useMessages } from "@/hooks/useMessages";
import { useActiveRuns } from "@/providers/ActiveRuns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSaisStreamOptions {
  apiUrl: string;
  apiKey?: string;
  assistantId: string;
  threadId: string | null;
  onThreadId?: (id: string) => void;
  onError?: (error: Error) => void;
  onCustomEvent?: (event: unknown, namespace?: string[]) => void;
}

export interface SubmitOptions {
  command?: { resume?: unknown; goto?: unknown };
  checkpoint?: unknown;
  streamMode?: string[];
  streamSubgraphs?: boolean;
  streamResumable?: boolean;
  optimisticValues?: (prev: Record<string, unknown>) => Record<string, unknown>;
}

export interface UseSaisStreamResult {
  // State
  values: Record<string, unknown>;
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  interrupt: unknown;

  // Actions
  submit: (input?: unknown, options?: SubmitOptions) => void;
  stop: () => void;

  // Branching
  getMessagesMetadata: (message: Message, index?: number) => MessageMetadata | undefined;
  setBranch: (branch: string) => void;

  // Backward compat (preStreamIds no longer tracked; always empty)
  preStreamIds: Set<string>;
}

// Custom fetch wrapper that includes credentials (cookie forwarding)
const credentialsFetch: typeof fetch = (input, init) => {
  return fetch(input, { ...init, credentials: "include" });
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSaisStream(options: UseSaisStreamOptions): UseSaisStreamResult {
  const {
    apiUrl,
    assistantId,
    threadId,
    onThreadId,
    onError,
    onCustomEvent,
  } = options;

  // Stable refs for manager + clients (created once, survive re-renders)
  const managerRef = useRef<SaisStreamManager | null>(null);
  const threadClientRef = useRef<SaisThreadClient | null>(null);
  const branchRef = useRef<BranchContext | null>(null);

  if (!managerRef.current) {
    managerRef.current = new SaisStreamManager();
  }
  if (!threadClientRef.current) {
    threadClientRef.current = new SaisThreadClient(apiUrl, credentialsFetch);
  }
  if (!branchRef.current) {
    branchRef.current = new BranchContext();
  }

  const manager = managerRef.current;
  const threadClient = threadClientRef.current;
  const branch = branchRef.current;
  const activeRuns = useActiveRuns();

  // REST-based message fetching (Phase 23.4)
  const { messages, refetch: refetchMessages } = useMessages(threadId, threadClient);

  // Wire SSE onNewMessageSignal to REST refetch
  useEffect(() => {
    manager.onNewMessageSignal = refetchMessages;
    return () => {
      manager.onNewMessageSignal = undefined;
    };
  }, [manager, refetchMessages]);

  // UI messages state (handled via custom event callbacks)
  const uiMessagesRef = useRef<UIMessage[]>([]);

  // Flag: when we create a thread in submit(), the threadId prop will change.
  // Skip the clear+fetch in the threadId effect since submit already handles it.
  const selfCreatedThreadRef = useRef<string | null>(null);

  // Subscribe to manager state changes for React re-renders
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const unsub = manager.subscribe(() => {
      forceUpdate((n) => n + 1);
    });
    return unsub;
  }, [manager]);

  // Wire custom event handler
  useEffect(() => {
    manager.onCustomEvent = (data, namespace) => {
      // Handle UI messages (same as SDK's onCustomEvent)
      if (isUIMessage(data) || isRemoveUIMessage(data)) {
        uiMessagesRef.current = uiMessageReducer(uiMessagesRef.current, data);
      }

      // Forward to consumer
      onCustomEvent?.(data, namespace);
    };
  }, [manager, onCustomEvent]);

  // Forward errors to consumer
  useEffect(() => {
    if (manager.state.error && onError) {
      onError(manager.state.error);
    }
  }, [manager.state.error, onError]);

  // Track threadId changes for state loading
  const prevThreadIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (threadId === prevThreadIdRef.current) return;
    prevThreadIdRef.current = threadId;

    // If this threadId was just created by our own submit(), skip clear+fetch.
    // The submit flow already handles streaming on the new thread.
    if (threadId && selfCreatedThreadRef.current === threadId) {
      selfCreatedThreadRef.current = null;
      return;
    }

    // Clear state on thread switch — including branch context so stale
    // interrupt from the previous thread doesn't leak into the new one.
    manager.clear();
    branch.clear();
    uiMessagesRef.current = [];

    if (!threadId) return;

    // Fetch thread state + history for the new thread (sais_ui + branching)
    // Messages are fetched by useMessages hook separately via REST
    (async () => {
      try {
        const [state, history] = await Promise.all([
          threadClient.getState(threadId),
          threadClient.getHistory(threadId),
        ]);

        manager.setValues(state.values);
        branch.update(history);

        // If this thread has an active run, rejoin the SSE stream
        const active = activeRuns.getActiveRun(threadId);
        if (active) {
          manager.rejoin((signal) =>
            joinStream({
              apiUrl,
              threadId,
              runId: active.runId,
              signal,
              fetchImpl: credentialsFetch,
            }),
          ).then((aborted) => {
            // Only unregister if rejoin completed naturally (not aborted by thread switch)
            if (!aborted) {
              activeRuns.unregisterRun(threadId);
            }
          });
        }
      } catch (err) {
        console.warn("[useSaisStream] Failed to load thread state:", err);
      }
    })();
  }, [threadId, apiUrl, manager, threadClient, branch, activeRuns]);

  // ----- submit -----
  const submit: UseSaisStreamResult["submit"] = useCallback(
    (input?: unknown, submitOptions?: SubmitOptions) => {
      const {
        command,
        checkpoint,
        streamMode,
        streamSubgraphs,
        streamResumable,
        optimisticValues,
      } = submitOptions ?? {};

      const doSubmit = async (tid: string) => {
        // Apply optimistic values
        if (optimisticValues) {
          manager.applyOptimistic(optimisticValues);
        }

        // Start streaming — wrap generator to intercept metadata for run tracking
        const aborted = await manager.start((signal) => {
          const inner = streamRun({
            apiUrl,
            threadId: tid,
            assistantId,
            input,
            command,
            checkpoint,
            streamMode: streamMode ?? ["values", "custom"],
            streamSubgraphs: streamSubgraphs ?? true,
            streamResumable: streamResumable ?? true,
            signal,
            fetchImpl: credentialsFetch,
          });
          return interceptMetadata(inner, (runId) => {
            activeRuns.registerRun(tid, runId);
          });
        });

        // Only unregister if stream completed naturally (not aborted by thread switch).
        // If aborted, the backend run is still active and we need the registration
        // so rejoin() triggers when the user switches back.
        if (!aborted) {
          activeRuns.unregisterRun(tid);
        }

        // After stream ends: re-fetch history for branching metadata
        try {
          const history = await threadClient.getHistory(tid);
          branch.update(history);
        } catch {
          // Non-critical
        }
      };

      if (threadId) {
        doSubmit(threadId);
      } else {
        // Create thread first
        threadClient
          .createThread()
          .then((result) => {
            const newId = result.thread_id;
            // Mark as self-created so the threadId effect skips clear+fetch
            selfCreatedThreadRef.current = newId;
            onThreadId?.(newId);
            return doSubmit(newId);
          })
          .catch((err) => {
            console.error("[useSaisStream] Failed to create thread:", err);
            onError?.(err instanceof Error ? err : new Error(String(err)));
          });
      }
    },
    [apiUrl, assistantId, threadId, manager, threadClient, branch, activeRuns, onThreadId, onError],
  );

  // ----- stop -----
  const stop = useCallback(() => {
    manager.stop();
  }, [manager]);

  // ----- getMessagesMetadata -----
  const getMessagesMetadata = useCallback(
    (message: Message, index?: number): MessageMetadata | undefined => {
      return branch.getMessagesMetadata(message, index);
    },
    [branch],
  );

  // ----- setBranch (placeholder for future full branching support) -----
  const setBranch = useCallback(
    (_branch: string) => {
      // TODO: Implement full branch switching (re-fetch state at checkpoint)
      console.warn("[useSaisStream] setBranch not yet fully implemented");
    },
    [],
  );

  // ----- Derive return values -----
  const values = manager.values ?? {};
  const isLoading = manager.state.isLoading;
  const error = manager.state.error;

  // Backward compat: preStreamIds always empty (no longer tracked)
  const emptyPreStreamIds = useRef(new Set<string>()).current;

  // Interrupt: from streaming values or branch context (thread head)
  const interrupt = isLoading
    ? (manager.state.values as Record<string, unknown> | null)?.__interrupt__
    : branch.interrupt;

  return {
    values,
    messages,
    isLoading,
    error,
    interrupt,
    submit,
    stop,
    getMessagesMetadata,
    setBranch,
    preStreamIds: emptyPreStreamIds,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps an SSE async generator to intercept the `metadata` event and
 * extract the run_id before yielding it downstream.
 */
async function* interceptMetadata(
  inner: AsyncGenerator<import("@/lib/sais-stream/sse-client").SSEEvent>,
  onRunId: (runId: string) => void,
): AsyncGenerator<import("@/lib/sais-stream/sse-client").SSEEvent> {
  for await (const event of inner) {
    if (
      event.event === "metadata" &&
      event.data &&
      typeof event.data === "object" &&
      "run_id" in (event.data as Record<string, unknown>)
    ) {
      onRunId((event.data as { run_id: string }).run_id);
    }
    yield event;
  }
}
