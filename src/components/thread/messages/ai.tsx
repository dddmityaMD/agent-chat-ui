import { parsePartialJson } from "@langchain/core/output_parsers";
import { useStreamContext } from "@/providers/Stream";
import { AIMessage, Checkpoint, Message } from "@langchain/langgraph-sdk";
import { getContentString } from "../utils";
import { BranchSwitcher, CommandBar } from "./shared";
import { MarkdownText } from "../markdown-text";
import { LoadExternalComponent } from "@langchain/langgraph-sdk/react-ui";
import { cn } from "@/lib/utils";
import { ToolCalls, ToolResult } from "./tool-calls";
import { MessageContentComplex } from "@langchain/core/messages";
import { Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { isAgentInboxInterruptSchema } from "@/lib/agent-inbox-interrupt";
import { ThreadView } from "../agent-inbox";
import { useQueryState, parseAsBoolean } from "nuqs";
import { GenericInterruptView } from "./generic-interrupt";
import { useArtifact } from "../artifact";
import { QueryResults, EntityType } from "@/components/query";
import { FlowBadge } from "@/components/flow-indicator/FlowBadge";
import { BatchReview } from "@/components/remediation/BatchReview";
import type { RemediationProposalData } from "@/components/remediation/DiffCard";
import { BlockerMessage } from "../blocker-message";
import { MultiIntentResult } from "../multi-intent-result";
import { ConfidenceBadge } from "../confidence-badge";
import type { Blocker, MultiIntentPayload } from "@/lib/types";
import { ArrowRightLeft, X } from "lucide-react";
import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePermissionState } from "@/providers/Thread";
import type { PermissionGrant } from "@/lib/types";
import { ClarificationCard, getClarification } from "../clarification-card";

// Type for metadata_results from sais_ui payload
interface MetadataResults {
  entity_type: EntityType;
  items: Array<Record<string, unknown>>;
  total: number;
}

// Type for handoff proposal from sais_ui payload
interface HandoffProposal {
  target_flow: string;
  reason: string;
  confirmed: boolean;
}

// Flow display names for handoff UI
const FLOW_DISPLAY_NAMES: Record<string, string> = {
  catalog: "Catalog",
  investigation: "Investigation",
  remediation: "Remediation",
  ops: "Operations",
};

// Type guard for sais_ui payload
function hasMetadataResults(
  saisUi: unknown
): saisUi is { metadata_results: MetadataResults } {
  if (!saisUi || typeof saisUi !== "object") return false;
  const obj = saisUi as Record<string, unknown>;
  if (!obj.metadata_results || typeof obj.metadata_results !== "object")
    return false;
  const mr = obj.metadata_results as Record<string, unknown>;
  return (
    typeof mr.entity_type === "string" &&
    Array.isArray(mr.items) &&
    typeof mr.total === "number"
  );
}

// Extract active_flow from sais_ui
function getActiveFlow(saisUi: unknown): string | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const obj = saisUi as Record<string, unknown>;
  const flow = obj.active_flow;
  return typeof flow === "string" && flow.length > 0 ? flow : null;
}

// Extract handoff proposal from sais_ui
function getHandoffProposal(saisUi: unknown): HandoffProposal | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const obj = saisUi as Record<string, unknown>;
  const handoff = obj.handoff;
  if (!handoff || typeof handoff !== "object") return null;
  const h = handoff as Record<string, unknown>;
  if (typeof h.target_flow !== "string") return null;
  return {
    target_flow: h.target_flow,
    reason: typeof h.reason === "string" ? h.reason : "",
    confirmed: h.confirmed === true,
  };
}

// Extract remediation proposals from sais_ui
function getRemediationProposals(saisUi: unknown): RemediationProposalData[] | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const obj = saisUi as Record<string, unknown>;
  const proposals = obj.remediation_proposals;
  if (!Array.isArray(proposals) || proposals.length === 0) return null;
  // Validate that each proposal has required fields
  const valid = proposals.every(
    (p: unknown) =>
      p &&
      typeof p === "object" &&
      typeof (p as Record<string, unknown>).fix_id === "string" &&
      typeof (p as Record<string, unknown>).title === "string"
  );
  return valid ? (proposals as RemediationProposalData[]) : null;
}

// Extract blockers from sais_ui
function getBlockers(saisUi: unknown): Blocker[] | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const obj = saisUi as Record<string, unknown>;
  const blockers = obj.blockers;
  if (!Array.isArray(blockers) || blockers.length === 0) return null;
  // Validate each blocker has required fields
  const valid = blockers.every(
    (b: unknown) =>
      b &&
      typeof b === "object" &&
      typeof (b as Record<string, unknown>).type === "string" &&
      typeof (b as Record<string, unknown>).severity === "string" &&
      typeof (b as Record<string, unknown>).message === "string"
  );
  return valid ? (blockers as Blocker[]) : null;
}

