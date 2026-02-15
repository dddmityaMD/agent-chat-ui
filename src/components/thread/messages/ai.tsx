import { parsePartialJson } from "@langchain/core/output_parsers";
import { useStreamContext } from "@/providers/Stream";
import { AIMessage, Checkpoint, Message } from "@langchain/langgraph-sdk";
import { getContentString } from "../utils";
import { BranchSwitcher, CommandBar } from "./shared";
import { MarkdownText } from "../markdown-text";
import { LoadExternalComponent } from "@langchain/langgraph-sdk/react-ui";
import { cn } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/api-url";
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
import type { Blocker, MultiIntentPayload, PendingDisambiguation, BuildPlan, BuildPlanStatus, VerificationResult } from "@/lib/types";
import { ArrowRightLeft, X, Loader2 } from "lucide-react";
import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePermissionState } from "@/providers/Thread";
import type { PermissionGrant } from "@/lib/types";
import { ClarificationCard, getClarification } from "../clarification-card";
import { DisambiguationCard, getPendingDisambiguation } from "../disambiguation-card";
import { BuildPlanDisplay } from "./build-plan";
import { VerificationBadge } from "./verification-badge";
import {
  useSaisUi,
  extractHandoffProposal,
  extractRemediationProposals,
  extractBlockers,
  extractConfidence,
  extractMultiIntent,
  extractBuildPlan,
  extractBuildPlanStatus,
  extractBuildVerification
} from "@/hooks/useSaisUi";

// Type for a single metadata section (one entity type)
interface MetadataSection {
  entity_type: EntityType;
  items: Array<Record<string, unknown>>;
  total: number;
}

// Type for metadata_results from sais_ui payload — list (new), flat (legacy single type), or sectioned (legacy mixed)
type MetadataResults = MetadataSection[] | MetadataSection | { sections: MetadataSection[] };

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

// Display labels for entity type section headers
const ENTITY_TYPE_LABELS: Record<string, string> = {
  table: "Tables",
  column: "Columns",
  report: "Reports",
  dashboard: "Dashboards",
  dbt_model: "dbt Models",
  git_commit: "Git Commits",
  mixed: "Other",
};

// Type guard: check if a single section is valid
function isValidSection(s: unknown): s is MetadataSection {
  if (!s || typeof s !== "object") return false;
  const obj = s as Record<string, unknown>;
  return typeof obj.entity_type === "string" && Array.isArray(obj.items) && typeof obj.total === "number";
}

// Type guard for sais_ui payload — accepts list (new), flat (legacy single type), or sectioned (legacy mixed)
function hasMetadataResults(
  saisUi: unknown
): saisUi is { metadata_results: MetadataResults } {
  if (!saisUi || typeof saisUi !== "object") return false;
  const obj = saisUi as Record<string, unknown>;
  const mr = obj.metadata_results;
  if (!mr) return false;
  // New list format: MetadataSection[]
  if (Array.isArray(mr)) return mr.some(isValidSection);
  if (typeof mr !== "object") return false;
  const mrObj = mr as Record<string, unknown>;
  // Legacy sectioned format: { sections: [...] }
  if (Array.isArray(mrObj.sections)) return mrObj.sections.some(isValidSection);
  // Legacy flat format: { entity_type, items, total }
  return isValidSection(mrObj);
}

// Normalize metadata_results into an array of sections
function toSections(mr: MetadataResults): MetadataSection[] {
  // New list format: already an array of sections
  if (Array.isArray(mr)) return mr.filter(isValidSection);
  // Legacy sectioned format: { sections: [...] }
  if ("sections" in mr && Array.isArray(mr.sections)) return mr.sections.filter(isValidSection);
  // Legacy flat format: single MetadataSection
  if (isValidSection(mr)) return [mr];
  return [];
}

