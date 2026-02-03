import { validate } from "uuid";
import { getApiKey } from "@/lib/api-key";
import { Thread } from "@langchain/langgraph-sdk";
import { useQueryState } from "nuqs";
import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import { createClient } from "./client";

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
  getThreads: () => Promise<Thread[]>;
  threads: Thread[];
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  threadsLoading: boolean;
  setThreadsLoading: Dispatch<SetStateAction<boolean>>;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

function getThreadSearchMetadata(
  assistantId: string,
): { graph_id: string } | { assistant_id: string } {
  if (validate(assistantId)) {
    return { assistant_id: assistantId };
  } else {
    return { graph_id: assistantId };
  }
}

export function ThreadProvider({ children }: { children: ReactNode }) {
  const [apiUrl] = useQueryState("apiUrl");
  const [assistantId] = useQueryState("assistantId");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const getThreads = useCallback(async (): Promise<Thread[]> => {
    if (!apiUrl || !assistantId) return [];
    const client = createClient(apiUrl, getApiKey() ?? undefined);

    const threads = await client.threads.search({
      metadata: {
        ...getThreadSearchMetadata(assistantId),
      },
      limit: 100,
    });

    return threads;
  }, [apiUrl, assistantId]);

  const value = {
    getThreads,
    threads,
    setThreads,
    threadsLoading,
    setThreadsLoading,
  };

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

/**
 * Extract FlowInfo (active_flow + handoff) from a raw sais_ui payload.
 *
 * This is a pure helper -- it does not use hooks or context.  Components
 * that already have access to `sais_ui` (e.g. from `useStreamContext`) can
 * call this directly.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function extractFlowInfo(saisUi: unknown): FlowInfo {
  const empty: FlowInfo = { activeFlow: null, handoff: null };
  if (!saisUi || typeof saisUi !== "object") return empty;

  const obj = saisUi as Record<string, unknown>;

  const activeFlow =
    typeof obj.active_flow === "string" && obj.active_flow.length > 0
      ? obj.active_flow
      : null;

  let handoff: HandoffInfo | null = null;
  if (obj.handoff && typeof obj.handoff === "object") {
    const h = obj.handoff as Record<string, unknown>;
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
