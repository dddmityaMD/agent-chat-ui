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
import React, { useState } from "react";
import { isAgentInboxInterruptSchema } from "@/lib/agent-inbox-interrupt";
import { isSaisInterruptSchema, SaisInterruptValue } from "@/hooks/useInterruptApproval";
import { ThreadView } from "../agent-inbox";
import { InterruptApproval } from "../interrupt-approval";
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
import { ViewInLineageButton } from "@/components/lineage-link";
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
import type { ThoughtStage, StreamingStateValues } from "@/lib/message-groups";
import { deriveStagesFromFlow, deriveStageDetails, applyStageDetails, computeDynamicStageReveal, computeDataDrivenReveal } from "@/lib/message-groups";
import { ThoughtProcessPane } from "@/components/thread/thought-process-pane";
import { HistoricalDisambiguationCard } from "@/components/thread/historical-disambiguation-card";

// Type for interrupt decision records stored in response_metadata
interface InterruptDecisionRecord {
  type: string;
  message: string;
  decision: "approved" | "rejected";
  feedback?: string | null;
  artifacts?: any[];
  rpabv_level?: number;
  rpabv_progress?: any;
  rpabv_status?: string;
  plan?: any;
  intent?: string;
  entities?: string[];
  step_index?: number;
  total_steps?: number;
}

/** Extract an interrupt decision record from response_metadata, if present */
function getInterruptDecision(meta: Record<string, unknown> | undefined): InterruptDecisionRecord | null {
  if (!meta || typeof meta !== "object") return null;
  const decision = meta.interrupt_decision;
  if (!decision || typeof decision !== "object") return null;
  const d = decision as Record<string, unknown>;
  if (typeof d.type !== "string" || typeof d.message !== "string" || typeof d.decision !== "string") return null;
  if (d.decision !== "approved" && d.decision !== "rejected") return null;
  return d as unknown as InterruptDecisionRecord;
}

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
  if (!(isLastMessage || hasNoAIOrToolMessages)) return null;
  if (!interrupt) return null;

  // Agent inbox HITL interrupts (action_requests + review_configs)
  if (isAgentInboxInterruptSchema(interrupt)) {
    return <ThreadView interrupt={interrupt} />;
  }

  // Extract interrupt value for SAIS-specific handling
  // LangGraph may wrap in {value: ...} or provide directly in array
  const interruptValue = Array.isArray(interrupt)
    ? (interrupt[0]?.value ?? interrupt[0])
    : ((interrupt as any)?.value ?? interrupt);

  // SAIS interrupt types (plan_approval, gate_confirmation, pipeline_resumption)
  if (isSaisInterruptSchema(interruptValue)) {
    return <InterruptApproval interruptValue={interruptValue} />;
  }

  // Fallback: generic JSON view
  const fallbackValue = Array.isArray(interrupt)
    ? (interrupt as Record<string, any>[])
    : (((interrupt as { value?: unknown } | undefined)?.value ??
        interrupt) as Record<string, any>);
  return <GenericInterruptView interrupt={fallbackValue} />;
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

/**
 * LastMessageDecorations - Renders sais_ui-dependent UI elements (flow badges,
 * blockers, handoffs, build plans, etc.) for the LAST AI message only.
 *
 * This component calls useSaisUi() and therefore subscribes to stream context.
 * By extracting it into a separate component, historical messages avoid this
 * subscription entirely, preventing unnecessary re-renders (UX-05 fix).
 */

