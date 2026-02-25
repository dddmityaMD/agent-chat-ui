/**
 * REST-based message fetching hook with cache-busting and abort.
 *
 * Messages are the single source of truth, fetched from LangGraph thread
 * state API via REST. SSE no longer carries message content -- only sais_ui
 * updates and "new message available" signals trigger refetch here.
 *
 * Key design decisions per CONTEXT.md:
 * - AbortController per threadId prevents race conditions (Pitfall 2).
 * - 100ms delay between SSE signal and REST fetch (Pitfall 1: stale reads).
 * - Already-displayed messages stay visible on error.
 * - Auto-retry 3x with exponential backoff (200ms, 400ms, 800ms).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { Message } from "@langchain/langgraph-sdk";
import type { SaisThreadClient } from "@/lib/sais-stream/thread-client";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RETRY_DELAYS = [200, 400, 800] as const;
const SIGNAL_DELAY_MS = 100;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseMessagesResult {
  messages: Message[];
  isLoading: boolean;
  refetch: () => void;
}

export function useMessages(
  threadId: string | null,
  threadClient: SaisThreadClient,
): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Core fetch with retry logic
  const fetchMessages = useCallback(
    async (tid: string) => {
      // Cancel any in-flight fetch (Pitfall 2: race condition on thread switch)
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setIsLoading(true);

        let lastError: unknown;
        for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
          try {
            const msgs = await threadClient.fetchMessages(
              tid,
              controller.signal,
            );
            if (!controller.signal.aborted) {
              setMessages(msgs);
            }
            return; // Success
          } catch (err) {
            if (
              err instanceof DOMException &&
              err.name === "AbortError"
            ) {
              return; // Intentional cancellation
            }
            lastError = err;
            if (attempt < RETRY_DELAYS.length) {
              // Wait before retry with exponential backoff
              await new Promise((r) =>
                setTimeout(r, RETRY_DELAYS[attempt]),
              );
              if (controller.signal.aborted) return;
            }
          }
        }

        // All retries exhausted -- show error toast, keep existing messages
        console.error("Failed to fetch messages after retries:", lastError);
        toast.error("Failed to load messages. Please try again.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [threadClient],
  );

  // Fetch on mount / thread change
  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      return;
    }
    fetchMessages(threadId);
    return () => {
      abortRef.current?.abort();
    };
  }, [threadId, fetchMessages]);

  // Refetch callback for SSE signal -- brief delay per RESEARCH.md Pitfall 1
  const refetch = useCallback(() => {
    if (!threadId) return;
    setTimeout(() => fetchMessages(threadId), SIGNAL_DELAY_MS);
  }, [threadId, fetchMessages]);

  return { messages, isLoading, refetch };
}
