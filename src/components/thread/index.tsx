import { v4 as uuidv4 } from "uuid";
import { Component, ReactNode, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { useState, FormEvent } from "react";
import { Button } from "../ui/button";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { AssistantMessage, AssistantMessageLoading } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import {
  DO_NOT_RENDER_ID_PREFIX,
  ensureToolCallsHaveResponses,
} from "@/lib/ensure-tool-responses";
import { LangGraphLogoSVG } from "../icons/langgraph";
import { CasePanel } from "@/components/case-panel";
import { TooltipIconButton } from "./tooltip-icon-button";
import {
  AlertTriangle,
  ArrowDown,
  LoaderCircle,
  PanelRightOpen,
  PanelRightClose,
  RotateCcw,
  Square,
  SquarePen,
  XIcon,
  Pencil,
  Plus,
  Check,
} from "lucide-react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import ThreadHistory from "./history";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { GitHubSVG } from "../icons/github";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ContentBlocksPreview } from "./ContentBlocksPreview";
import {
  useArtifactOpen,
  ArtifactContent,
  ArtifactTitle,
  useArtifactContext,
} from "./artifact";
import { HealthDot } from "./health-dot";
import { PermissionPill } from "@/components/permission-pill";
import { usePermissionState, useThreads } from "@/providers/Thread";
import { useSaisUi } from "@/hooks/useSaisUi";
import { LogoutButton } from "@/components/logout-button";
import { SettingsButton } from "@/components/settings-button";
import { BudgetIndicator } from "@/components/header/budget-indicator";
import { EmptyState } from "./empty-state";

/**
 * Error boundary that catches render errors in individual messages,
 * preventing a single malformed message from crashing the entire thread.
 */
class MessageErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to render this message.{" "}
          <span className="text-xs text-red-500">
            {this.state.error?.message}
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={props.className}
    >
      <div
        ref={context.contentRef}
        className={props.contentClassName}
      >
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <button
      type="button"
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border bg-background shadow-md transition-all hover:bg-accent",
        props.className,
      )}
      onClick={() => scrollToBottom()}
      aria-label="Scroll to bottom"
    >
      <ArrowDown className="h-4 w-4" />
    </button>
  );
}

function OpenGitHubRepo() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href="https://github.com/langchain-ai/agent-chat-ui"
            target="_blank"
            className="flex items-center justify-center"
          >
            <GitHubSVG
              width="24"
              height="24"
            />
          </a>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Open GitHub repo</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Editable thread title displayed in the header.
 * Shows thread title (or "New conversation") and allows inline editing.
 */
function EditableThreadTitle({
  threadId,
  title,
  preview,
  onSave,
}: {
  threadId: string | null;
  title: string | null;
  /** Fallback display text when title is empty (e.g. last_message_preview). */
  preview: string | null;
  onSave: (newTitle: string) => void;
}) {
  const displayTitle =
    title ||
    (preview ? preview.slice(0, 60) : null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayTitle ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(displayTitle ?? "");
  }, [displayTitle]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== (displayTitle ?? "")) {
      onSave(trimmed);
    }
  };

  if (!threadId) {
    return (
      <span className="text-xl font-semibold tracking-tight">
        Agent Chat
      </span>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(displayTitle ?? "");
              setEditing(false);
            }
          }}
          className="max-w-[200px] rounded border bg-background px-1.5 py-0.5 text-sm font-medium outline-none focus:ring-1 focus:ring-blue-400"
          data-testid="thread-title-input"
        />
        <button
          type="button"
          onClick={commit}
          className="rounded p-0.5 hover:bg-gray-100"
          title="Save title"
        >
          <Check className="size-3.5 text-green-600" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="cursor-pointer truncate text-sm font-semibold tracking-tight hover:underline"
      title="Click to edit thread title"
      data-testid="thread-title"
    >
      {displayTitle || "New conversation"}
    </button>
  );
}

