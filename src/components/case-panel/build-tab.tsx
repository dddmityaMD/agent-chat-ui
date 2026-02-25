"use client";

/**
 * Build tab - Vertical timeline showing RPABV stage progression with artifacts.
 *
 * PRIMARY source: block messages from REST (interrupt_card, interrupt_decision,
 * flow_summary blocks). These persist across page refresh and survive flow
 * completion — fixing the build-tab-empty-after-completion bug.
 *
 * FALLBACK: useSaisUi() for legacy threads that predate block messages (23.4).
 *
 * Data flow:
 * 1. extractBuildData(messages) scans all AI messages for blocks
 * 2. If interrupt_card blocks found → render from blocks (new path)
 * 3. If no blocks → fall back to sais_ui (legacy path)
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

/** Extracted build data from block messages */
interface BuildDataFromBlocks {
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
  /** Flow summary from flow_summary blocks */
  flowSummary: FlowSummaryBlockData | null;
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
 * Extract build data from REST-fetched block messages.
 *
 * Scans all AI messages for:
 * - interrupt_card blocks: RPABV stage cards with artifacts + decisions
 * - interrupt_decision blocks: separate decision records
 * - flow_summary blocks: overall flow completion
 */
function extractBuildData(messages: Message[]): BuildDataFromBlocks {
  const timelineEntries: BuildDataFromBlocks["timelineEntries"] = [];
  const decisions: RpabvDecision[] = [];
  let flowSummary: FlowSummaryBlockData | null = null;
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
        flowSummary = block as FlowSummaryBlockData;
      }
    }
  }

  // Pair decisions with timeline entries by card_type (chronological matching)
  const decisionByCardType = new Map<string, typeof decisions[number]>();
  for (const dec of decisions) {
    // Keep last decision per gate type (most recent)
    decisionByCardType.set(dec.gate_type, dec);
  }

  // Enrich timeline entries with paired decisions from interrupt_decision blocks
  for (const entry of timelineEntries) {
    const stageId = CARD_TYPE_TO_STAGE[entry.cardType] ?? entry.cardType;
    const paired = decisionByCardType.get(stageId);
    if (paired && !entry.decision) {
      entry.decision = paired.action;
      entry.feedback = paired.feedback;
      entry.decidedAt = paired.timestamp;
    }
  }

  return { timelineEntries, decisions, flowSummary, hasBlockData };
}

// ---------------------------------------------------------------------------
// Legacy helpers (sais_ui path)
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
  entry: BuildDataFromBlocks["timelineEntries"][number];
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
        {/* Status dot */}
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
        {/* Vertical line */}
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
      {/* Action icon */}
      {decision.action === "approved" ? (
        <CheckCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Step context for L3 */}
          {decision.step_index != null && (
            <span className="text-muted-foreground font-medium">
              Step {decision.step_index + 1}
            </span>
          )}

          {/* Gate type badge */}
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

          {/* Action text */}
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

          {/* Timestamp */}
          <span className="flex items-center gap-0.5 text-muted-foreground/70">
            <Clock className="h-2.5 w-2.5" />
            {formatRelativeTime(decision.timestamp)}
          </span>
        </div>

        {/* Feedback */}
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
// Flow Summary Banner (block-based path)
// ---------------------------------------------------------------------------

function FlowSummaryBanner({ summary }: { summary: FlowSummaryBlockData }) {
  const label = summary.flow_type
    ? summary.flow_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Flow";

  return (
    <div className="mb-3 rounded-md border bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
      {label} complete — {summary.stages_completed} of {summary.stages_total} stages
    </div>
  );
}

// ---------------------------------------------------------------------------
// BuildTab
// ---------------------------------------------------------------------------

export function BuildTab({ threadId }: { threadId?: string | null }) {
  const saisUi = useSaisUi();
  const stream = useStreamContext();
  const raw = saisUi.raw;

  // Extract build data from REST-fetched block messages
  const buildData = useMemo(
    () => extractBuildData(stream.messages),
    [stream.messages],
  );

  // Determine which data source to use:
  // If block messages contain interrupt_card data, use blocks (new path)
  // Otherwise fall back to sais_ui (legacy path)
  const useBlocks = buildData.hasBlockData;

  // --- Legacy sais_ui data (used when no block data) ---
  const stageDefs = extractArray(raw, "stage_definitions") as StageDefinition[];
  const currentStage = extractString(raw, "rpabv_stage");
  const buildPlanStatus = extractString(raw, "build_plan_status");
  const flowFinished = buildPlanStatus === "completed" || buildPlanStatus === "failed";
  const rpabvArtifacts = extractObject(raw, "rpabv_artifacts");
  const rpabvProgress = extractObject(raw, "rpabv_progress");
  const rpabvDecisions = extractArray(raw, "rpabv_decisions") as RpabvDecision[];

  // L3 step info (legacy)
  const currentLevel = rpabvProgress
    ? (rpabvProgress.level as number | undefined)
    : undefined;
  const currentStepIndex = rpabvProgress
    ? (rpabvProgress.step_index as number | undefined)
    : undefined;
  const totalSteps = rpabvProgress
    ? (rpabvProgress.total_steps as number | undefined)
    : undefined;
  const isL3 = currentLevel === 3 && totalSteps != null && totalSteps > 1;

  // No build data yet (neither blocks nor sais_ui)
  if (!threadId || (!useBlocks && stageDefs.length === 0)) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground">
          {!threadId
            ? "No thread selected."
            : "No build flow active. Start a build request to see stage progression."}
        </div>
      </div>
    );
  }

  // =========================================================================
  // Block-based rendering (new path)
  // =========================================================================
  if (useBlocks) {
    const isFlowFinished = !!buildData.flowSummary;

    return (
      <div className="p-4">
        {/* Flow summary banner */}
        {buildData.flowSummary && (
          <FlowSummaryBanner summary={buildData.flowSummary} />
        )}

        {/* Block-based vertical timeline */}
        <div className="space-y-0">
          {buildData.timelineEntries.map((entry, idx) => (
            <BlockTimelineEntry
              key={`${entry.cardType}-${idx}`}
              entry={entry}
              isLast={idx === buildData.timelineEntries.length - 1}
              isFlowFinished={isFlowFinished}
            />
          ))}
        </div>

        {/* Decisions audit trail (from interrupt_decision blocks) */}
        <DecisionsSection decisions={buildData.decisions} />
      </div>
    );
  }

  // =========================================================================
  // Legacy sais_ui rendering (fallback)
  // =========================================================================

  const getStageArtifacts = (stageId: string): Artifact[] => {
    if (!rpabvArtifacts) return [];
    const stageArts = rpabvArtifacts[stageId];
    return Array.isArray(stageArts) ? (stageArts as Artifact[]) : [];
  };

  return (
    <div className="p-4">
      {/* L3 progress header */}
      {isL3 && currentStepIndex != null && totalSteps != null && (
        <div className="mb-3 rounded-md border bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Multi-step build: Step {currentStepIndex + 1} of {totalSteps}
        </div>
      )}

      {/* Vertical timeline */}
      <div className="space-y-0">
        {stageDefs.map((stage, idx) => (
          <StageTimelineEntry
            key={stage.id}
            stage={stage}
            status={getStageStatus(stage.id, idx, currentStage, stageDefs, flowFinished, rpabvDecisions)}
            artifacts={getStageArtifacts(stage.id)}
            isLast={idx === stageDefs.length - 1}
          />
        ))}
      </div>

      {/* Decisions audit trail */}
      <DecisionsSection decisions={rpabvDecisions} />
    </div>
  );
}
