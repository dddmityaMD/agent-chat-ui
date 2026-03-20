"use client";

import { Check, Circle, CircleDot } from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  WorkflowPositionData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Step status icon
// ---------------------------------------------------------------------------

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case "complete":
      return <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />;
    case "current":
      return <CircleDot className="w-3 h-3 text-primary flex-shrink-0" />;
    default:
      return <Circle className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WorkflowPositionBlockProps {
  block: PanelBlock;
  state: BlockState;
}

/**
 * L2 workflow-position block: breadcrumb showing workflow steps
 * with status icons (complete, current, pending).
 *
 * Always compact -- no expanded view needed (simple breadcrumb).
 * Persistent (D-10).
 */
export function WorkflowPositionBlock({
  block,
  state,
}: WorkflowPositionBlockProps) {
  const data = block.data as WorkflowPositionData | undefined;

  // Loading
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

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Workflow
      </span>
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-center gap-1">
            {idx > 0 && (
              <span className="text-muted-foreground/30 text-xs mx-0.5">
                &rarr;
              </span>
            )}
            <StepIcon status={step.status} />
            <span
              className={`text-xs ${
                step.status === "current"
                  ? "font-medium text-foreground"
                  : step.status === "complete"
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50"
              }`}
            >
              {step.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
