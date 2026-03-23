/**
 * ai.tsx — Slim entry point for AI message components.
 *
 * Exports AssistantMessage and AssistantMessageLoading.
 * Sub-components live in ai-decorations, ai-historical, ai-cards, ai-helpers.
 */

import React from "react";
import { useStreamContext } from "@/providers/Stream";
import { AIMessage, Message, ToolMessage } from "@langchain/langgraph-sdk";
import { getContentString } from "../utils";
import { BranchSwitcher, CommandBar } from "./shared";
import { ToolResult } from "./tool-calls";
import { cn } from "@/lib/utils";
import { useQueryState, parseAsBoolean } from "nuqs";
import type { ThoughtStage, StreamingStateValues, ToolInteraction } from "@/lib/message-groups";
import { parseAnthropicStreamedToolCalls } from "./ai-helpers";
import { CustomComponent, Interrupt } from "./ai-cards";
import { LastMessageDecorations } from "./ai-decorations";
import { HistoricalMessageContent } from "./ai-historical";

function formatToolSectionLabel(displayName: string | undefined, toolCount: number): string {
  const suffix = `${toolCount} tool${toolCount !== 1 ? "s" : ""}`;
  return displayName ? `${displayName} (${suffix})` : suffix;
}

export function AssistantMessage({
  message,
  isLoading,
  handleRegenerate,
  stages,
  nextHumanMessage,
  streamingValues,
  toolInteractions,
  methodologyDisplayName,
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
  /** Collected tool interactions from intermediate messages in this turn */
  toolInteractions?: ToolInteraction[];
  /** Backend-provided display name for the methodology */
  methodologyDisplayName?: string;
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

  // Extract response_metadata for per-message data (metadata grids, disambiguation)
  const msgResponseMeta =
    message && "response_metadata" in message
      ? (message as AIMessage).response_metadata
      : undefined;

  return (
    <div
      className="group mr-auto flex w-full items-start gap-2"
      data-testid="ai-message"
    >
      <div className="flex w-full flex-col gap-2">
        {/* Tool interactions — one unified "Internal discussion" section */}
        {!hideToolCalls &&
          toolInteractions &&
          toolInteractions.length > 0 && (
            <details className="w-full">
              <summary className="text-muted-foreground cursor-pointer text-xs">
                {formatToolSectionLabel(methodologyDisplayName, toolInteractions.length)}
              </summary>
              <div className="mt-1 space-y-1">
                {toolInteractions.map((ti, idx) =>
                  ti.result ? (
                    <ToolResult
                      key={ti.result.id ?? idx}
                      message={ti.result as ToolMessage}
                      toolName={ti.toolName}
                    />
                  ) : (
                    <div
                      key={idx}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md",
                        "border border-border/60 bg-muted/20 px-3 py-1.5",
                        "text-xs text-muted-foreground",
                      )}
                    >
                      <code className="font-mono text-foreground/80">
                        {ti.toolName}
                      </code>
                      <span className="text-muted-foreground/50">
                        (no result)
                      </span>
                    </div>
                  ),
                )}
              </div>
            </details>
          )}

        {/* Message content */}
        <>
          {/* Only the last message renders sais_ui-dependent decorations.
              Historical messages render content only (no useSaisUi subscription),
              preventing re-renders when new stream data arrives (UX-05). */}
          {isLastMessage ? (
            <LastMessageDecorations
              message={message}
              contentString={contentString}
              isLoading={isLoading}
              msgResponseMeta={
                msgResponseMeta as Record<string, unknown> | undefined
              }
              stages={stages}
              streamingValues={streamingValues}
            />
          ) : (
            <HistoricalMessageContent
              message={message}
              contentString={contentString}
              msgResponseMeta={
                msgResponseMeta as Record<string, unknown> | undefined
              }
              stages={stages}
              nextHumanMessage={nextHumanMessage}
            />
          )}

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
