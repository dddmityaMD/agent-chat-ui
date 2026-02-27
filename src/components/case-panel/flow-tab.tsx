"use client";

/**
 * Flow tab - Universal flow tracker showing ALL flows in the thread.
 *
 * Shows flows stacked vertically, latest on top. Build flows get the full
 * RPABV timeline with interrupt cards and decisions. Non-build flows
 * (investigation, catalog) show a simpler entry with type + status.
 *
 * PRIMARY source: block messages from REST (interrupt_card, interrupt_decision,
 * flow_summary blocks). These persist across page refresh.
 *
 * LIVE state: sais_ui.active_flow for currently running flow.
 *
 * FALLBACK: useSaisUi() for legacy threads that predate block messages (23.4).
 */

import React, { useState, useMemo } from "react";
import {
  Check,
  Loader2,
  Circle,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { useSaisUi } from "@/hooks/useSaisUi";
import { useStreamContext } from "@/providers/Stream";
import { cn } from "@/lib/utils";
import type { Message } from "@langchain/langgraph-sdk";
import type { BlockData, InterruptCardBlockData, FlowSummaryBlockData } from "@/lib/blocks/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StageDefinition {
  id: string;
  label: string;
  data_key: string;
}

interface Artifact {
  type: string;
  label: string;
  items?: unknown[];
  summary?: string;
}

interface RpabvDecision {
  timestamp: string;
  gate_type: "research" | "plan" | "verify" | string;
  action: "approved" | "rejected" | string;
  feedback: string | null;
  step_index: number | null;
}

/** Extracted flow data from block messages */
interface FlowDataFromBlocks {
  /** RPABV timeline entries derived from interrupt_card blocks */
  timelineEntries: Array<{
    cardType: string;
    title: string;
    message: string;
    artifacts: Artifact[];
    rpabvProgress: Record<string, unknown> | null;
    decision: string | null;
    feedback: string | null;
    decidedAt: string | null;
  }>;
  /** Decision records from interrupt_decision blocks */
  decisions: RpabvDecision[];
  /** Flow summaries from flow_summary blocks (all of them) */
  flowSummaries: FlowSummaryBlockData[];
  /** Whether any interrupt_card blocks were found (signals block-based data) */
  hasBlockData: boolean;
}

// ---------------------------------------------------------------------------
// Block extraction helpers
// ---------------------------------------------------------------------------

/** Title map for interrupt card types (matches interrupt-card-block.tsx) */
const CARD_TYPE_TITLES: Record<string, string> = {
  plan_approval: "Plan Review",
  research_approval: "Research Review",
  verify_approval: "Verification Review",
  gate_confirmation: "Action Confirmation",
  pipeline_resumption: "Pipeline Resumption",
};

/** Map card_type to RPABV stage id for timeline ordering */
const CARD_TYPE_TO_STAGE: Record<string, string> = {
  research_approval: "research",
  plan_approval: "plan",
  gate_confirmation: "approve",
  verify_approval: "verify",
};

/**
 * Extract flow data from REST-fetched block messages.
 *
 * Scans all AI messages for:
 * - interrupt_card blocks: RPABV stage cards with artifacts + decisions
 * - interrupt_decision blocks: separate decision records
 * - flow_summary blocks: overall flow completion(s)
 */