// Extract confidence data from sais_ui
function getConfidenceData(saisUi: unknown): { level: "high" | "medium" | "low"; reason?: string } | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const obj = saisUi as Record<string, unknown>;
  const confidence = obj.confidence;
  if (!confidence || typeof confidence !== "object") return null;
  const c = confidence as Record<string, unknown>;
  if (typeof c.level !== "string") return null;
  const level = c.level.toLowerCase();
  if (level !== "high" && level !== "medium" && level !== "low") return null;
  return {
    level: level as "high" | "medium" | "low",
    reason: typeof c.reason === "string" ? c.reason : undefined,
  };
}

// Extract multi-intent payload from sais_ui
function getMultiIntentPayload(saisUi: unknown): MultiIntentPayload | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const obj = saisUi as Record<string, unknown>;
  const mi = obj.multi_intent;
  if (!mi || typeof mi !== "object") return null;
  const payload = mi as Record<string, unknown>;
  // Validate required fields
  if (!Array.isArray(payload.intents) || !Array.isArray(payload.results)) return null;
  // Only show if multiple intents (single intent = no decomposition UI)
  if (payload.intents.length < 2) return null;
  return {
    intents: payload.intents as MultiIntentPayload["intents"],
    results: payload.results as MultiIntentPayload["results"],
    was_parallel: payload.was_parallel === true,
    merged_output: (payload.merged_output as Record<string, unknown>) || {},
  };
}

function CustomComponent({
  message,
  thread,
}: {
  message: Message;
  thread: ReturnType<typeof useStreamContext>;
}) {
  const artifact = useArtifact();
  const { values } = useStreamContext();
  const customComponents = values.ui?.filter(
    (ui) => ui.metadata?.message_id === message.id,
  );

  if (!customComponents?.length) return null;
  return (
    <Fragment key={message.id}>
      {customComponents.map((customComponent) => (
        <LoadExternalComponent
          key={customComponent.id}
          stream={thread}
          message={customComponent}
          meta={{ ui: customComponent, artifact }}
        />
      ))}
    </Fragment>
  );
}

function parseAnthropicStreamedToolCalls(
  content: MessageContentComplex[],
): AIMessage["tool_calls"] {
  const toolCallContents = content.filter((c) => c.type === "tool_use" && c.id);

  return toolCallContents.map((tc) => {
    const toolCall = tc as Record<string, any>;
    let json: Record<string, any> = {};
    if (toolCall?.input) {
      try {
        json = parsePartialJson(toolCall.input) ?? {};
      } catch {
        // Pass
      }
    }
    return {
      name: toolCall.name ?? "",
      id: toolCall.id ?? "",
      args: json,
      type: "tool_call",
    };
  });
}

interface InterruptProps {
  interrupt?: unknown;
  isLastMessage: boolean;
  hasNoAIOrToolMessages: boolean;
}

function Interrupt({
  interrupt,
  isLastMessage,
  hasNoAIOrToolMessages,
}: InterruptProps) {
  const fallbackValue = Array.isArray(interrupt)
    ? (interrupt as Record<string, any>[])
    : (((interrupt as { value?: unknown } | undefined)?.value ??
        interrupt) as Record<string, any>);

  return (
    <>
      {isAgentInboxInterruptSchema(interrupt) &&
        (isLastMessage || hasNoAIOrToolMessages) && (
          <ThreadView interrupt={interrupt} />
        )}
      {interrupt &&
      !isAgentInboxInterruptSchema(interrupt) &&
      (isLastMessage || hasNoAIOrToolMessages) ? (
        <GenericInterruptView interrupt={fallbackValue} />
      ) : null}
    </>
  );
}

/**
 * HandoffConfirmationCard - shows when a flow proposes a handoff to another flow.
 * User must explicitly confirm or decline the transition.
 */
function HandoffConfirmationCard({
  handoff,
  currentFlow,
  onConfirm,
  onDismiss,
  dismissed,
}: {
  handoff: HandoffProposal;
  currentFlow: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
  dismissed: boolean;
}) {
  if (dismissed || handoff.confirmed) return null;

  const targetName =
    FLOW_DISPLAY_NAMES[handoff.target_flow] || handoff.target_flow;
  const currentName = currentFlow
    ? FLOW_DISPLAY_NAMES[currentFlow] || currentFlow
    : "current flow";

  return (
    <div
      className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950"
      data-testid="handoff-confirmation"
    >
      <div className="mb-2 flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Flow transition suggested
        </span>
      </div>
      <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">
        {currentName} suggests switching to{" "}
        <strong>{targetName}</strong>
        {handoff.reason ? `: ${handoff.reason}` : "."}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
          data-testid="handoff-confirm"
        >
          <ArrowRightLeft className="h-3 w-3" />
          Switch to {targetName}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-300 dark:hover:bg-amber-800"
          data-testid="handoff-dismiss"
        >
          <X className="h-3 w-3" />
          Stay in {currentName}
        </button>
      </div>
    </div>
  );
}