// Wrapper functions that adapt centralized extractors to local type contracts
function getHandoffProposal(saisUi: unknown): HandoffProposal | null {
  const handoff = extractHandoffProposal(saisUi);
  if (!handoff || typeof handoff !== "object") return null;
  const h = handoff as Record<string, unknown>;
  if (typeof h.target_flow !== "string") return null;
  return {
    target_flow: h.target_flow,
    reason: typeof h.reason === "string" ? h.reason : "",
    confirmed: h.confirmed === true,
  };
}

function getRemediationProposals(saisUi: unknown): RemediationProposalData[] | null {
  const proposals = extractRemediationProposals(saisUi);
  if (proposals.length === 0) return null;
  // Validate that each proposal has required fields
  const valid = proposals.every(
    (p: unknown) =>
      p &&
      typeof p === "object" &&
      typeof (p as Record<string, unknown>).fix_id === "string" &&
      typeof (p as Record<string, unknown>).title === "string"
  );
  return valid ? (proposals as unknown as RemediationProposalData[]) : null;
}

function getBlockers(saisUi: unknown): Blocker[] | null {
  const blockers = extractBlockers(saisUi);
  if (blockers.length === 0) return null;
  return blockers as Blocker[];
}

function getConfidenceData(saisUi: unknown): { level: "high" | "medium" | "low"; reason?: string } | null {
  const confidence = extractConfidence(saisUi);
  if (!confidence) return null;
  const c = confidence as Record<string, unknown>;
  if (typeof c.level !== "string") return null;
  const level = (c.level as string).toLowerCase();
  if (level !== "high" && level !== "medium" && level !== "low") return null;
  return {
    level: level as "high" | "medium" | "low",
    reason: typeof c.reason === "string" ? c.reason : undefined,
  };
}

