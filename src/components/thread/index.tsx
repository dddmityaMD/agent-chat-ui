/**
 * thread/index.tsx — Main Thread component.
 *
 * Sub-components extracted to:
 *   scroll.tsx — StickyToBottomContent, ScrollToBottom, NewMessagesDetector
 *   thread-header.tsx — EditableThreadTitle
 *   use-current-turn-delta.ts — useCurrentTurnDelta hook
 *   message-error-boundary.tsx — MessageErrorBoundary
 */

import { v4 as uuidv4 } from "uuid";
import { useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { useState, useCallback, FormEvent } from "react";
import { Button } from "../ui/button";
import { Message } from "@langchain/langgraph-sdk";
import { AssistantMessage } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import {
  DO_NOT_RENDER_ID_PREFIX,
  ensureToolCallsHaveResponses,
} from "@/lib/ensure-tool-responses";
import { groupMessages, deriveStagesFromFlow, deriveStageDetails, applyStageDetails, computeDataDrivenReveal, computeDynamicStageReveal, inferFlowFromIntent, extractFlowFromResponseMeta, type StreamingStateValues } from "@/lib/message-groups";
import { ThinkingIndicator } from "@/components/thread/thought-process-pane";
import { SaisLogoSVG } from "../icons/langgraph";
import { CasePanel } from "@/components/case-panel";
import { TooltipIconButton } from "./tooltip-icon-button";
import {
  AlertTriangle,
  PanelRightOpen,
  PanelRightClose,
  RotateCcw,
  Square,
  XIcon,
  Pencil,
  Plus,
} from "lucide-react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { StickToBottom } from "use-stick-to-bottom";
import ThreadHistory from "./history";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
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
import { SaisThreadClient } from "@/lib/sais-stream/thread-client";
import { useSaisUi } from "@/hooks/useSaisUi";
import { LogoutButton } from "@/components/logout-button";
import { SettingsButton } from "@/components/settings-button";
import { BudgetIndicator } from "@/components/header/budget-indicator";
import { EmptyState } from "./empty-state";

// Sub-components extracted from this file
import { MessageErrorBoundary } from "./message-error-boundary";
import { StickyToBottomContent, ScrollToBottom, NewMessagesDetector } from "./scroll";
import { EditableThreadTitle } from "./thread-header";
import { useCurrentTurnDelta } from "./use-current-turn-delta";

// Command palette and keyboard shortcuts (Phase 38.17-04)
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { useGlobalShortcuts } from "@/hooks/use-keyboard-shortcuts";

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
  // Optimistic human message: shown immediately on submit so the loading
  // dots appear below it, not below the previous AI message.  Cleared once
  // the message shows up in stream.messages (by ID match).
  const [pendingHumanMessage, setPendingHumanMessage] = useState<Message | null>(null);
  // Track the current turn's human message ID for the entire streaming duration.
  const currentTurnIdRef = useRef<string | null>(null);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const [casePanelOpen, setCasePanelOpen] = useQueryState(
    "casePanelOpen",
    parseAsBoolean.withDefault(true),
  );

  const stream = useStreamContext();
  const isLoading = stream.isLoading;
  const saisUiData = useSaisUi();

  // Messages come from REST via useSaisStream hook (Phase 23.4).
  const messages = stream.messages;

  // Clear turn ID ref on streaming->idle transition
  const prevStreamingRef = useRef(false);
  const preStreamLastMsgIdRef = useRef<string | null>(null);
  if (isLoading && !prevStreamingRef.current) {
    const lastMsg = messages[messages.length - 1];
    preStreamLastMsgIdRef.current = lastMsg?.id ?? null;

    if (!currentTurnIdRef.current) {
      const lastHuman = [...messages].reverse().find(m => m.type === "human");
      if (lastHuman?.id) {
        console.debug("[Thread] rejoin: setting currentTurnIdRef to last human message:", lastHuman.id);
        currentTurnIdRef.current = lastHuman.id;
      }
    }
  }
  if (!isLoading && prevStreamingRef.current) {
    currentTurnIdRef.current = null;
    preStreamLastMsgIdRef.current = null;
  }
  prevStreamingRef.current = isLoading;

  // Filter streaming values: turn_id gate + baseline delta to exclude stale data
  const rawStreamValues = (stream.values ?? {}) as StreamingStateValues;
  const currentTurnId = currentTurnIdRef.current;
  const currentTurnValues = useCurrentTurnDelta(rawStreamValues, currentTurnId);

  // Group messages into renderable units (UAT-4: thought process pane).
  const messageGroups = useMemo(
    () => groupMessages(
      messages.filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX)),
      {
        isStreaming: isLoading,
        saisUi: saisUiData.raw as Record<string, unknown> | null,
      },
    ),
    [messages, isLoading, saisUiData.raw],
  );

  // Sync permission grants from backend sais_ui state to local React state.
  const wasLoadingRef = useRef(false);
  useEffect(() => {
    if (isLoading) {
      wasLoadingRef.current = true;
      return;
    }
    if (!wasLoadingRef.current) return;
    wasLoadingRef.current = false;

    const backendGrants = saisUiData.permissionGrants;

    clearPermissionGrants();
    for (const g of backendGrants) {
      if (g && typeof g === "object" && "capability" in g) {
        addPermissionGrant(g as import("@/lib/types").PermissionGrant);
      }
    }

    getThreads().then(setThreads).catch(console.error);
  }, [isLoading, saisUiData.permissionGrants, clearPermissionGrants, addPermissionGrant, getThreads, setThreads]);

  const lastError = useRef<string | undefined>(undefined);

  const setThreadId = (id: string | null) => {
    _setThreadId(id);
    clearPermissionGrants();

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
        return;
      }

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if ((input.trim().length === 0 && contentBlocks.length === 0) || isLoading || hasActiveInterrupt)
      return;
    const newHumanMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: [
        ...(input.trim().length > 0 ? [{ type: "text", text: input }] : []),
        ...contentBlocks,
      ] as Message["content"],
    };

    setPendingHumanMessage(newHumanMessage);
    currentTurnIdRef.current = newHumanMessage.id ?? null;

    const toolMessages = ensureToolCallsHaveResponses(stream.messages);

    const context =
      Object.keys(artifactContext).length > 0 ? artifactContext : undefined;

    stream.submit(
      {
        messages: [...stream.messages, ...toolMessages, newHumanMessage],
        context,
      },
      {
        optimisticValues: (prev) => ({
          ...prev,
          context,
          messages: [
            ...((prev.messages ?? []) as Message[]),
            ...toolMessages,
            newHumanMessage,
          ],
        }),
      },
    );

    setInput("");
    setContentBlocks([]);
  };

  const handleRegenerate = useCallback(
    (parentCheckpoint: unknown) => {
      stream.submit(undefined, {
        checkpoint: parentCheckpoint,
      });
    },
    [stream.submit],
  );

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

    const retryMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: [{ type: "text", text }] as Message["content"],
    };
    setPendingHumanMessage(retryMessage);
    currentTurnIdRef.current = retryMessage.id ?? null;

    const toolMessages = ensureToolCallsHaveResponses(stream.messages);
    stream.submit(
      { messages: [...stream.messages, ...toolMessages, retryMessage] },
      {
        optimisticValues: (prev) => ({
          ...prev,
          messages: [...((prev.messages ?? []) as Message[]), ...toolMessages, retryMessage],
        }),
      },
    );
  };

  /** Edit & Retry: place the last user message text in the input for editing. */
  const handleEditRetry = () => {
    const text = getLastUserMessageText();
    if (!text) return;
    setInput(text);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  // Stable thread client ref for explicit thread creation (workspace Start thread)
  const threadClientRef = useRef<SaisThreadClient | null>(null);
  if (!threadClientRef.current) {
    const langgraphUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:2024";
    threadClientRef.current = new SaisThreadClient(
      langgraphUrl,
      (input, init) => fetch(input, { ...init, credentials: "include" }),
    );
  }

  const { registerThread } = useThreads();

  const handleStartThread = useCallback(async (projectId: string) => {
    const client = threadClientRef.current;
    if (!client) return;
    // 1. Create thread via LangGraph API
    const { thread_id: newId } = await client.createThread();
    // 2. Register with project_id via SAIS backend
    const registered = await registerThread(newId, undefined, undefined, projectId);
    // 3. Optimistically add thread to list so currentThread is immediately available
    if (registered) {
      setThreads((prev) => [registered, ...prev.filter((t) => t.thread_id !== registered.thread_id)]);
    }
    // 4. Set active thread via URL param (nuqs)
    setThreadId(newId);
  }, [registerThread, setThreadId, setThreads]);

  const chatStarted = !!threadId || !!messages.length;
  const hasNoAIOrToolMessages = !messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );

  // Detect active interrupt
  const hasActiveInterrupt = !!stream.interrupt;

  // "New messages" indicator
  const [hasNewMessages, setHasNewMessages] = useState(false);

  // Command palette state (Phase 38.17-04)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Map threads for command palette (thread_id -> id)
  const paletteThreads = useMemo(
    () =>
      threads
        .filter((t) => !t.is_archived)
        .slice(0, 10)
        .map((t) => ({
          id: t.thread_id,
          title: t.title || t.last_message_preview?.slice(0, 60) || "Untitled",
        })),
    [threads],
  );

  // Global keyboard shortcuts
  useGlobalShortcuts({
    onFocusInput: () => textareaRef.current?.focus(),
    onToggleCasePanel: () => setCasePanelOpen((p) => !p),
    onToggleEvidence: () => {
      setCasePanelOpen(true);
      setCasePanelSection("evidence");
    },
    onApproveInterrupt: () => {
      // If there's an active interrupt, approve it
      if (hasActiveInterrupt && stream.interrupt) {
        stream.submit(
          { messages: [...stream.messages, { id: uuidv4(), type: "human", content: "approved" }] },
        );
      }
    },
  });

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Command Palette (Phase 38.17-04) */}
      <CommandPalette
        open={commandPaletteOpen}
        setOpen={setCommandPaletteOpen}
        threads={paletteThreads}
        onNewThread={() => setThreadId(null)}
        onSelectThread={(id) => setThreadId(id)}
        onToggleCasePanel={() => setCasePanelOpen((p) => !p)}
        onFocusInput={() => textareaRef.current?.focus()}
        onSlashCommand={(cmd) => {
          setInput(cmd + " ");
          setTimeout(() => textareaRef.current?.focus(), 0);
        }}
      />

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
          !artifactOpen && casePanelOpen && "grid-cols-[3fr_2fr_0fr]",
          !artifactOpen && !casePanelOpen && "grid-cols-[1fr_0fr_0fr]",
          artifactOpen && casePanelOpen && "grid-cols-[2fr_1fr_1fr]",
          artifactOpen && !casePanelOpen && "grid-cols-[2fr_0fr_1fr]",
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
                    <SaisLogoSVG
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
                <TooltipIconButton
                  size="lg"
                  className="p-4"
                  tooltip={casePanelOpen ? "Hide workspace" : "Show workspace"}
                  variant="ghost"
                  onClick={() => setCasePanelOpen((p) => !p)}
                >
                  {casePanelOpen ? (
                    <PanelRightClose className="size-5" />
                  ) : (
                    <PanelRightOpen className="size-5" />
                  )}
                </TooltipIconButton>
              </div>

              <div className="from-background to-background/0 absolute inset-x-0 top-full h-5 bg-gradient-to-b" />
            </div>
          )}

          <StickToBottom className="relative flex-1 overflow-hidden">
            <NewMessagesDetector
              messageCount={messages.length}
              onNewMessages={useCallback(() => setHasNewMessages(true), [])}
              onAtBottom={useCallback(() => setHasNewMessages(false), [])}
            />
            <StickyToBottomContent
              className={cn(
                "absolute inset-0 overflow-y-scroll px-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent",
                !chatStarted && "mt-[25vh] flex flex-col items-stretch",
                chatStarted && "grid grid-rows-[1fr_auto]",
              )}
              contentClassName="pt-8 pb-16 max-w-3xl mx-auto flex flex-col gap-4 w-full"
              content={
                <>
                  {messageGroups.map((group, index) => (
                      <MessageErrorBoundary key={group.message.id || `${group.message.type}-${index}`}>
                        {group.message.type === "human" ? (
                          <HumanMessage
                            message={group.message}
                            isLoading={isLoading}
                          />
                        ) : (
                          <AssistantMessage
                            message={group.message}
                            isLoading={isLoading}
                            handleRegenerate={handleRegenerate}
                            stages={group.stages}
                            nextHumanMessage={group.nextHumanMessage}
                            streamingValues={isLoading && index === messageGroups.length - 1 ? currentTurnValues : undefined}
                          />
                        )}
                      </MessageErrorBoundary>
                    ))}
                  {/* Optimistic human message */}
                  {pendingHumanMessage &&
                    !messages.some((m) => m.id === pendingHumanMessage.id) && (
                      <MessageErrorBoundary key={pendingHumanMessage.id}>
                        <HumanMessage
                          message={pendingHumanMessage}
                          isLoading={isLoading}
                        />
                      </MessageErrorBoundary>
                    )}
                  {/* Special rendering case: no AI/tool messages, but there is an interrupt */}
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
                  {isLoading && (() => {
                    const lastGroup = messageGroups[messageGroups.length - 1];
                    const lastIsAi = lastGroup && lastGroup.message.type === "ai";
                    const lastIsIntermediate = lastIsAi && lastGroup.stages.length === 0
                      && extractFlowFromResponseMeta(lastGroup.message) === null;
                    const lastIsPreStream = lastIsAi
                      && !!preStreamLastMsgIdRef.current
                      && lastGroup.message.id === preStreamLastMsgIdRef.current;
                    const hasFinalResponse = lastIsAi && !lastIsIntermediate && !lastIsPreStream;
                    if (!hasFinalResponse) {
                      const hasLiveData = Object.keys(currentTurnValues).length > 0;
                      const effectiveValues = hasLiveData ? currentTurnValues : rawStreamValues;
                      const streamFlow = effectiveValues.active_methodology || inferFlowFromIntent(effectiveValues.intent) || saisUiData.methodologyType;
                      const streamSaisUi = (effectiveValues.sais_ui ?? saisUiData.raw) as Record<string, unknown> | undefined;
                      const streamingStages = deriveStagesFromFlow(streamFlow, streamSaisUi);
                      const stageDetails = deriveStageDetails(effectiveValues);
                      const enrichedStages = applyStageDetails(streamingStages, stageDetails);
                      const dynamicReveal = computeDynamicStageReveal(streamSaisUi, streamingStages);
                      const staticReveal = computeDataDrivenReveal(effectiveValues, streamingStages);
                      const minReveal = Math.max(dynamicReveal, staticReveal);
                      console.debug("[ThinkingIndicator] currentTurnId:", currentTurnId, "| hasLiveData:", hasLiveData,
                        "| usingRawFallback:", !hasLiveData, "| dynamicReveal:", dynamicReveal, "| staticReveal:", staticReveal,
                        "| minReveal:", minReveal, "| stages:", enrichedStages.length, "| flow:", streamFlow);
                      return <ThinkingIndicator stages={enrichedStages} minRevealCount={minReveal} isPaused={hasActiveInterrupt} />;
                    }
                    return null;
                  })()}
                  {/* Inline error indicator */}
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
                      <h1 className="text-2xl font-semibold tracking-tight">
                        SAIS DataBI
                      </h1>
                      <EmptyState onSelect={setInput} />
                    </div>
                  )}

                  <ScrollToBottom
                    className="animate-in fade-in-0 zoom-in-95 absolute bottom-full left-1/2 mb-4 -translate-x-1/2"
                    hasNewMessages={hasNewMessages}
                    onScrollToBottom={() => setHasNewMessages(false)}
                  />

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
                        placeholder={
                          !threadId
                            ? "Select a project and start a thread to begin."
                            : hasActiveInterrupt
                              ? "Approve or reject the pending decision to continue."
                              : "Type your message..."
                        }
                        disabled={hasActiveInterrupt || !threadId}
                        className={cn(
                          "field-sizing-content resize-none border-none bg-transparent p-3.5 pb-0 shadow-none ring-0 outline-none focus:ring-0 focus:outline-none",
                          (hasActiveInterrupt || !threadId) && "cursor-not-allowed opacity-50",
                        )}
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
                              hasActiveInterrupt ||
                              !threadId ||
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
        <div className="relative flex flex-col border-l">
          <div className="absolute inset-0 flex min-w-[30vw] flex-col">
            <div className="grid grid-cols-[1fr_auto] border-b p-4">
              <div className="truncate overflow-hidden text-sm font-semibold">
                {threadId ? "Thread Summary" : "Workspace"}
              </div>
            </div>
            <CasePanel
              className="flex-grow"
              threadId={threadId}
              onStartThread={handleStartThread}
              currentThread={currentThread}
            />
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
