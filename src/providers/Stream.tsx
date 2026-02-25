import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useRef,
} from "react";
import { type Message } from "@langchain/langgraph-sdk";
import {
  type UIMessage,
} from "@langchain/langgraph-sdk/react-ui";
import { useQueryState } from "nuqs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LangGraphLogoSVG } from "@/components/icons/langgraph";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { getApiKey } from "@/lib/api-key";
import { useThreads } from "./Thread";
import { useAuth } from "./Auth";
import { toast } from "sonner";
import { useSaisStream, type UseSaisStreamResult } from "@/hooks/useSaisStream";


export type StateType = {
  messages: Message[];
  ui?: UIMessage[];
  // --- Streaming progress fields (populated by intermediate graph nodes) ---
  // These mirror backend AgentState fields and are available via stream.values
  // during streaming. Used by the thought process pane to show stage details.
  resolved_entities?: Record<string, { name?: string; entity_type?: string; canonical_key?: string }>;
  intent?: string;
  intent_confidence?: number;
  active_flow?: string;
  evidence_result?: {
    evidence?: Array<{ type?: string; title?: string }>;
    still_missing?: string[];
    metadata_results?: Array<Record<string, unknown>>;
    catalog_count?: { count?: number; entity_type?: string };
  };
  findings?: { root_cause?: { statement?: string; confidence?: number } };
  // RPABV research/validate progress (Phase 23.1.1-07)
  sais_ui?: {
    active_flow?: string;
    rpabv_stage?: string;
    research_progress?: {
      iteration?: number;
      max_iterations?: number;
      status?: string;
      context_found?: { models?: number; sources?: number; evidence?: number };
      verdict?: { sufficient?: boolean; confidence?: number; gaps?: string[] };
    };
    validation_progress?: {
      steps_checked?: number;
      warnings?: number;
      status?: string;
    };
  };
};

// StreamContextType is now our custom hook result
type StreamContextType = UseSaisStreamResult;
const StreamContext = createContext<StreamContextType | undefined>(undefined);

