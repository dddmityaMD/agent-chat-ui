"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, AlertCircle } from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  ConfidenceAssessmentData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Maturity level colors
// ---------------------------------------------------------------------------

const LEVEL_COLORS: Record<string, string> = {
  L1: "bg-red-400",
  L2: "bg-amber-400",
  L3: "bg-blue-400",
  L4: "bg-emerald-400",
};

const LEVEL_PROGRESS: Record<string, number> = {
  L1: 25,
  L2: 50,
  L3: 75,
  L4: 100,
};

const LEVEL_LABELS: Record<string, string> = {
  L1: "PERCEPTION",
  L2: "COMPREHENSION",
  L3: "INSIGHT",
  L4: "ACTION-READY",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ConfidenceAssessmentBlockProps {
  block: PanelBlock;
  state: BlockState;
}

/**
 * L2 confidence-assessment block: progress bar for maturity level (L1-L4)
 * with remaining gaps listed below.
 *
 * Compact: "L3 INSIGHT | 1 gap remaining"
 * Expanded: gap details
 * Persistent (D-10).
 */
export function ConfidenceAssessmentBlock({
  block,
  state,
}: ConfidenceAssessmentBlockProps) {
  const data = block.data as ConfidenceAssessmentData | undefined;
  const [expanded, setExpanded] = useState(false);

  // Loading
  if (state === "loading" || !data) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-muted-foreground/20 animate-pulse" />
          <div className="h-3 w-24 rounded bg-muted-foreground/20 animate-pulse" />
        </div>
      </div>
    );
  }

  const level = data.maturity_level;
  const gaps = data.gaps ?? [];
  const progress = LEVEL_PROGRESS[level] ?? 25;
  const barColor = LEVEL_COLORS[level] ?? "bg-muted-foreground";
  const label = LEVEL_LABELS[level] ?? level;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      {/* Header */}
      <button
        onClick={() => gaps.length > 0 && setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        {gaps.length > 0 ? (
          expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          )
        ) : (
          <span className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Confidence
        </span>
        <span className="text-xs font-semibold text-foreground">
          {level} {label}
        </span>
        {gaps.length > 0 && (
          <span className="text-xs text-muted-foreground/60">
            | {gaps.length} gap{gaps.length !== 1 ? "s" : ""} remaining
          </span>
        )}
      </button>

      {/* Progress bar */}
      <div className="mt-2 ml-5">
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className={`h-1.5 rounded-full transition-all ${barColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Expanded: gap list */}
      {expanded && gaps.length > 0 && (
        <div className="mt-2 ml-5 space-y-1">
          {gaps.map((gap, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-xs">
              <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
              <span className="text-foreground">{gap}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