export function AssistantMessage({
  message,
  isLoading,
  handleRegenerate,
}: {
  message: Message | undefined;
  isLoading: boolean;
  handleRegenerate: (parentCheckpoint: Checkpoint | null | undefined) => void;
}) {
  const content = message?.content ?? [];
  const contentString = getContentString(content);
  const [hideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false),
  );
  const [handoffDismissed, setHandoffDismissed] = useState(false);

  const thread = useStreamContext();
  const { addPermissionGrant, revokePermissionGrant } = usePermissionState();
  const isLastMessage =
    thread.messages[thread.messages.length - 1].id === message?.id;
  const hasNoAIOrToolMessages = !thread.messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );
  const meta = message ? thread.getMessagesMetadata(message) : undefined;
  const threadInterrupt = thread.interrupt;

  // Extract metadata_results: prefer per-message data, fall back to thread state for last message
  const msgResponseMeta = message && "response_metadata" in message
    ? (message as AIMessage).response_metadata
    : undefined;
  const msgMetadataResults = msgResponseMeta && typeof msgResponseMeta === "object" && "metadata_results" in msgResponseMeta
    ? (msgResponseMeta as Record<string, unknown>).metadata_results
    : null;
  const saisUi = thread.values?.sais_ui;
  const metadataResults = (msgMetadataResults && hasMetadataResults({ metadata_results: msgMetadataResults }))
    ? (msgMetadataResults as MetadataResults)
    : (isLastMessage && hasMetadataResults(saisUi) ? saisUi.metadata_results : null);

  // Extract flow information from sais_ui (only for last message to avoid stale badges)
  const activeFlow = isLastMessage ? getActiveFlow(saisUi) : null;
  const handoffProposal = isLastMessage ? getHandoffProposal(saisUi) : null;
  const remediationProposals = isLastMessage ? getRemediationProposals(saisUi) : null;
  const blockers = isLastMessage ? getBlockers(saisUi) : null;
  const multiIntentPayload = isLastMessage ? getMultiIntentPayload(saisUi) : null;
  const clarificationData = isLastMessage ? getClarification(saisUi) : null;
  // Confidence data: extract from sais_ui for last message (structured source)
  const confidenceData = isLastMessage ? getConfidenceData(saisUi) : null;

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

  // Handle handoff confirmation: SDK v1.3.0+ auto-queues submit() calls
  // when isLoading=true, so we can call submit directly without workarounds.
  const handleHandoffConfirm = useCallback(() => {
    if (!handoffProposal) return;
    const targetName =
      FLOW_DISPLAY_NAMES[handoffProposal.target_flow] ||
      handoffProposal.target_flow;
    const confirmMsg: Message = {
      id: uuidv4(),
      type: "human",
      content: [
        {
          type: "text",
          text: `Switch to ${targetName}`,
        },
      ] as Message["content"],
    };
    thread.submit(
      {
        messages: [...thread.messages, confirmMsg],
        handoff_confirmed: true,
        handoff_target: handoffProposal.target_flow,
      } as Record<string, unknown> as any,
      {
        streamMode: ["values"],
        streamSubgraphs: true,
        streamResumable: true,
      },
    );
    setHandoffDismissed(true);
  }, [handoffProposal, thread]);

  // Handle clarification option selection: send selected value as human message
  const handleClarificationSelect = useCallback(
    (value: string) => {
      const clarifyMsg: Message = {
        id: uuidv4(),
        type: "human",
        content: [{ type: "text", text: value }] as Message["content"],
      };
      thread.submit(
        {
          messages: [...thread.messages, clarifyMsg],
        } as Record<string, unknown> as any,
        {
          streamMode: ["values"],
          streamSubgraphs: true,
          streamResumable: true,
        },
      );
    },
    [thread],
  );

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
            {/* Flow badge above message content */}
            {activeFlow && (
              <div className="mb-1">
                <FlowBadge flowType={activeFlow} />
              </div>
            )}

            {/* Multi-intent decomposition */}
            {multiIntentPayload && (
              <MultiIntentResult payload={multiIntentPayload} />
            )}

            {contentString.length > 0 && !(metadataResults && metadataResults.items.length > 0) && (
              <div className="py-1" data-testid="ai-message-content">
                <MarkdownText>{contentString}</MarkdownText>
              </div>
            )}

            {/* Confidence badge: structured sais_ui.confidence (primary) or regex fallback */}
            <ConfidenceBadge
              saisUiConfidence={confidenceData}
              content={contentString}
            />

            {/* Render QueryResults for metadata responses with structured data (replaces text list) */}
            {metadataResults && metadataResults.items.length > 0 && (
              <div className="mt-4">
                <QueryResults
                  evidence={metadataResults.items.map((item, idx) => ({
                    id: String(item.id || item.canonical_key || `item-${idx}`),
                    entity_type: metadataResults.entity_type,
                    ...item,
                  }))}
                  entityType={metadataResults.entity_type}
                  totalCount={metadataResults.total}
                  isLoading={isLoading}
                />
              </div>
            )}

            {/* Handoff confirmation card */}
            {handoffProposal && !handoffProposal.confirmed && (
              <HandoffConfirmationCard
                handoff={handoffProposal}
                currentFlow={activeFlow}
                onConfirm={handleHandoffConfirm}
                onDismiss={() => setHandoffDismissed(true)}
                dismissed={handoffDismissed}
              />
            )}

            {/* Remediation proposals as DiffCards */}
            {remediationProposals && remediationProposals.length > 0 && (
              <div className="mt-3" data-testid="remediation-proposals">
                <BatchReview
                  batchId={
                    ((saisUi as Record<string, unknown>)
                      ?.remediation_batch_id as string) ||
                    `msg-${message?.id ?? "unknown"}`
                  }
                  caseId={
                    ((saisUi as Record<string, unknown>)?.case_id as string) ||
                    ""
                  }
                  proposals={remediationProposals}
                  apiBaseUrl={
                    process.env.NEXT_PUBLIC_CASES_API_URL ||
                    "http://localhost:8000"
                  }
                />
              </div>
            )}

            {/* Blocker messages */}
            {blockers && blockers.length > 0 && (
              <div className="mt-3" data-testid="blocker-messages">
                {blockers.map((blocker, idx) => (
                  <BlockerMessage
                    key={`blocker-${idx}`}
                    blocker={blocker}
                    onAction={(action?: string) => {
                      // Determine the text to submit as human message:
                      // - LLM_ERROR recovery actions pass explicit action string ("retry", "switch to provider:model")
                      // - Non-LLM_ERROR blockers use next_action (backward compatible)
                      const text = action || blocker.next_action;
                      if (text) {
                        if (text.startsWith("grant write")) {
                          const scopeMatch = text.match(/scope=([^\s]+)/);
                          const pendingMatch = text.match(/pending_action_id=([^\s]+)/);
                          const reasonMatch = text.match(/reason="([\s\S]*)"$/);
                          const grant: PermissionGrant = {
                            capability: "WRITE",
                            scope: scopeMatch?.[1] ?? "once",
                            granted_at: new Date().toISOString(),
                            expires_at:
                              scopeMatch?.[1] === "1h"
                                ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
                                : null,
                            reason: reasonMatch?.[1] ?? null,
                            pending_action_id: pendingMatch?.[1] ?? null,
                          };
                          addPermissionGrant(grant);
                        }

                        if (text.startsWith("deny write")) {
                          const pendingMatch = text.match(/pending_action_id=([^\s]+)/);
                          revokePermissionGrant(pendingMatch?.[1] ?? null);
                        }

                        const actionMsg: Message = {
                          id: uuidv4(),
                          type: "human",
                          content: [
                            { type: "text", text },
                          ] as Message["content"],
                        };
                        thread.submit(
                          {
                            messages: [...thread.messages, actionMsg],
                          } as Record<string, unknown> as any,
                          {
                            streamMode: ["values"],
                            streamSubgraphs: true,
                            streamResumable: true,
                          }
                        );
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {/* Clarification card -- structured query clarification */}
            {clarificationData && (
              <ClarificationCard
                data={clarificationData}
                onSelect={handleClarificationSelect}
              />
            )}

            {!hideToolCalls && (
              <>
                {(hasToolCalls && toolCallsHaveContents && (
                  <ToolCalls toolCalls={message.tool_calls} />
                )) ||
                  (hasAnthropicToolCalls && (
                    <ToolCalls toolCalls={anthropicStreamedToolCalls} />
                  )) ||
                  (hasToolCalls && (
                    <ToolCalls toolCalls={message.tool_calls} />
                  ))}
              </>
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