function LastMessageDecorations({
  message,
  contentString,
  isLoading,
  msgResponseMeta,
  stages,
  streamingValues,
}: {
  message: Message | undefined;
  contentString: string;
  isLoading: boolean;
  msgResponseMeta: Record<string, unknown> | undefined;
  stages?: ThoughtStage[];
  /** Live streaming state — used for progressive stage reveal during streaming */
  streamingValues?: StreamingStateValues;
}) {
  const saisUiData = useSaisUi();
  const thread = useStreamContext();
  const { addPermissionGrant, revokePermissionGrant } = usePermissionState();
  const [handoffDismissed, setHandoffDismissed] = useState(false);

  // Metadata results fallback: use sais_ui when per-message response_metadata is empty
  const msgMetadataResults = msgResponseMeta && typeof msgResponseMeta === "object" && "metadata_results" in msgResponseMeta
    ? (msgResponseMeta as Record<string, unknown>).metadata_results
    : null;
  const perMsgResults = (msgMetadataResults && hasMetadataResults({ metadata_results: msgMetadataResults }))
    ? (msgMetadataResults as MetadataResults)
    : null;
  const saisUiMr = saisUiData.metadataResults.length > 0
    ? saisUiData.metadataResults
    : null;
  const metadataResults = perMsgResults
    ?? (saisUiMr && hasMetadataResults({ metadata_results: saisUiMr }) ? (saisUiMr as unknown as MetadataResults) : null);
  const metadataSections = metadataResults ? toSections(metadataResults) : [];

  if (!perMsgResults && saisUiMr) {
    console.debug("[ai.tsx] Grid fallback: response_metadata empty, using sais_ui.metadata_results",
      { hasResponseMeta: !!msgResponseMeta, responseMetaKeys: msgResponseMeta ? Object.keys(msgResponseMeta as Record<string, unknown>) : [], saisUiMrCount: saisUiMr.length });
  }

  // Extract all sais_ui-dependent data for the last message
  const activeFlow = saisUiData.flowType;
  const handoffProposal = getHandoffProposal(saisUiData.raw);
  const remediationProposals = getRemediationProposals(saisUiData.raw);
  const blockers = getBlockers(saisUiData.raw);
  const multiIntentPayload = getMultiIntentPayload(saisUiData.raw);
  const clarificationData = getClarification(saisUiData.raw);
  const buildPlan = getBuildPlan(saisUiData.raw);
  const buildPlanStatus = getBuildPlanStatus(saisUiData.raw);
  const buildVerificationResult = getBuildVerificationResult(saisUiData.raw);
  const confidenceData = getConfidenceData(saisUiData.raw);

  // Disambiguation: prefer sais_ui, fall back to response_metadata
  const msgPendingDisambiguation = msgResponseMeta?.pending_disambiguation as PendingDisambiguation | undefined;
  const pendingDisambiguation =
    getPendingDisambiguation(saisUiData.raw) ?? (msgPendingDisambiguation ? getPendingDisambiguation({ pending_disambiguation: msgPendingDisambiguation }) : null);

  // Submit helpers
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
        { type: "text", text: `Switch to ${targetName}` },
      ] as Message["content"],
    };
    threadSubmit(
      {
        messages: [...threadMessages, confirmMsg],
        handoff_confirmed: true,
        handoff_target: handoffProposal.target_flow,
      } as Record<string, unknown> as any,
      { streamMode: ["values"], streamSubgraphs: true, streamResumable: true },
    );
    setHandoffDismissed(true);
  }, [handoffProposal, threadSubmit, threadMessages]);

  const handleClarificationSelect = useCallback(
    (value: string) => {
      const clarifyMsg: Message = {
        id: uuidv4(),
        type: "human",
        content: [{ type: "text", text: value }] as Message["content"],
      };
      threadSubmit(
        { messages: [...threadMessages, clarifyMsg] } as Record<string, unknown> as any,
        { streamMode: ["values"], streamSubgraphs: true, streamResumable: true },
      );
    },
    [threadSubmit, threadMessages],
  );

  const handleDisambiguationSelect = useCallback(
    (entityName: string, action: string, nodeId?: string) => {
      const text = action === "skip" ? "None of these match what I meant" : action;
      const contentBlocks: Array<Record<string, unknown>> = [{ type: "text", text }];
      if (nodeId) {
        contentBlocks.push({ type: "entity_selection", node_id: nodeId });
      }
      const disambigMsg: Message = {
        id: uuidv4(),
        type: "human",
        content: contentBlocks as Message["content"],
      };
      threadSubmit(
        { messages: [...threadMessages, disambigMsg] } as Record<string, unknown> as any,
        { streamMode: ["values"], streamSubgraphs: true, streamResumable: true },
      );
    },
    [threadSubmit, threadMessages],
  );

  return (
    <>
      {/* Flow badge above message content */}
      {activeFlow && (
        <div className="mb-1">
          <FlowBadge flowType={activeFlow} />
        </div>
      )}

      {/* Thought process pane (UAT-4) — stage details are per-message data
           from response_metadata, not per-thread data from stream.values.
           Same data source for both last and historical messages. */}
      {(() => {
        const effectiveStages = (stages && stages.length > 0)
          ? stages
          : deriveStagesFromFlow(activeFlow, saisUiData.raw as Record<string, unknown> | null);
        if (effectiveStages.length === 0) return null;

        // During streaming, use live streaming state for details and progressive reveal.
        // After streaming, fall back to per-message response_metadata (historical data).
        let stageDetails: Record<string, string>;
        let minReveal = 0;

        if (isLoading) {
          // Use turn-gated values for detail fields when available,
          // but always use saisUiData.raw for dynamic stage reveal.
          // During interrupt resume, currentTurnIdRef isn't set (approval
          // bypasses handleSubmit), so streamingValues may be empty — but
          // saisUiData.raw is always updated by the SDK from values events.
          const hasStreamData = streamingValues && Object.keys(streamingValues).length > 0;
          stageDetails = hasStreamData ? deriveStageDetails(streamingValues) : {};
          const latestSaisUi = saisUiData.raw as Record<string, unknown> | undefined;
          const dynamicReveal = computeDynamicStageReveal(latestSaisUi, effectiveStages);
          const staticReveal = hasStreamData
            ? computeDataDrivenReveal(streamingValues, effectiveStages)
            : 0;
          minReveal = Math.max(dynamicReveal, staticReveal);
        } else {
          const intentFromMeta = msgResponseMeta?.intent as string | undefined;
          const confFromMeta = msgResponseMeta?.intent_confidence as number | undefined;
          const entitiesFromMeta = msgResponseMeta?.resolved_entities as
            Record<string, { name?: string; entity_type?: string }> | undefined;
          const catalogCount = metadataSections.length > 0
            ? {
                count: metadataSections.reduce((sum, s) => sum + s.total, 0),
                entity_type: metadataSections.length === 1 ? metadataSections[0].entity_type : "items",
              }
            : undefined;
          stageDetails = deriveStageDetails({
            intent: intentFromMeta,
            intent_confidence: confFromMeta,
            resolved_entities: entitiesFromMeta,
            evidence_result: catalogCount ? { catalog_count: catalogCount } : undefined,
          });
        }

        const enrichedStages = applyStageDetails(effectiveStages, stageDetails);
        return (
          <ThoughtProcessPane
            stages={enrichedStages}
            isStreaming={isLoading}
            startCollapsed={false}
            minRevealCount={minReveal}
          />
        );
      })()}

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

      {/* Interrupt decision card (read-only) — rare for last message but possible after resume */}
      {(() => {
        const interruptDecision = getInterruptDecision(msgResponseMeta);
        if (!interruptDecision) return null;
        return (
          <InterruptApproval
            interruptValue={interruptDecision as unknown as SaisInterruptValue}
            isReadOnly
            decision={interruptDecision.decision}
            feedback={interruptDecision.feedback}
          />
        );
      })()}

      {/* Synthesis indicator - show when streaming but no content yet */}
      {isLoading && contentString.length === 0 && !pendingDisambiguation && (
        <div className="py-1 flex items-center gap-2 text-muted-foreground" data-testid="synthesis-indicator">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Synthesizing answer...</span>
        </div>
      )}

      {/* AI text content - show alongside metadata grids; hide text for decision records */}
      {contentString.length > 0 && !getInterruptDecision(msgResponseMeta)
        && !(pendingDisambiguation && pendingDisambiguation.candidates.length > 0) && (
        <div className="py-1" data-testid="ai-message-content">
          <MarkdownText>{contentString}</MarkdownText>
        </div>
      )}

      {/* Render QueryResults for metadata responses */}
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

      {/* Confidence badge */}
      <ConfidenceBadge
        saisUiConfidence={confidenceData}
        content={contentString}
      />

      {/* Lineage deep-link button — only for grounded entities */}
      <ViewInLineageButton entities={saisUiData.groundedEntities} />

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
                    content: [{ type: "text", text }] as Message["content"],
                  };
                  thread.submit(
                    { messages: [...thread.messages, actionMsg] } as Record<string, unknown> as any,
                    { streamMode: ["values"], streamSubgraphs: true, streamResumable: true },
                  );
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Clarification card */}
      {clarificationData && (
        <ClarificationCard
          data={clarificationData}
          onSelect={handleClarificationSelect}
        />
      )}
    </>
  );
}

