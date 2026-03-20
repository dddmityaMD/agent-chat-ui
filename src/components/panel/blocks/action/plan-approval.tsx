"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, X } from "lucide-react";

import type { PanelBlock, BlockState, PlanApprovalData } from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PlanApprovalBlockProps {
  block: PanelBlock;
  state: BlockState;
  onAction?: (actionType: string, payload: Record<string, unknown>) => void;
}

/**
 * Action block: Full plan with approve/reject buttons.
 * Amber border, elevated, visually distinct (D-02 action blocks).
 * Reject shows text input for feedback.
 */
export function PlanApprovalBlock({
  block,
  state,
  onAction,
}: PlanApprovalBlockProps) {
  const data = block.data as PlanApprovalData | undefined;
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Loading skeleton
  if (state === "loading" || !data) {
    return (
      <div className="rounded-lg border-2 border-amber-400/40 bg-amber-50/30 dark:bg-amber-950/20 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-4 rounded bg-amber-200/50 animate-pulse" />
          <div className="h-4 w-24 rounded bg-amber-200/50 animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-amber-200/30 animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-amber-200/30 animate-pulse" />
        </div>
      </div>
    );
  }

  const plan = data.plan;
  const toggleStep = (idx: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleApprove = () => {
    onAction?.("approve_plan", { block_id: block.id });
  };

  const handleReject = () => {
    if (showRejectInput) {
      onAction?.("reject_plan", { block_id: block.id, feedback });
      setShowRejectInput(false);
      setFeedback("");
    } else {
      setShowRejectInput(true);
    }
  };

  // Complete state
  if (state === "complete") {
    return (
      <div className="rounded-lg border border-emerald-300/50 bg-emerald-50/20 dark:bg-emerald-950/10 p-3">
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <Check className="w-4 h-4" />
          <span>Plan approved</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/20 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
          Approve Plan
        </span>
      </div>

      {/* Goal */}
      <p className="text-sm text-foreground mb-3">{plan.goal}</p>

      {/* Steps */}
      <div className="space-y-1.5 mb-4">
        {plan.steps.map((step, idx) => (
          <div key={idx} className="text-sm">
            <button
              onClick={() => step.sql && toggleStep(idx)}
              className="flex items-center gap-1.5 text-left w-full hover:bg-amber-100/40 dark:hover:bg-amber-900/20 rounded px-1.5 py-0.5 transition-colors"
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
              <span className="text-foreground">{step.description}</span>
            </button>

            {/* Expanded SQL preview */}
            {step.sql && expandedSteps.has(idx) && (
              <pre className="ml-7 mt-1 p-2 rounded bg-muted text-xs text-muted-foreground overflow-auto max-h-32 whitespace-pre-wrap break-words">
                {step.sql}
              </pre>
            )}
          </div>
        ))}
      </div>

      {/* Reject feedback input */}
      {showRejectInput && (
        <div className="mb-3">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What should be changed?"
            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            rows={2}
            autoFocus
          />
        </div>
      )}

      {/* Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleApprove}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          Approve
        </button>
        <button
          onClick={handleReject}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          {showRejectInput ? "Send Feedback" : "Reject + Feedback"}
        </button>
      </div>
    </div>
  );
}