function extractFlowData(messages: Message[]): FlowDataFromBlocks {
  const timelineEntries: FlowDataFromBlocks["timelineEntries"] = [];
  const decisions: RpabvDecision[] = [];
  const flowSummaries: FlowSummaryBlockData[] = [];
  let hasBlockData = false;

  for (const msg of messages) {
    if (msg.type !== "ai") continue;

    const meta = msg.response_metadata as Record<string, unknown> | undefined;
    if (!meta?.blocks) continue;

    const blocks = meta.blocks as BlockData[];
    if (!Array.isArray(blocks)) continue;

    for (const block of blocks) {
      if (block.type === "interrupt_card") {
        hasBlockData = true;
        const card = block as InterruptCardBlockData;
        timelineEntries.push({
          cardType: card.card_type || "",
          title: CARD_TYPE_TITLES[card.card_type] ?? card.card_type ?? "Stage",
          message: card.message || "",
          artifacts: (card.artifacts ?? []) as Artifact[],
          rpabvProgress: card.rpabv_progress ?? null,
          decision: (card.decision as string) ?? null,
          feedback: (card.feedback as string) ?? null,
          decidedAt: (card.decided_at as string) ?? null,
        });
      }

      if (block.type === "interrupt_decision") {
        const dec = block as BlockData & {
          card_type?: string;
          decision?: string;
          feedback?: string | null;
          decided_at?: string;
        };
        decisions.push({
          timestamp: dec.decided_at ?? new Date().toISOString(),
          gate_type: CARD_TYPE_TO_STAGE[dec.card_type ?? ""] ?? dec.card_type ?? "unknown",
          action: dec.decision ?? "unknown",
          feedback: dec.feedback ?? null,
          step_index: null,
        });
      }

      if (block.type === "flow_summary") {
        flowSummaries.push(block as FlowSummaryBlockData);
      }
    }
  }

  // Pair decisions with timeline entries by card_type (chronological matching)
  const decisionByCardType = new Map<string, typeof decisions[number]>();
  for (const dec of decisions) {
    decisionByCardType.set(dec.gate_type, dec);
  }

  for (const entry of timelineEntries) {
    const stageId = CARD_TYPE_TO_STAGE[entry.cardType] ?? entry.cardType;
    const paired = decisionByCardType.get(stageId);
    if (paired && !entry.decision) {
      entry.decision = paired.action;
      entry.feedback = paired.feedback;
      entry.decidedAt = paired.timestamp;
    }
  }

  return { timelineEntries, decisions, flowSummaries, hasBlockData };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely extract an array from a passthrough sais_ui field */
function extractArray(obj: unknown, key: string): unknown[] {
  if (!obj || typeof obj !== "object") return [];
  const val = (obj as Record<string, unknown>)[key];
  return Array.isArray(val) ? val : [];
}

/** Safely extract a string from a passthrough sais_ui field */
function extractString(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === "string" && val.length > 0 ? val : null;
}

/** Safely extract an object from a passthrough sais_ui field */
function extractObject(obj: unknown, key: string): Record<string, unknown> | null {
  if (!obj || typeof obj !== "object") return null;
  const val = (obj as Record<string, unknown>)[key];
  return val && typeof val === "object" && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null;
}

/** Format a timestamp as relative time or absolute */
function formatRelativeTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return timestamp;
  }
}