async function sleep(ms = 4000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkGraphStatus(
  apiUrl: string,
  apiKey: string | null,
): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl}/info`, {
      credentials: "include",
      ...(apiKey && {
        headers: {
          "X-Api-Key": apiKey,
        },
      }),
    });

    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

const StreamSession = ({
  children,
  apiKey,
  apiUrl,
  assistantId,
}: {
  children: ReactNode;
  apiKey: string | null;
  apiUrl: string;
  assistantId: string;
}) => {
  const [threadId, setThreadId] = useQueryState("threadId");
  const { getThreads, setThreads, registerThread } = useThreads();
  const { setSessionExpired } = useAuth();

  // Track current threadId to guard against async race conditions in onThreadId.
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;

  const streamValue = useSaisStream({
    apiUrl,
    apiKey: apiKey ?? undefined,
    assistantId,
    threadId: threadId ?? null,
    onThreadId: (id) => {
      // Register the thread in backend metadata BEFORE setting threadId in state.
      // This prevents a race condition where CasePanel detects the threadId change
      // and fetches /api/threads/{id}/summary before registration completes (UX-06).
      // Guard: only setThreadId if user hasn't navigated away during async registration.
      registerThread(id)
        .then(() => {
          if (threadIdRef.current === null || threadIdRef.current === id) {
            setThreadId(id);
          }
        })
        .catch((err) => {
          console.error("Thread registration failed, setting threadId anyway:", err);
          if (threadIdRef.current === null || threadIdRef.current === id) {
            setThreadId(id);
          }
        });
      // Refetch threads list when thread ID changes.
      sleep().then(() => getThreads().then(setThreads).catch(console.error));
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      // Session expired -- trigger re-auth modal instead of error toast.
      if (msg.includes("401") || msg.includes("Unauthorized")) {
        setSessionExpired(true);
        return;
      }
      // Thread state lost after server restart (in-memory storage)
      if (msg.includes("500") || msg.includes("404") || msg.includes("config")) {
        toast.error("Thread history unavailable", {
          description: "This thread's state was lost after a server restart. Please start a new conversation.",
          duration: 8000,
          richColors: true,
          closeButton: true,
        });
        // Clear the broken threadId so the user can start fresh
        setThreadId(null);
      }
    },
  });

  useEffect(() => {
    checkGraphStatus(apiUrl, apiKey).then((ok) => {
      if (!ok) {
        toast.error("Failed to connect to LangGraph server", {
          description: () => (
            <p>
              Please ensure your graph is running at <code>{apiUrl}</code> and
              your API key is correctly set (if connecting to a deployed graph).
            </p>
          ),
          duration: 10000,
          richColors: true,
          closeButton: true,
        });
      }
    });
  }, [apiKey, apiUrl]);

  return (
    <StreamContext.Provider value={streamValue}>
      {children}
    </StreamContext.Provider>
  );
};

// Default values for the form
const DEFAULT_API_URL = "http://localhost:2024";
const DEFAULT_ASSISTANT_ID = "agent";

export const StreamProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Get environment variables
  const envApiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL;
  const envAssistantId: string | undefined =
    process.env.NEXT_PUBLIC_ASSISTANT_ID;

  // Use URL params with env var fallbacks
  const [apiUrl, setApiUrl] = useQueryState("apiUrl", {
    defaultValue: envApiUrl || "",
  });
  const [assistantId, setAssistantId] = useQueryState("assistantId", {
    defaultValue: envAssistantId || "",
  });

  // For API key, use localStorage with env var fallback
  const [apiKey, _setApiKey] = useState(() => {
    const storedKey = getApiKey();
    return storedKey || "";
  });

  const setApiKey = (key: string) => {
    window.localStorage.setItem("lg:chat:apiKey", key);
    _setApiKey(key);
  };

  // Determine final values to use, prioritizing URL params then env vars
  const finalApiUrl = apiUrl || envApiUrl;
  const finalAssistantId = assistantId || envAssistantId;

  // Show the form if we: don't have an API URL, or don't have an assistant ID
  if (!finalApiUrl || !finalAssistantId) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-4">
        <div className="animate-in fade-in-0 zoom-in-95 bg-background flex max-w-3xl flex-col rounded-lg border shadow-lg">
          <div className="mt-14 flex flex-col gap-2 border-b p-6">
            <div className="flex flex-col items-start gap-2">
              <LangGraphLogoSVG className="h-7" />
              <h1 className="text-xl font-semibold tracking-tight">
                Agent Chat
              </h1>
            </div>
            <p className="text-muted-foreground">
              Welcome to Agent Chat! Before you get started, you need to enter
              the URL of the deployment and the assistant / graph ID.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();

              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              const apiUrl = formData.get("apiUrl") as string;
              const assistantId = formData.get("assistantId") as string;
              const apiKey = formData.get("apiKey") as string;

              setApiUrl(apiUrl);
              setApiKey(apiKey);
              setAssistantId(assistantId);

              form.reset();
            }}
            className="bg-muted/50 flex flex-col gap-6 p-6"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="apiUrl">
                Deployment URL<span className="text-rose-500">*</span>
              </Label>
              <p className="text-muted-foreground text-sm">
                This is the URL of your LangGraph deployment. Can be a local, or
                production deployment.
              </p>
              <Input
                id="apiUrl"
                name="apiUrl"
                className="bg-background"
                defaultValue={apiUrl || DEFAULT_API_URL}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="assistantId">
                Assistant / Graph ID<span className="text-rose-500">*</span>
              </Label>
              <p className="text-muted-foreground text-sm">
                This is the ID of the graph (can be the graph name), or
                assistant to fetch threads from, and invoke when actions are
                taken.
              </p>
              <Input
                id="assistantId"
                name="assistantId"
                className="bg-background"
                defaultValue={assistantId || DEFAULT_ASSISTANT_ID}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="apiKey">LangSmith API Key</Label>
              <p className="text-muted-foreground text-sm">
                This is <strong>NOT</strong> required if using a local LangGraph
                server. This value is stored in your browser's local storage and
                is only used to authenticate requests sent to your LangGraph
                server.
              </p>
              <PasswordInput
                id="apiKey"
                name="apiKey"
                defaultValue={apiKey ?? ""}
                className="bg-background"
                placeholder="lsv2_pt_..."
              />
            </div>

            <div className="mt-2 flex justify-end">
              <Button
                type="submit"
                size="lg"
              >
                Continue
                <ArrowRight className="size-5" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <StreamSession
      apiKey={apiKey}
      apiUrl={apiUrl}
      assistantId={assistantId}
    >
      {children}
    </StreamSession>
  );
};

// Create a custom hook to use the context
// eslint-disable-next-line react-refresh/only-export-components
export const useStreamContext = (): StreamContextType => {
  const context = useContext(StreamContext);
  if (context === undefined) {
    throw new Error("useStreamContext must be used within a StreamProvider");
  }
  return context;
};

export default StreamContext;
