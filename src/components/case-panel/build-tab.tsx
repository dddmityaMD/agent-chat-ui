"use client";

/**
 * Build tab - Vertical timeline showing RPABV stage progression with artifacts.
 *
 * Reads from useSaisUi() for all build flow data:
 * - stage_definitions: flow-declared stages
 * - rpabv_stage: current active stage
 * - rpabv_artifacts: per-stage artifact collections
 * - rpabv_progress: level/step info for L3 display
 * - rpabv_decisions: chronological audit trail of user decisions
 *
 * Persists within thread (sais_ui is thread-scoped). New thread = clean slate.
 */

import React, { useState } from "react";
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
import { cn } from "@/lib/utils";

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

/** Derive stage status from current stage position */
function getStageStatus(
  stageId: string,
  stageIndex: number,
  currentStageId: string | null,
  stages: StageDefinition[],
): "completed" | "active" | "pending" {
  if (!currentStageId) return "pending";
  const currentIdx = stages.findIndex((s) => s.id === currentStageId);
  if (currentIdx < 0) return "pending";
  if (stageIndex < currentIdx) return "completed";
  if (stageIndex === currentIdx) return "active";
  return "pending";
}

// ---------------------------------------------------------------------------
// Stage Timeline Entry
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
// L3 Step Group Header
// ---------------------------------------------------------------------------

function StepGroupHeader({
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

const GATE_TYPE_COLORS: Record<string, string> = {
  research: "bg-violet-100 text-violet-700",
  plan: "bg-blue-100 text-blue-700",
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
          <div
            key={`decision-${i}`}
            className="flex items-start gap-2 text-xs"
          >
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
                  <span className="text-muted-foreground">
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
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BuildTab
// ---------------------------------------------------------------------------

export function BuildTab({ threadId }: { threadId?: string | null }) {
  const saisUi = useSaisUi();
  const raw = saisUi.raw;

  // Read stage definitions from sais_ui
  const stageDefs = extractArray(raw, "stage_definitions") as StageDefinition[];
  const currentStage = extractString(raw, "rpabv_stage");
  const rpabvArtifacts = extractObject(raw, "rpabv_artifacts");
  const rpabvProgress = extractObject(raw, "rpabv_progress");
  const rpabvDecisions = extractArray(raw, "rpabv_decisions") as RpabvDecision[];

  // L3 step info
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

  // No build data yet
  if (!threadId || stageDefs.length === 0) {
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

  // Get artifacts for a stage
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
            status={getStageStatus(stage.id, idx, currentStage, stageDefs)}
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