/**
 * HistoricalMessageContent - Renders content for non-last AI messages.
 * Does NOT subscribe to useSaisUi() or stream context for sais_ui data,
 * so it will not re-render when new stream data arrives (UX-05 fix).
 *
 * Per-message data (from response_metadata) is still rendered for historical
 * messages (metadata grids, disambiguation from response_metadata).
 */
const HistoricalMessageContent = React.memo(function HistoricalMessageContent({
  message,
  contentString,
  msgResponseMeta,
  stages,
  nextHumanMessage,
}: {
  message: Message | undefined;
  contentString: string;
  msgResponseMeta: Record<string, unknown> | undefined;
  stages?: ThoughtStage[];
  nextHumanMessage?: Message;
}) {
  // Per-message metadata_results from response_metadata (not from sais_ui)
  const msgMetadataResults = msgResponseMeta && typeof msgResponseMeta === "object" && "metadata_results" in msgResponseMeta
    ? (msgResponseMeta as Record<string, unknown>).metadata_results
    : null;
  const perMsgResults = (msgMetadataResults && hasMetadataResults({ metadata_results: msgMetadataResults }))
    ? (msgMetadataResults as MetadataResults)
    : null;
  const metadataSections = perMsgResults ? toSections(perMsgResults) : [];

  // Per-message disambiguation from response_metadata
  const msgPendingDisambiguation = msgResponseMeta?.pending_disambiguation as PendingDisambiguation | undefined;
  const pendingDisambiguation = msgPendingDisambiguation
    ? getPendingDisambiguation({ pending_disambiguation: msgPendingDisambiguation })
    : null;

  // Interrupt decision record (historical gate cards)
  const interruptDecision = getInterruptDecision(msgResponseMeta);

  return (
    <>
      {/* Thought process pane — collapsed for historical messages (UAT-4).
           Derive stage details from response_metadata which now includes
           intent, resolved_entities, and metadata_results (catalog count). */}
      {stages && stages.length > 0 && (() => {
        const intentFromMeta = msgResponseMeta?.intent as string | undefined;
        const confFromMeta = msgResponseMeta?.intent_confidence as number | undefined;
        const entitiesFromMeta = msgResponseMeta?.resolved_entities as
          Record<string, { name?: string; entity_type?: string }> | undefined;
        // Reconstruct catalog count from metadata_results sections in response_metadata
        const catalogCount = metadataSections.length > 0
          ? {
              count: metadataSections.reduce((sum, s) => sum + s.total, 0),
              entity_type: metadataSections.length === 1 ? metadataSections[0].entity_type : "items",
            }
          : undefined;
        const historyDetails = deriveStageDetails({
          intent: intentFromMeta,
          intent_confidence: confFromMeta,
          resolved_entities: entitiesFromMeta,
          evidence_result: catalogCount ? { catalog_count: catalogCount } : undefined,
        });
        const enrichedStages = applyStageDetails(stages, historyDetails);
        return (
          <ThoughtProcessPane
            stages={enrichedStages}
            isStreaming={false}
            startCollapsed
          />
        );
      })()}

      {/* Historical interrupt decision card (read-only) */}
      {interruptDecision && (
        <InterruptApproval
          interruptValue={interruptDecision as unknown as SaisInterruptValue}
          isReadOnly
          decision={interruptDecision.decision}
          feedback={interruptDecision.feedback}
        />
      )}

      {/* Historical disambiguation card — grayed out with selection highlighted (UAT-4) */}
      {pendingDisambiguation && pendingDisambiguation.candidates.length > 0 && (
        <HistoricalDisambiguationCard
          payload={pendingDisambiguation}
          nextHumanMessage={nextHumanMessage}
        />
      )}

      {/* AI text content — skip if this message is purely a decision record */}
      {contentString.length > 0 && !interruptDecision
        && !(pendingDisambiguation && pendingDisambiguation.candidates.length > 0) && (
        <div className="py-1" data-testid="ai-message-content">
          <MarkdownText>{contentString}</MarkdownText>
        </div>
      )}

      {/* Per-message metadata grids */}
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
              isLoading={false}
            />
          </details>
        )
      ))}

      {/* Confidence badge from content only (no sais_ui) */}
      <ConfidenceBadge
        saisUiConfidence={null}
        content={contentString}
      />
    </>
  );
}, (prev, next) => {
  // Custom comparator: only re-render when message content, response_metadata, or stages change.
  return (
    prev.message?.id === next.message?.id &&
    prev.contentString === next.contentString &&
    prev.msgResponseMeta === next.msgResponseMeta &&
    prev.stages === next.stages &&
    prev.nextHumanMessage?.id === next.nextHumanMessage?.id
  );
});

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
  handleRegenerate: (parentCheckpoint: Checkpoint | null | undefined) => void;
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
