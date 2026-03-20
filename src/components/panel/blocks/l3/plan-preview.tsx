"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ListOrdered,
  ExternalLink,
  AlertTriangle,
  Shield,
} from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  PlanPreviewData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Risk badge
// ---------------------------------------------------------------------------

const RISK_COLORS: Record<string, string> = {
  low: "text-emerald-600 dark:text-emerald-400",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-red-500 dark:text-red-400",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PlanPreviewBlockProps {
  block: PanelBlock;
  state: BlockState;
  onCanvasOpen?: (contentType: string, contentData: unknown) => void;
}

/**
 * L3 plan-preview block: numbered build plan steps with expandable SQL.
 *
 * Compact: "Plan: 4 steps, 2 new models, risk: low"
 * Expanded: numbered step list with SQL toggle.
 * Canvas expand: opens code renderer (D-15).
 */
export function PlanPreviewBlock({
  block,
  state,
  onCanvasOpen,
}: PlanPreviewBlockProps) {
  const data = block.data as PlanPreviewData | undefined;
  const [expanded, setExpanded] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  if (state === "loading" || !data) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-muted-foreground/20 animate-pulse" />
          <div className="h-3 w-32 rounded bg-muted-foreground/20 animate-pulse" />
        </div>
      </div>
    );
  }

  const steps = data.steps ?? [];
  const risk = data.risk ?? "low";
  const impact = data.impact ?? { new_files: 0, modified_files: 0 };
  const riskColor = RISK_COLORS[risk] ?? RISK_COLORS.low;

  const toggleStep = (idx: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <ListOrdered className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Plan
        </span>
        <span className="text-xs text-muted-foreground/60">
          {steps.length} steps, {impact.new_files} new
        </span>
      </button>

      {/* Compact */}
      {!expanded && (
        <p className="text-xs text-foreground mt-1.5 ml-5 flex items-center gap-2">
          <span className={`flex items-center gap-0.5 ${riskColor}`}>
            <Shield className="w-3 h-3" />
            Risk: {risk}
          </span>
        </p>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="mt-2 ml-5 space-y-1.5">
          {steps.map((step, idx) => (
            <div key={idx} className="text-sm">
              <button
                onClick={() => step.sql && toggleStep(idx)}
                className="flex items-center gap-1.5 text-left w-full hover:bg-muted/50 rounded px-1.5 py-0.5 transition-colors"
              >
                {step.sql ? (
                  expandedSteps.has(idx) ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  )
                ) : (
                  <span className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span className="text-muted-foreground text-xs mr-1.5">
                  {idx + 1}.
                </span>
                <span className="text-foreground text-xs">
                  {step.description}
                </span>
              </button>

              {step.sql && expandedSteps.has(idx) && (
                <pre className="ml-7 mt-1 p-2 rounded bg-muted text-xs text-muted-foreground overflow-auto max-h-32 whitespace-pre-wrap break-words">
                  {step.sql}
                </pre>
              )}
            </div>
          ))}

          {/* Impact + risk footer */}
          <div className="flex items-center gap-3 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
            <span>
              {impact.new_files} new, {impact.modified_files} modified
            </span>
            <span className={`flex items-center gap-0.5 ${riskColor}`}>
              {risk === "high" && (
                <AlertTriangle className="w-3 h-3" />
              )}
              Risk: {risk}
            </span>
          </div>

          {/* Canvas expand (D-15) */}
          {onCanvasOpen && steps.some((s) => s.sql) && (
            <button
              onClick={() => onCanvasOpen("code", { steps })}
              className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View SQL
            </button>
          )}
        </div>
      )}
    </div>
  );
}