export function Thread() {
  const [artifactContext, setArtifactContext] = useArtifactContext();
  const [artifactOpen, closeArtifact] = useArtifactOpen();

  const [threadId, _setThreadId] = useQueryState("threadId");
  const [, setCasePanelSection] = useQueryState("casePanelSection");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [hideToolCalls, setHideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false),
  );
  const [input, setInput] = useState("");
  const {
    contentBlocks,
    setContentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    resetBlocks: _resetBlocks,
    dragOver,
    handlePaste,
  } = useFileUpload();
  const { permissionState, addPermissionGrant, clearPermissionGrants } = usePermissionState();
  const { threads, updateThread, getThreads, setThreads } = useThreads();
  const currentThread = threads.find((t) => t.thread_id === threadId) ?? null;
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  // Optimistic human message: shown immediately on submit so the loading
  // dots appear below it, not below the previous AI message.  Cleared once
  // the message shows up in stream.messages (by ID match).
  const [pendingHumanMessage, setPendingHumanMessage] = useState<Message | null>(null);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const [casePanelOpen, setCasePanelOpen] = useQueryState(
    "casePanelOpen",
    parseAsBoolean.withDefault(true),
  );

  const stream = useStreamContext();
  const messages = stream.messages;
  const isLoading = stream.isLoading;
  const saisUiData = useSaisUi();

  // Sync permission grants from backend sais_ui state to local React state.
  // When a stream completes (isLoading transitions false), reconcile local
  // permissionState with the authoritative backend sais_ui.permissions.grants.
  // This removes consumed once-scope grants after replay/auto-revoke. (9C-30 fix)
  const wasLoadingRef = useRef(false);
  useEffect(() => {
    if (isLoading) {
      wasLoadingRef.current = true;
      return;
    }
    if (!wasLoadingRef.current) return; // only sync on loading→idle transition
    wasLoadingRef.current = false;

    const backendGrants = saisUiData.permissionGrants;

    // Reconcile: clear local state and re-add only what backend reports
    clearPermissionGrants();
    for (const g of backendGrants) {
      if (g && typeof g === "object" && "capability" in g) {
        addPermissionGrant(g as import("@/lib/types").PermissionGrant);
      }
    }

    // Refresh thread list to pick up auto-generated titles from first AI response
    getThreads().then(setThreads).catch(console.error);
  }, [isLoading, saisUiData.permissionGrants, clearPermissionGrants, addPermissionGrant, getThreads, setThreads]);

  const lastError = useRef<string | undefined>(undefined);

  const setThreadId = (id: string | null) => {
    _setThreadId(id);
    clearPermissionGrants();

    // close artifact and reset artifact context
    closeArtifact();
    setArtifactContext({});
  };

  useEffect(() => {
    if (!stream.error) {
      lastError.current = undefined;
      return;
    }
    try {
      const message = (stream.error as any).message;
      if (!message || lastError.current === message) {
        // Message has already been logged. do not modify ref, return early.
        return;
      }

      // Message is defined, and it has not been logged yet. Save it, and send the error
      lastError.current = message;
      toast.error("An error occurred. Please try again.", {
        description: (
          <p>
            <strong>Error:</strong> <code>{message}</code>
          </p>
        ),
        richColors: true,
        closeButton: true,
        action: {
          label: "Retry",
          onClick: () => handleRetry(),
        },
      });
    } catch {
      // no-op
    }
  }, [stream.error]);

  // Clear pendingHumanMessage once it appears in stream.messages (by ID).
  useEffect(() => {
    if (
      pendingHumanMessage &&
      messages.some((m) => m.id === pendingHumanMessage.id)
    ) {
      setPendingHumanMessage(null);
    }
  }, [messages, pendingHumanMessage]);

  // TODO: this should be part of the useStream hook
  const prevMessageLength = useRef(0);
  useEffect(() => {
    if (
      messages.length !== prevMessageLength.current &&
      messages?.length &&
      messages[messages.length - 1].type === "ai"
    ) {
      setFirstTokenReceived(true);
    }

    prevMessageLength.current = messages.length;
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if ((input.trim().length === 0 && contentBlocks.length === 0) || isLoading)
      return;
    setFirstTokenReceived(false);
    // Build the message first so we can use it for both optimistic render
    // and the actual submit payload.
    const newHumanMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: [
        ...(input.trim().length > 0 ? [{ type: "text", text: input }] : []),
        ...contentBlocks,
      ] as Message["content"],
    };

    // Show the human message immediately so loading dots appear below it.
    setPendingHumanMessage(newHumanMessage);

    const toolMessages = ensureToolCallsHaveResponses(stream.messages);

    const context =
      Object.keys(artifactContext).length > 0 ? artifactContext : undefined;

    // Include full message history so checkpointer persists all messages.
    // The backend's add_messages reducer deduplicates by ID.
    // toolMessages are synthetic responses for incomplete tool calls.
    stream.submit(
      {
        messages: [...stream.messages, ...toolMessages, newHumanMessage],
        context,
      },
      {
        streamMode: ["values"],
        streamSubgraphs: true,
        streamResumable: true,
        optimisticValues: (prev) => ({
          ...prev,
          context,
          messages: [
            ...(prev.messages ?? []),
            ...toolMessages,
            newHumanMessage,
          ],
        }),
      },
    );

    setInput("");
    setContentBlocks([]);
  };

  const handleRegenerate = (
    parentCheckpoint: Checkpoint | null | undefined,
  ) => {
    // Do this so the loading state is correct
    prevMessageLength.current = prevMessageLength.current - 1;
    setFirstTokenReceived(false);
    stream.submit(undefined, {
      checkpoint: parentCheckpoint,
      streamMode: ["values"],
      streamSubgraphs: true,
      streamResumable: true,
    });
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Extract plain text from the last human message in the conversation. */
  const getLastUserMessageText = (): string | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type === "human") {
        if (typeof m.content === "string") return m.content;
        if (Array.isArray(m.content)) {
          const textBlock = m.content.find(
            (b: any) => b.type === "text" && b.text,
          );
          return (textBlock as any)?.text ?? null;
        }
      }
    }
    return null;
  };

  /** Retry: re-send the last user message as-is. */
  const handleRetry = () => {
    const text = getLastUserMessageText();
    if (!text) return;
    setFirstTokenReceived(false);

    const retryMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: [{ type: "text", text }] as Message["content"],
    };
    setPendingHumanMessage(retryMessage);

    const toolMessages = ensureToolCallsHaveResponses(stream.messages);
    stream.submit(
      { messages: [...stream.messages, ...toolMessages, retryMessage] },
      {
        streamMode: ["values"],
        streamSubgraphs: true,
        streamResumable: true,
        optimisticValues: (prev) => ({
          ...prev,
          messages: [...(prev.messages ?? []), ...toolMessages, retryMessage],
        }),
      },
    );
  };

  /** Edit & Retry: place the last user message text in the input for editing. */
  const handleEditRetry = () => {
    const text = getLastUserMessageText();
    if (!text) return;
    setInput(text);
    // Focus the textarea so the user can immediately edit
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const chatStarted = !!threadId || !!messages.length;
  const hasNoAIOrToolMessages = !messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="relative hidden lg:flex">
        <motion.div
          className="absolute z-20 h-full overflow-hidden border-r bg-background"
          style={{ width: 300 }}
          animate={{ x: chatHistoryOpen ? 0 : -300 }}
          initial={{ x: -300 }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          <div
            className="relative h-full"
            style={{ width: 300 }}
          >
            <ThreadHistory />
          </div>
        </motion.div>
      </div>

      <div
        className={cn(
          "grid w-full transition-all duration-500",
          !casePanelOpen && !artifactOpen && "grid-cols-[1fr_0fr_0fr]",
          casePanelOpen && !artifactOpen && "grid-cols-[3fr_2fr_0fr]",
          !casePanelOpen && artifactOpen && "grid-cols-[3fr_0fr_2fr]",
          casePanelOpen && artifactOpen && "grid-cols-[2fr_1fr_1fr]",
        )}
      >
        <motion.div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden",
            !chatStarted && "grid-rows-[1fr]",
          )}
          layout={isLargeScreen}
          animate={{
            marginLeft: chatHistoryOpen ? (isLargeScreen ? 300 : 0) : 0,
            width: chatHistoryOpen
              ? isLargeScreen
                ? "calc(100% - 300px)"
                : "100%"
              : "100%",
          }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          {!chatStarted && (
            <div className="absolute top-0 left-0 z-10 flex w-full items-center justify-between gap-3 p-2 pl-4">
              <div>
                {(!chatHistoryOpen || !isLargeScreen) && (
                  <Button
                    className="hover:bg-gray-100"
                    variant="ghost"
                    onClick={() => setChatHistoryOpen((p) => !p)}
                  >
                    {chatHistoryOpen ? (
                      <PanelRightOpen className="size-5" />
                    ) : (
                      <PanelRightClose className="size-5" />
                    )}
                  </Button>
                )}
              </div>
              <div className="absolute top-2 right-4 flex items-center gap-3">
                <BudgetIndicator />
                <LogoutButton />
                <SettingsButton />
                <HealthDot />
                <OpenGitHubRepo />
              </div>
            </div>
          )}
          {chatStarted && (
            <div className="relative z-10 flex items-center justify-between gap-3 p-2">
              <div className="relative flex items-center justify-start gap-2">
                <div className="absolute left-0 z-10">
                  {(!chatHistoryOpen || !isLargeScreen) && (
                    <Button
                      className="hover:bg-gray-100"
                      variant="ghost"
                      onClick={() => setChatHistoryOpen((p) => !p)}
                    >
                      {chatHistoryOpen ? (
                        <PanelRightOpen className="size-5" />
                      ) : (
                        <PanelRightClose className="size-5" />
                      )}
                    </Button>
                  )}
                </div>
                <motion.div
                  className="flex items-center gap-2"
                  animate={{
                    marginLeft: !chatHistoryOpen ? 48 : 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  <button
                    type="button"
                    className="flex cursor-pointer items-center gap-2"
                    onClick={() => setThreadId(null)}
                  >
                    <LangGraphLogoSVG
                      width={24}
                      height={24}
                    />
                  </button>
                  <EditableThreadTitle
                    threadId={threadId}
                    title={currentThread?.title ?? null}
                    preview={currentThread?.last_message_preview ?? null}
                    onSave={(newTitle) => {
                      if (threadId) {
                        updateThread(threadId, { title: newTitle });
                      }
                    }}
                  />
                </motion.div>
                <HealthDot />
                <PermissionPill
                  grants={permissionState.grants}
                  onClick={() => {
                    setCasePanelOpen(true);
                    setCasePanelSection("permissions");
                  }}
                />
              </div>

              <div className="flex items-center gap-4">
                <BudgetIndicator />
                <LogoutButton />
                <SettingsButton />
                <div className="flex items-center">
                  <OpenGitHubRepo />
                </div>
                <TooltipIconButton
                  size="lg"
                  className="p-4"
                  tooltip={casePanelOpen ? "Hide thread panel" : "Show thread panel"}
                  variant="ghost"
                  onClick={() => setCasePanelOpen((p) => !p)}
                >
                  {casePanelOpen ? (
                    <PanelRightClose className="size-5" />
                  ) : (
                    <PanelRightOpen className="size-5" />
                  )}
                </TooltipIconButton>
                <TooltipIconButton
                  size="lg"
                  className="p-4"
                  tooltip="New thread"
                  variant="ghost"
                  onClick={() => setThreadId(null)}
                >
                  <SquarePen className="size-5" />
                </TooltipIconButton>
              </div>

              <div className="from-background to-background/0 absolute inset-x-0 top-full h-5 bg-gradient-to-b" />
            </div>
          )}

          <StickToBottom className="relative flex-1 overflow-hidden">
            <StickyToBottomContent
              className={cn(
                "absolute inset-0 overflow-y-scroll px-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent",
                !chatStarted && "mt-[25vh] flex flex-col items-stretch",
                chatStarted && "grid grid-rows-[1fr_auto]",
              )}
              contentClassName="pt-8 pb-16 max-w-3xl mx-auto flex flex-col gap-4 w-full"
              content={
                <>
                  {messages
                    .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
                    .map((message, index) => (
                      <MessageErrorBoundary key={message.id || `${message.type}-${index}`}>
                        {message.type === "human" ? (
                          <HumanMessage
                            message={message}
                            isLoading={isLoading}
                          />
                        ) : (
                          <AssistantMessage
                            message={message}
                            isLoading={isLoading}
                            handleRegenerate={handleRegenerate}
                          />
                        )}
                      </MessageErrorBoundary>
                    ))}
                  {/* Optimistic human message: render if not yet in stream.messages */}
                  {pendingHumanMessage &&
                    !messages.some((m) => m.id === pendingHumanMessage.id) && (
                      <MessageErrorBoundary key={pendingHumanMessage.id}>
                        <HumanMessage
                          message={pendingHumanMessage}
                          isLoading={isLoading}
                        />
                      </MessageErrorBoundary>
                    )}
                  {/* Special rendering case where there are no AI/tool messages, but there is an interrupt.
                    We need to render it outside of the messages list, since there are no messages to render */}
                  {hasNoAIOrToolMessages && !!stream.interrupt && (
                    <MessageErrorBoundary>
                      <AssistantMessage
                        key="interrupt-msg"
                        message={undefined}
                        isLoading={isLoading}
                        handleRegenerate={handleRegenerate}
                      />
                    </MessageErrorBoundary>
                  )}
                  {isLoading && !firstTokenReceived && (
                    <AssistantMessageLoading />
                  )}
                  {/* Inline error indicator with Retry and Edit & Retry */}
                  {!isLoading && stream.error && (
                    <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />
                      <span className="text-red-700">Something went wrong</span>
                      <div className="ml-auto flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRetry}
                          className="h-7 gap-1 text-xs"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Retry
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleEditRetry}
                          className="h-7 gap-1 text-xs"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit & Retry
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              }
              footer={
                <div className="sticky bottom-0 flex flex-col items-center gap-8 bg-white">
                  {!chatStarted && (
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex items-center gap-3">
                        <LangGraphLogoSVG className="h-8 flex-shrink-0" />
                        <h1 className="text-2xl font-semibold tracking-tight">
                          Agent Chat
                        </h1>
                      </div>
                      <EmptyState onSelect={setInput} />
                    </div>
                  )}

                  <ScrollToBottom className="animate-in fade-in-0 zoom-in-95 absolute bottom-full left-1/2 mb-4 -translate-x-1/2" />

                  <div
                    ref={dropRef}
                    className={cn(
                      "bg-muted relative z-10 mx-auto mb-8 w-full max-w-3xl rounded-2xl shadow-xs transition-all",
                      dragOver
                        ? "border-primary border-2 border-dotted"
                        : "border border-solid",
                    )}
                  >
                    <form
                      onSubmit={handleSubmit}
                      className="mx-auto grid max-w-3xl grid-rows-[1fr_auto] gap-2"
                    >
                      <ContentBlocksPreview
                        blocks={contentBlocks}
                        onRemove={removeBlock}
                      />
                      <textarea
                        ref={textareaRef}
                        aria-label="Message input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onPaste={handlePaste}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            !e.metaKey &&
                            !e.nativeEvent.isComposing
                          ) {
                            e.preventDefault();
                            const el = e.target as HTMLElement | undefined;
                            const form = el?.closest("form");
                            form?.requestSubmit();
                          }
                        }}
                        placeholder="Type your message..."
                        className="field-sizing-content resize-none border-none bg-transparent p-3.5 pb-0 shadow-none ring-0 outline-none focus:ring-0 focus:outline-none"
                      />

                      <div className="flex items-center gap-6 p-2 pt-4">
                        <div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="render-tool-calls"
                              checked={hideToolCalls ?? false}
                              onCheckedChange={setHideToolCalls}
                            />
                            <Label
                              htmlFor="render-tool-calls"
                              className="text-sm text-gray-600"
                            >
                              Hide Tool Calls
                            </Label>
                          </div>
                        </div>
                        <Label
                          htmlFor="file-input"
                          className="flex cursor-pointer items-center gap-2"
                        >
                          <Plus className="size-5 text-gray-600" />
                          <span className="text-sm text-gray-600">
                            Upload PDF or Image
                          </span>
                        </Label>
                        <input
                          id="file-input"
                          type="file"
                          onChange={handleFileUpload}
                          multiple
                          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                          className="hidden"
                        />
                        {stream.isLoading ? (
                          <Button
                            key="stop"
                            onClick={() => {
                              stream.stop();
                              toast("Generation stopped", { duration: 1500 });
                            }}
                            className="ml-auto"
                            variant="destructive"
                          >
                            <Square className="h-4 w-4" />
                            Stop
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            className="ml-auto shadow-md transition-all"
                            disabled={
                              isLoading ||
                              (!input.trim() && contentBlocks.length === 0)
                            }
                          >
                            Send
                          </Button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              }
            />
          </StickToBottom>
        </motion.div>
        <div className={cn("relative flex flex-col border-l", !casePanelOpen && "hidden")}>
          <div className="absolute inset-0 flex min-w-[30vw] flex-col">
            <div className="grid grid-cols-[1fr_auto] border-b p-4">
              <div className="truncate overflow-hidden text-sm font-semibold">Thread Summary</div>
              <button
                onClick={() => setCasePanelOpen(false)}
                className="cursor-pointer"
              >
                <XIcon className="size-5" />
              </button>
            </div>
            <CasePanel className="flex-grow" />
          </div>
        </div>

        <div className={cn("relative flex flex-col border-l", !artifactOpen && "hidden")}>
          <div className="absolute inset-0 flex min-w-[30vw] flex-col">
            <div className="grid grid-cols-[1fr_auto] border-b p-4">
              <ArtifactTitle className="truncate overflow-hidden" />
              <button
                onClick={closeArtifact}
                className="cursor-pointer"
              >
                <XIcon className="size-5" />
              </button>
            </div>
            <ArtifactContent className="relative flex-grow" />
          </div>
        </div>
      </div>
    </div>
  );
}