/** Format a flow type string for display */
function formatFlowType(flowType: string): string {
  return flowType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Derive stage status for legacy sais_ui path */
function getStageStatus(
  stageId: string,
  stageIndex: number,
  currentStageId: string | null,
  stages: StageDefinition[],
  flowFinished?: boolean,
  decisions?: RpabvDecision[],
): "completed" | "active" | "pending" {
  if (decisions?.some((d) => d.gate_type === stageId && d.action === "approved")) {
    return "completed";
  }

  if (!currentStageId) return "pending";
  const currentIdx = stages.findIndex((s) => s.id === currentStageId);
  if (currentIdx < 0) return "pending";
  if (flowFinished) {
    return stageIndex <= currentIdx ? "completed" : "pending";
  }
  if (stageIndex < currentIdx) return "completed";
  if (stageIndex === currentIdx) return "active";
  return "pending";
}

// ---------------------------------------------------------------------------
// Block-based Timeline Entry
// ---------------------------------------------------------------------------

function BlockTimelineEntry({
  entry,
  isLast,
  isFlowFinished,
}: {
  entry: FlowDataFromBlocks["timelineEntries"][number];
  isLast: boolean;
  isFlowFinished: boolean;
}) {
  const hasDecision = !!entry.decision;
  const status: "completed" | "active" | "pending" = hasDecision || isFlowFinished
    ? "completed"
    : "active";

  const [isExpanded, setIsExpanded] = useState(status === "active");
  const hasContent = entry.artifacts.length > 0 || entry.message.length > 0;

  return (
    <div className="flex gap-3">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className="flex h-6 w-6 items-center justify-center">
          {status === "completed" ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-3 w-3 text-emerald-600" />
            </div>
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100">
              <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
            </div>
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-0.5 flex-1 min-h-[16px]",
              status === "completed" ? "bg-emerald-200" : "bg-blue-200",
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-3">
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-1.5 text-left",
            hasContent && "cursor-pointer hover:text-foreground",
            !hasContent && "cursor-default",
          )}
          onClick={() => hasContent && setIsExpanded(!isExpanded)}
          disabled={!hasContent}
        >
          <span
            className={cn(
              "text-sm font-medium",
              status === "active" && "text-blue-700",
              status === "completed" && "text-foreground",
            )}
          >
            {entry.title}
          </span>
          {hasContent && (
            <>
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </>
          )}
          {/* Decision badge */}
          {entry.decision && (
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                entry.decision === "approved"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700",
              )}
            >
              {entry.decision === "approved" ? (
                <CheckCircle className="h-2.5 w-2.5" />
              ) : (
                <XCircle className="h-2.5 w-2.5" />
              )}
              {entry.decision}
            </span>
          )}
        </button>

        {/* Artifacts */}
        {isExpanded && hasContent && (
          <div className="mt-2 space-y-1.5">
            {entry.artifacts.map((artifact, i) => (
              <div
                key={`${artifact.type}-${i}`}
                className="rounded border bg-muted/30 px-2.5 py-1.5 text-xs"
              >
                <div className="font-medium text-muted-foreground">
                  {artifact.label}
                </div>
                {artifact.summary && (
                  <div className="mt-0.5 text-muted-foreground/80">
                    {artifact.summary}
                  </div>
                )}
                {artifact.items && artifact.items.length > 0 && (
                  <div className="mt-1 text-muted-foreground/70">
                    {artifact.items.length} item{artifact.items.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            ))}
            {/* Card message preview (truncated) */}
            {entry.message && (
              <div className="rounded border bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground/80 line-clamp-3">
                {entry.message.slice(0, 200)}
                {entry.message.length > 200 ? "..." : ""}
              </div>
            )}
          </div>
        )}

        {/* Decision feedback */}
        {entry.feedback && (
          <div className="mt-1 text-xs text-muted-foreground/80 italic">
            &ldquo;{entry.feedback}&rdquo;
          </div>
        )}
        {entry.decidedAt && (
          <div className="mt-0.5 flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
            <Clock className="h-2.5 w-2.5" />
            {formatRelativeTime(entry.decidedAt)}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legacy Stage Timeline Entry (sais_ui path)
// ---------------------------------------------------------------------------

function StageTimelineEntry({
  stage,
  status,
  artifacts,
  isLast,
}: {
  stage: StageDefinition;
  status: "completed" | "active" | "pending";
  artifacts: Artifact[];
  isLast: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(status === "active");

  const hasContent = artifacts.length > 0;

  return (
    <div className="flex gap-3">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className="flex h-6 w-6 items-center justify-center">
          {status === "completed" ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-3 w-3 text-emerald-600" />
            </div>
          ) : status === "active" ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100">
              <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100">
              <Circle className="h-3 w-3 text-gray-400" />
            </div>
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-0.5 flex-1 min-h-[16px]",
              status === "completed"
                ? "bg-emerald-200"
                : status === "active"
                  ? "bg-blue-200"
                  : "bg-gray-200",
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-3">
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-1.5 text-left",
            hasContent && "cursor-pointer hover:text-foreground",
            !hasContent && "cursor-default",
          )}
          onClick={() => hasContent && setIsExpanded(!isExpanded)}
          disabled={!hasContent}
        >
          <span
            className={cn(
              "text-sm font-medium",
              status === "active" && "text-blue-700",
              status === "completed" && "text-foreground",
              status === "pending" && "text-muted-foreground",
            )}
          >
            {stage.label}
          </span>
          {hasContent && (
            <>
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </button>

        {/* Artifacts */}
        {isExpanded && hasContent && (
          <div className="mt-2 space-y-1.5">
            {artifacts.map((artifact, i) => (
              <div
                key={`${artifact.type}-${i}`}
                className="rounded border bg-muted/30 px-2.5 py-1.5 text-xs"
              >
                <div className="font-medium text-muted-foreground">
                  {artifact.label}
                </div>
                {artifact.summary && (
                  <div className="mt-0.5 text-muted-foreground/80">
                    {artifact.summary}
                  </div>
                )}
                {artifact.items && artifact.items.length > 0 && (
                  <div className="mt-1 text-muted-foreground/70">
                    {artifact.items.length} item{artifact.items.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// L3 Step Group Header (legacy)
// ---------------------------------------------------------------------------

function _StepGroupHeader({
  stepIndex,
  totalSteps,
}: {
  stepIndex: number;
  totalSteps: number;
}) {
  return (
    <div className="mb-1 mt-2 flex items-center gap-2 border-b border-border/40 pb-1 first:mt-0">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Step {stepIndex + 1} of {totalSteps}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Decisions Section (Permissions audit trail)
// ---------------------------------------------------------------------------

/** Color mapping for gate type badges in the decisions audit trail */
const GATE_TYPE_COLORS: Record<string, string> = {
  research: "bg-violet-100 text-violet-700",
  plan: "bg-blue-100 text-blue-700",
  build: "bg-orange-100 text-orange-700",
  verify: "bg-amber-100 text-amber-700",
};

function DecisionsSection({ decisions }: { decisions: RpabvDecision[] }) {
  if (decisions.length === 0) {
    return (
      <div className="mt-4 border-t border-border/40 pt-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <span>Decisions</span>
          <span className="rounded-full bg-muted px-1.5 text-xs">0</span>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          No decisions yet
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-border/40 pt-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span>Decisions</span>
        <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">
          {decisions.length}
        </span>
      </div>
      <div className="mt-2 space-y-2">
        {decisions.map((decision, i) => (
          <DecisionEntry key={`decision-${i}`} decision={decision} />
        ))}
      </div>
    </div>
  );
}

/** Single decision entry in the audit trail */
function DecisionEntry({ decision }: { decision: RpabvDecision }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      {decision.action === "approved" ? (
        <CheckCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {decision.step_index != null && (
            <span className="text-muted-foreground font-medium">
              Step {decision.step_index + 1}
            </span>
          )}

          <span
            className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              GATE_TYPE_COLORS[decision.gate_type] ||
                "bg-gray-100 text-gray-700",
            )}
          >
            {decision.gate_type.charAt(0).toUpperCase() +
              decision.gate_type.slice(1)}
          </span>

          <span
            className={cn(
              "font-medium",
              decision.action === "approved"
                ? "text-emerald-600"
                : "text-red-600",
            )}
          >
            {decision.action}
          </span>

          <span className="flex items-center gap-0.5 text-muted-foreground/70">
            <Clock className="h-2.5 w-2.5" />
            {formatRelativeTime(decision.timestamp)}
          </span>
        </div>

        {decision.feedback && (
          <div className="mt-0.5 text-muted-foreground/80 italic">
            &ldquo;{decision.feedback}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Completed Flow Entry (collapsed by default, click to expand)
// ---------------------------------------------------------------------------

function CompletedFlowEntry({
  summary,
  defaultExpanded,
}: {
  summary: FlowSummaryBlockData;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const label = summary.flow_type ? formatFlowType(summary.flow_type) : "Flow";

  return (
    <div className="rounded-md border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {summary.stages_completed}/{summary.stages_total} stages
        </span>
        <span className="ml-auto">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </span>
      </button>
      {expanded && (
        <div className="border-t px-3 py-2">
          {summary.stage_details && summary.stage_details.length > 0 ? (
            <div className="space-y-0">
              {summary.stage_details.map((sd, idx) => (
                <div key={sd.id} className="flex items-start gap-2 py-1">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {sd.status === "completed" ? (
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100">
                        <Check className="h-2.5 w-2.5 text-emerald-600" />
                      </div>
                    ) : (
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-100">
                        <Circle className="h-2.5 w-2.5 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium">{sd.label}</span>
                    {sd.subtitle && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">{sd.subtitle}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              {label} flow completed.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active Non-Build Flow Entry
// ---------------------------------------------------------------------------

function ActiveNonBuildFlowEntry({ flowType }: { flowType: string }) {
  const label = formatFlowType(flowType);

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
      <div className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
        <span className="text-sm font-medium text-blue-700">{label}</span>
        <span className="text-xs text-blue-600">in progress</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FlowTab
// ---------------------------------------------------------------------------

export function FlowTab({ threadId }: { threadId?: string | null }) {
  const saisUi = useSaisUi();
  const stream = useStreamContext();
  const raw = saisUi.raw;

  // Extract flow data from REST-fetched block messages
  const flowData = useMemo(
    () => extractFlowData(stream.messages),
    [stream.messages],
  );

  const useBlocks = flowData.hasBlockData;
  const activeFlowType = saisUi.flowType;

  // --- sais_ui data for stage timeline ---
  const stageDefs = extractArray(raw, "stage_definitions") as StageDefinition[];
  const currentStage = extractString(raw, "rpabv_stage");
  const buildPlanStatus = extractString(raw, "build_plan_status");
  // Build flows have explicit status; non-build flows finish when stream ends
  const flowFinished = buildPlanStatus
    ? buildPlanStatus === "completed" || buildPlanStatus === "failed"
    : !stream.isLoading && !!activeFlowType;
  const rpabvArtifacts = extractObject(raw, "rpabv_artifacts");
  const rpabvDecisions = extractArray(raw, "rpabv_decisions") as RpabvDecision[];

  // Completed non-build flows from flow_summary blocks
  const completedFlows = flowData.flowSummaries;

  // No flow data at all
  const hasAnyFlowData = useBlocks || stageDefs.length > 0 || activeFlowType != null || completedFlows.length > 0;

  if (!threadId || !hasAnyFlowData) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground">
          {!threadId
            ? "No thread selected."
            : "No flows yet. Flows will appear here when the agent starts processing your request."}
        </div>
      </div>
    );
  }

  // =========================================================================
  // Build active flow section (block-based or legacy)
  // =========================================================================

  return (
    <div className="p-4 space-y-4">
      {/* Active flow — unified stage timeline for ALL flow types */}
      {activeFlowType && stageDefs.length > 0 && (stream.isLoading || !flowFinished) && (
        <div>
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 mb-3">
            <div className="flex items-center gap-2">
              {stream.isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full bg-blue-600" />
              )}
              <span className="text-sm font-medium text-blue-700">{formatFlowType(activeFlowType)}</span>
              <span className="text-xs text-blue-600">{stream.isLoading ? "in progress" : ""}</span>
            </div>
          </div>

          {/* Stage timeline */}
          <div className="space-y-0">
            {stageDefs.map((stage, idx) => {
              const getStageArtifactsLocal = (stageId: string): Artifact[] => {
                if (!rpabvArtifacts) return [];
                const stageArts = rpabvArtifacts[stageId];
                return Array.isArray(stageArts) ? (stageArts as Artifact[]) : [];
              };
              return (
                <StageTimelineEntry
                  key={stage.id}
                  stage={stage}
                  status={getStageStatus(stage.id, idx, currentStage, stageDefs, flowFinished, rpabvDecisions)}
                  artifacts={getStageArtifactsLocal(stage.id)}
                  isLast={idx === stageDefs.length - 1}
                />
              );
            })}
          </div>

          {/* Decisions audit trail (build flows) */}
          {rpabvDecisions.length > 0 && <DecisionsSection decisions={rpabvDecisions} />}
        </div>
      )}

      {/* Active flow without stages (fallback — spinner only) */}
      {activeFlowType && stageDefs.length === 0 && stream.isLoading && (
        <ActiveNonBuildFlowEntry flowType={activeFlowType} />
      )}

      {/* Completed flows (stacked, latest on top, collapsed by default) */}
      {completedFlows.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Completed Flows
          </div>
          {[...completedFlows].reverse().map((fs, idx) => (
            <CompletedFlowEntry
              key={`completed-flow-${idx}`}
              summary={fs}
            />
          ))}
        </div>
      )}
    </div>
  );
}
