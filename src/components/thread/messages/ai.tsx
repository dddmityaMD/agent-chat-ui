/**
 * ai.tsx — Slim entry point for AI message components.
 *
 * Exports AssistantMessage and AssistantMessageLoading.
 * Sub-components live in ai-decorations, ai-historical, ai-cards, ai-helpers.
 */

import React from "react";
import { useStreamContext } from "@/providers/Stream";
import { AIMessage, Message } from "@langchain/langgraph-sdk";
import { getContentString } from "../utils";
import { BranchSwitcher, CommandBar } from "./shared";
import { ToolCalls, ToolResult } from "./tool-calls";
import { cn } from "@/lib/utils";
import { useQueryState, parseAsBoolean } from "nuqs";
import type { ThoughtStage, StreamingStateValues } from "@/lib/message-groups";
import { parseAnthropicStreamedToolCalls } from "./ai-helpers";
import { CustomComponent, Interrupt } from "./ai-cards";
import { LastMessageDecorations } from "./ai-decorations";
import { HistoricalMessageContent } from "./ai-historical";

export function AssistantMessage({
  message,
  isLoading,
  handleRegenerate,
  stages,
  nextHumanMessage,
  streamingValues,
}: {
  message: Message | undefined;
  isLoading: boolean;
  handleRegenerate: (parentCheckpoint: unknown) => void;
  /** Thought stages derived from preceding intermediate messages (UAT-4) */
  stages?: ThoughtStage[];
  /** The next human message after this one (for disambiguation selection tracking) */
  nextHumanMessage?: Message;
  /** Live streaming state values — only passed to the last message during streaming */
  streamingValues?: StreamingStateValues;
}) {
  const content = message?.content ?? [];
  const contentString = getContentString(content);
  const [hideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false),
  );

  const thread = useStreamContext();
  const isLastMessage =
    thread.messages.length > 0 &&
    thread.messages[thread.messages.length - 1].id === message?.id;
  const hasNoAIOrToolMessages = !thread.messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );
  const meta = message ? thread.getMessagesMetadata(message) : undefined;
  const threadInterrupt = thread.interrupt;

  const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;
  const anthropicStreamedToolCalls = Array.isArray(content)
    ? parseAnthropicStreamedToolCalls(content)
    : undefined;

  const hasToolCalls =
    message &&
    "tool_calls" in message &&
    message.tool_calls &&
    message.tool_calls.length > 0;
  const toolCallsHaveContents =
    hasToolCalls &&
    message.tool_calls?.some(
      (tc) => tc.args && Object.keys(tc.args).length > 0,
    );
  const hasAnthropicToolCalls = !!anthropicStreamedToolCalls?.length;
  const isToolResult = message?.type === "tool";

  // Extract response_metadata for per-message data (metadata grids, disambiguation)
  const msgResponseMeta = message && "response_metadata" in message
    ? (message as AIMessage).response_metadata
    : undefined;

  if (isToolResult && hideToolCalls) {
    return null;
  }

  return (
    <div className="group mr-auto flex w-full items-start gap-2" data-testid="ai-message">
      <div className="flex w-full flex-col gap-2">
        {isToolResult ? (
          <>
            <ToolResult message={message} />
            <Interrupt
              interrupt={threadInterrupt}
              isLastMessage={isLastMessage}
              hasNoAIOrToolMessages={hasNoAIOrToolMessages}
            />
          </>
        ) : (
          <>
            {/* Only the last message renders sais_ui-dependent decorations.
                Historical messages render content only (no useSaisUi subscription),
                preventing re-renders when new stream data arrives (UX-05). */}
            {isLastMessage ? (
              <LastMessageDecorations
                message={message}
                contentString={contentString}
                isLoading={isLoading}
                msgResponseMeta={msgResponseMeta as Record<string, unknown> | undefined}
                stages={stages}
                streamingValues={streamingValues}
              />
            ) : (
              <HistoricalMessageContent
                message={message}
                contentString={contentString}
                msgResponseMeta={msgResponseMeta as Record<string, unknown> | undefined}
                stages={stages}
                nextHumanMessage={nextHumanMessage}
              />
            )}

            {/* Tool calls: show inline only when no stages are available (fallback) */}
            {!(stages && stages.length > 0) && !hideToolCalls && (hasToolCalls || hasAnthropicToolCalls) && (() => {
              const toolCalls = (hasToolCalls && toolCallsHaveContents)
                ? message.tool_calls
                : hasAnthropicToolCalls
                  ? anthropicStreamedToolCalls
                  : undefined;
              if (!toolCalls || toolCalls.length === 0) return null;
              return (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Internal discussion ({toolCalls.length})
                  </summary>
                  <div className="mt-1 space-y-1">
                    <ToolCalls toolCalls={toolCalls} />
                  </div>
                </details>
              );
            })()}

            {message && (
              <CustomComponent
                message={message}
                thread={thread}
              />
            )}
            <Interrupt
              interrupt={threadInterrupt}
              isLastMessage={isLastMessage}
              hasNoAIOrToolMessages={hasNoAIOrToolMessages}
            />
            <div
              className={cn(
                "mr-auto flex items-center gap-2 transition-opacity",
                "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
              )}
            >
              <BranchSwitcher
                branch={meta?.branch}
                branchOptions={meta?.branchOptions}
                onSelect={(branch) => thread.setBranch(branch)}
                isLoading={isLoading}
              />
              <CommandBar
                content={contentString}
                isLoading={isLoading}
                isAiMessage={true}
                handleRegenerate={() => handleRegenerate(parentCheckpoint)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AssistantMessageLoading() {
  return (
    <div className="mr-auto flex items-start gap-2">
      <div className="bg-muted flex h-8 items-center gap-1 rounded-2xl px-4 py-2">
        <div className="bg-foreground/50 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full"></div>
        <div className="bg-foreground/50 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_0.5s_infinite] rounded-full"></div>
        <div className="bg-foreground/50 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_1s_infinite] rounded-full"></div>
      </div>
    </div>
  );
}