function getMultiIntentPayload(saisUi: unknown): MultiIntentPayload | null {
  const mi = extractMultiIntent(saisUi);
  if (!mi) return null;
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

function getBuildPlan(saisUi: unknown): BuildPlan | null {
  const buildPlan = extractBuildPlan(saisUi);
  if (!buildPlan) return null;
  const plan = buildPlan as Record<string, unknown>;
  // Validate required fields
  if (
    typeof plan.plan_id !== "string" ||
    typeof plan.title !== "string" ||
    !Array.isArray(plan.steps) ||
    typeof plan.context_summary !== "string" ||
    typeof plan.estimated_impact !== "string" ||
    typeof plan.risk_level !== "string"
  ) return null;
  return plan as unknown as BuildPlan;
}

function getBuildPlanStatus(saisUi: unknown): BuildPlanStatus | null {
  const status = extractBuildPlanStatus(saisUi);
  if (!status) return null;
  // Validate it's a valid status
  const validStatuses: BuildPlanStatus[] = ["proposed", "approved", "rejected", "executing", "completed", "failed"];
  return validStatuses.includes(status as BuildPlanStatus) ? (status as BuildPlanStatus) : null;
}

function getBuildVerificationResult(saisUi: unknown): VerificationResult | null {
  const verificationResult = extractBuildVerification(saisUi);
  if (!verificationResult) return null;
  const result = verificationResult as Record<string, unknown>;
  // Validate required fields
  if (
    typeof result.status !== "string" ||
    typeof result.comparison_summary !== "string" ||
    typeof result.verification_method !== "string"
  ) return null;
  return result as unknown as VerificationResult;
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
  const saisUiData = useSaisUi();
  const isLastMessage =
    thread.messages.length > 0 &&
    thread.messages[thread.messages.length - 1].id === message?.id;
  const hasNoAIOrToolMessages = !thread.messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );
  const meta = message ? thread.getMessagesMetadata(message) : undefined;
  const threadInterrupt = thread.interrupt;

  // Extract metadata_results: prefer per-message response_metadata, fall back to sais_ui for last message
  const msgResponseMeta = message && "response_metadata" in message
    ? (message as AIMessage).response_metadata
    : undefined;
  const msgMetadataResults = msgResponseMeta && typeof msgResponseMeta === "object" && "metadata_results" in msgResponseMeta
    ? (msgResponseMeta as Record<string, unknown>).metadata_results
    : null;
  const perMsgResults = (msgMetadataResults && hasMetadataResults({ metadata_results: msgMetadataResults }))
    ? (msgMetadataResults as MetadataResults)
    : null;
  // Fallback: for the last message, use sais_ui.metadata_results if per-message response_metadata is empty.
  // This prevents "grid bleed" (older messages showing current grid) while ensuring the latest response
  // always shows metadata grids even if response_metadata is lost during streaming/serialization.
  const saisUiMr = isLastMessage && saisUiData.metadataResults.length > 0
    ? saisUiData.metadataResults
    : null;
  const metadataResults = perMsgResults
    ?? (saisUiMr && hasMetadataResults({ metadata_results: saisUiMr }) ? (saisUiMr as unknown as MetadataResults) : null);
  const metadataSections = metadataResults ? toSections(metadataResults) : [];

  // Diagnostic: log when fallback is used (remove after debugging)
  if (isLastMessage && !perMsgResults && saisUiMr) {
    console.debug("[ai.tsx] Grid fallback: response_metadata empty, using sais_ui.metadata_results",
      { hasResponseMeta: !!msgResponseMeta, responseMetaKeys: msgResponseMeta ? Object.keys(msgResponseMeta as Record<string, unknown>) : [], saisUiMrCount: saisUiMr.length });
  }

  // Extract flow information from sais_ui (only for last message to avoid stale badges)
  const activeFlow = isLastMessage ? saisUiData.flowType : null;
  const handoffProposal = isLastMessage ? getHandoffProposal(saisUiData.raw) : null;
  const remediationProposals = isLastMessage ? getRemediationProposals(saisUiData.raw) : null;
  const blockers = isLastMessage ? getBlockers(saisUiData.raw) : null;
  const multiIntentPayload = isLastMessage ? getMultiIntentPayload(saisUiData.raw) : null;
  const clarificationData = isLastMessage ? getClarification(saisUiData.raw) : null;
  const buildPlan = isLastMessage ? getBuildPlan(saisUiData.raw) : null;
  const buildPlanStatus = isLastMessage ? getBuildPlanStatus(saisUiData.raw) : null;
  const buildVerificationResult = isLastMessage ? getBuildVerificationResult(saisUiData.raw) : null;
  // Disambiguation data: prefer sais_ui for last message, fall back to response_metadata
  const msgPendingDisambiguation = msgResponseMeta?.pending_disambiguation as PendingDisambiguation | undefined;
  const pendingDisambiguation = isLastMessage
    ? getPendingDisambiguation(saisUiData.raw) ?? (msgPendingDisambiguation ? getPendingDisambiguation({ pending_disambiguation: msgPendingDisambiguation }) : null)
    : msgPendingDisambiguation ? getPendingDisambiguation({ pending_disambiguation: msgPendingDisambiguation }) : null;
  // Confidence data: extract from sais_ui for last message (structured source)
  const confidenceData = isLastMessage ? getConfidenceData(saisUiData.raw) : null;

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
  // Use thread.submit and thread.messages individually (stable references)
  // instead of the full `thread` object which is recreated every render.
  const { submit: threadSubmit, messages: threadMessages } = thread;
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
    threadSubmit(
      {
        messages: [...threadMessages, confirmMsg],
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
  }, [handoffProposal, threadSubmit, threadMessages]);

  // Handle clarification option selection: send selected value as human message
  const handleClarificationSelect = useCallback(
    (value: string) => {
      const clarifyMsg: Message = {
        id: uuidv4(),
        type: "human",
        content: [{ type: "text", text: value }] as Message["content"],
      };
      threadSubmit(
        {
          messages: [...threadMessages, clarifyMsg],
        } as Record<string, unknown> as any,
        {
          streamMode: ["values"],
          streamSubgraphs: true,
          streamResumable: true,
        },
      );
    },
    [threadSubmit, threadMessages],
  );

  // Handle disambiguation selection: send entity action or skip as human message
  // 14-24: Include node_id as entity_selection content block so backend can pin
  // the exact entity without re-resolving from scratch.
  const handleDisambiguationSelect = useCallback(
    (entityName: string, action: string, nodeId?: string) => {
      const text =
        action === "skip"
          ? "None of these match what I meant"
          : action;
      const contentBlocks: Array<Record<string, unknown>> = [
        { type: "text", text },
      ];
      if (nodeId) {
        contentBlocks.push({ type: "entity_selection", node_id: nodeId });
      }
      const disambigMsg: Message = {
        id: uuidv4(),
        type: "human",
        content: contentBlocks as Message["content"],
      };
      threadSubmit(
        {
          messages: [...threadMessages, disambigMsg],
        } as Record<string, unknown> as any,
        {
          streamMode: ["values"],
          streamSubgraphs: true,
          streamResumable: true,
        },
      );
    },
    [threadSubmit, threadMessages],
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

            {/* Disambiguation card -- ambiguous entity matches */}
            {pendingDisambiguation && pendingDisambiguation.candidates.length > 0 && (
              <DisambiguationCard
                payload={pendingDisambiguation}
                onSelect={handleDisambiguationSelect}
              />
            )}

            {/* Synthesis indicator (TODO 2) - show when streaming but no content yet */}
            {isLoading && contentString.length === 0 && !pendingDisambiguation && (
              <div className="py-1 flex items-center gap-2 text-muted-foreground" data-testid="synthesis-indicator">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Synthesizing answer...</span>
              </div>
            )}

            {/* AI text content - show alongside metadata grids (TODO 1) */}
            {contentString.length > 0
              && !(pendingDisambiguation && pendingDisambiguation.candidates.length > 0) && (
              <div className="py-1" data-testid="ai-message-content">
                <MarkdownText>{contentString}</MarkdownText>
              </div>
            )}

            {/* Render QueryResults for metadata responses — one grid per entity type section (TODO 1) */}
            {metadataSections.map((section) => (
              section.items.length > 0 && (
                <details
                  className="mt-4"
                  key={section.entity_type}
                  open={true}
                  data-testid={`entity-grid-section-${section.entity_type}`}
                >
                  {metadataSections.length > 1 && (
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground transition-colors">
                      {ENTITY_TYPE_LABELS[section.entity_type] || section.entity_type} ({section.total})
                    </summary>
                  )}
                  <QueryResults
                    evidence={section.items.map((item, idx) => ({
                      id: String(item.id || item.canonical_key || `item-${idx}`),
                      entity_type: section.entity_type,
                      ...item,
                    }))}
                    entityType={section.entity_type}
                    totalCount={section.total}
                    isLoading={isLoading}
                  />
                </details>
              )
            ))}

            {/* Confidence badge: always after all content (text + table) for consistent position */}
            <ConfidenceBadge
              saisUiConfidence={confidenceData}
              content={contentString}
            />

            {/* Build plan display */}
            {buildPlan && buildPlanStatus === "proposed" && (
              <div className="mt-3">
                <BuildPlanDisplay plan={buildPlan} />
              </div>
            )}

            {/* Build execution progress indicator */}
            {buildPlanStatus === "executing" && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400"></div>
                  <span className="text-sm text-blue-800 dark:text-blue-200">
                    Executing build plan...
                  </span>
                </div>
              </div>
            )}

            {/* Build verification result */}
            {buildVerificationResult && (
              <div className="mt-3">
                <VerificationBadge result={buildVerificationResult} />
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
                    ((saisUiData.raw as Record<string, unknown>)
                      ?.remediation_batch_id as string) ||
                    `msg-${message?.id ?? "unknown"}`
                  }
                  threadId={
                    ((saisUiData.raw as Record<string, unknown>)?.thread_id as string) ||
                    ((saisUiData.raw as Record<string, unknown>)?.case_id as string) ||
                    ""
                  }
                  proposals={remediationProposals}
                  apiBaseUrl={getApiBaseUrl()}
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
