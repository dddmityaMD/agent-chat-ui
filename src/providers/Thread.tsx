import { getApiBaseUrl } from "@/lib/api-url";
import type { PermissionGrant, PermissionState, ThreadWithMeta } from "@/lib/types";
import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useMemo,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import { extractFlowType, extractHandoffProposal } from "@/hooks/useSaisUi";
import { useAuth } from "@/providers/Auth";

// ---------------------------------------------------------------------------
// Flow-related types extracted from sais_ui state
// ---------------------------------------------------------------------------

/** Handoff proposal surfaced by a flow subgraph. */
export interface HandoffInfo {
  target_flow: string;
  reason: string;
  confirmed: boolean;
}

/** Convenience type for active flow state. */
export interface FlowInfo {
  /** Currently active flow name (catalog | investigation | remediation | ops) or null. */
  activeFlow: string | null;
  /** Pending handoff proposal, if any. */
  handoff: HandoffInfo | null;
}

interface ThreadContextType {
  getThreads: (includeArchived?: boolean) => Promise<ThreadWithMeta[]>;
  threads: ThreadWithMeta[];
  setThreads: Dispatch<SetStateAction<ThreadWithMeta[]>>;
  threadsLoading: boolean;
  setThreadsLoading: Dispatch<SetStateAction<boolean>>;
  registerThread: (threadId: string, title?: string, preview?: string) => Promise<ThreadWithMeta | null>;
  updateThread: (threadId: string, updates: { title?: string; is_pinned?: boolean }) => Promise<void>;
  archiveThread: (threadId: string) => Promise<void>;
  permissionState: PermissionState;
  addPermissionGrant: (grant: PermissionGrant) => void;
  revokePermissionGrant: (pendingActionId: string | null) => void;
  clearPermissionGrants: () => void;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

export function ThreadProvider({ children }: { children: ReactNode }) {
  // apiUrl and assistantId are kept for other consumers (StreamProvider, etc.)
  // but thread listing now goes through backend /api/threads.
  const { setSessionExpired } = useAuth();
  const [threads, setThreads] = useState<ThreadWithMeta[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>({ grants: [] });

  const getThreads = useCallback(async (includeArchived = false): Promise<ThreadWithMeta[]> => {
    const baseUrl = getApiBaseUrl();
    const params = new URLSearchParams();
    if (includeArchived) params.set("include_archived", "true");
    try {
      const res = await fetch(`${baseUrl}/api/threads?${params}`, {
        credentials: "include",
      });
      if (res.status === 401) { setSessionExpired(true); return []; }
      if (!res.ok) return [];
      return (await res.json()) as ThreadWithMeta[];
    } catch (err) {
      console.error("Failed to fetch threads:", err);
      return [];
    }
  }, [setSessionExpired]);

  const registerThread = useCallback(async (
    threadId: string,
    title?: string,
    preview?: string,
  ): Promise<ThreadWithMeta | null> => {
    const baseUrl = getApiBaseUrl();
    try {
      const body: Record<string, string> = {};
      if (title) body.title = title;
      if (preview) body.last_message_preview = preview;
      const res = await fetch(`${baseUrl}/api/threads/${threadId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (res.status === 401) { setSessionExpired(true); return null; }
      if (!res.ok) return null;
      return (await res.json()) as ThreadWithMeta;
    } catch (err) {
      console.error("Failed to register thread:", err);
      return null;
    }
  }, [setSessionExpired]);

  const updateThread = useCallback(async (
    threadId: string,
    updates: { title?: string; is_pinned?: boolean },
  ): Promise<void> => {
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (res.status === 401) { setSessionExpired(true); return; }
      // Optimistically update local state so header and sidebar stay in sync
      setThreads((prev) =>
        prev.map((t) =>
          t.thread_id === threadId ? { ...t, ...updates } : t,
        ),
      );
    } catch (err) {
      console.error("Failed to update thread:", err);
    }
  }, [setSessionExpired]);

  const archiveThread = useCallback(async (threadId: string): Promise<void> => {
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/threads/${threadId}/archive`, {
        method: "POST",
        credentials: "include",
      });
      if (res.status === 401) { setSessionExpired(true); return; }
    } catch (err) {
      console.error("Failed to archive thread:", err);
    }
  }, [setSessionExpired]);

  const addPermissionGrant = useCallback((grant: PermissionGrant) => {
    setPermissionState((prev) => {
      const existingIdx = prev.grants.findIndex(
        (item) =>
          item.pending_action_id === grant.pending_action_id &&
          item.capability === grant.capability,
      );
      if (existingIdx === -1) {
        return { grants: [grant, ...prev.grants] };
      }
      const next = [...prev.grants];
      next[existingIdx] = grant;
      return { grants: next };
    });
  }, []);

  const revokePermissionGrant = useCallback((pendingActionId: string | null) => {
    setPermissionState((prev) => ({
      grants: prev.grants.filter((grant) => grant.pending_action_id !== pendingActionId),
    }));
  }, []);

  const clearPermissionGrants = useCallback(() => {
    setPermissionState({ grants: [] });
  }, []);

  const value = useMemo(
    () => ({
      getThreads,
      threads,
      setThreads,
      threadsLoading,
      setThreadsLoading,
      registerThread,
      updateThread,
      archiveThread,
      permissionState,
      addPermissionGrant,
      revokePermissionGrant,
      clearPermissionGrants,
    }),
    [
      getThreads,
      threads,
      threadsLoading,
      registerThread,
      updateThread,
      archiveThread,
      permissionState,
      addPermissionGrant,
      revokePermissionGrant,
      clearPermissionGrants,
    ],
  );

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useThreads() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useThreads must be used within a ThreadProvider");
  }
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePermissionState() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("usePermissionState must be used within a ThreadProvider");
  }
  return {
    permissionState: context.permissionState,
    addPermissionGrant: context.addPermissionGrant,
    revokePermissionGrant: context.revokePermissionGrant,
    clearPermissionGrants: context.clearPermissionGrants,
  };
}

/**
 * Extract FlowInfo (active_flow + handoff) from a raw sais_ui payload.
 *
 * This is a pure helper -- it does not use hooks or context.  Components
 * that already have access to `sais_ui` (e.g. from `useStreamContext`) can
 * call this directly.
 *
 * Uses centralized extractors from useSaisUi for consistency.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function extractFlowInfo(saisUi: unknown): FlowInfo {
  const empty: FlowInfo = { activeFlow: null, handoff: null };
  if (!saisUi || typeof saisUi !== "object") return empty;

  const activeFlow = extractFlowType(saisUi);

  let handoff: HandoffInfo | null = null;
  const handoffData = extractHandoffProposal(saisUi);
  if (handoffData && typeof handoffData === "object") {
    const h = handoffData as Record<string, unknown>;
    if (typeof h.target_flow === "string") {
      handoff = {
        target_flow: h.target_flow,
        reason: typeof h.reason === "string" ? h.reason : "",
        confirmed: h.confirmed === true,
      };
    }
  }

  return { activeFlow, handoff };
}
