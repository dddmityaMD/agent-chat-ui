/**
 * ActiveRunsProvider — tracks in-progress runs across all threads.
 *
 * Enables:
 * - SSE rejoin when switching back to a thread with an active run
 * - Sidebar spinner indicators on threads with running agents
 * - Toast notifications when background threads complete
 *
 * Polling: checks non-current-thread runs every 5s via REST.
 * Zero overhead when no background runs exist.
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { SaisThreadClient } from "@/lib/sais-stream/thread-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActiveRun {
  runId: string;
  startedAt: number;
  threadTitle?: string;
}

interface ActiveRunsContextValue {
  registerRun: (threadId: string, runId: string, threadTitle?: string) => void;
  unregisterRun: (threadId: string) => void;
  getActiveRun: (threadId: string) => ActiveRun | undefined;
  activeThreadIds: Set<string>;
}

const ActiveRunsContext = createContext<ActiveRunsContextValue | undefined>(undefined);

// Terminal run statuses — if the server reports one of these, the run is done.
const TERMINAL_STATUSES = new Set(["success", "error", "timeout"]);

const POLL_INTERVAL_MS = 5000;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ActiveRunsProvider({
  children,
  threadClient,
  currentThreadId,
  onThreadCompleted,
}: {
  children: ReactNode;
  threadClient: SaisThreadClient;
  currentThreadId: string | null;
  onThreadCompleted?: () => void;
}) {
  // Map<threadId, ActiveRun> — mutable ref for polling, state copy for renders
  const runsRef = useRef<Map<string, ActiveRun>>(new Map());
  const [activeThreadIds, setActiveThreadIds] = useState<Set<string>>(new Set());

  // Keep currentThreadId in a ref so polling callback sees latest value
  const currentThreadIdRef = useRef(currentThreadId);
  currentThreadIdRef.current = currentThreadId;

  const syncState = useCallback(() => {
    setActiveThreadIds(new Set(runsRef.current.keys()));
  }, []);

  const registerRun = useCallback(
    (threadId: string, runId: string, threadTitle?: string) => {
      runsRef.current.set(threadId, {
        runId,
        startedAt: Date.now(),
        threadTitle,
      });
      syncState();
    },
    [syncState],
  );

  const unregisterRun = useCallback(
    (threadId: string) => {
      runsRef.current.delete(threadId);
      syncState();
    },
    [syncState],
  );

  const getActiveRun = useCallback((threadId: string): ActiveRun | undefined => {
    return runsRef.current.get(threadId);
  }, []);

  // --- Polling loop for background (non-current) runs ---
  useEffect(() => {
    // Only poll when there are tracked runs
    if (activeThreadIds.size === 0) return;

    const poll = async () => {
      const current = currentThreadIdRef.current;
      const entries = Array.from(runsRef.current.entries());

      for (const [threadId, run] of entries) {
        // Skip the thread the user is currently viewing — it gets SSE updates
        if (threadId === current) continue;

        try {
          const result = await threadClient.getRunStatus(threadId, run.runId);
          if (TERMINAL_STATUSES.has(result.status)) {
            runsRef.current.delete(threadId);

            // Toast notification for background completion
            const title = run.threadTitle || threadId.slice(0, 8);
            toast.info("Thread completed", {
              description: title,
              action: {
                label: "View",
                onClick: () => {
                  // Navigate via URL params (same mechanism as sidebar)
                  const url = new URL(window.location.href);
                  url.searchParams.set("threadId", threadId);
                  window.history.replaceState(null, "", url.toString());
                  // Trigger nuqs sync by dispatching popstate
                  window.dispatchEvent(new PopStateEvent("popstate"));
                },
              },
            });

            // Refresh thread list so sidebar shows updated preview/timestamp
            onThreadCompleted?.();
          }
        } catch {
          // Network error or run not found — remove stale entry
          runsRef.current.delete(threadId);
        }
      }

      syncState();
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeThreadIds.size, threadClient, onThreadCompleted, syncState]);

  return (
    <ActiveRunsContext.Provider
      value={{ registerRun, unregisterRun, getActiveRun, activeThreadIds }}
    >
      {children}
    </ActiveRunsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useActiveRuns(): ActiveRunsContextValue {
  const ctx = useContext(ActiveRunsContext);
  if (!ctx) {
    throw new Error("useActiveRuns must be used within ActiveRunsProvider");
  }
  return ctx;
}
