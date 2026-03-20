"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// WorkflowProgressBar — compact inline breadcrumb for multi-step workflows
// ---------------------------------------------------------------------------

interface WorkflowProgressBarProps {
  steps: string[];
  currentStep: number;
  completedSteps: number[];
}

/**
 * Compact inline breadcrumb for multi-step workflows in chat.
 * Shows step names with status icons: completed (check), current (spinner), pending (circle).
 *
 * Example: "Research [check] -> Plan [spinner] -> Build [circle] -> Verify [circle]"
 */
export function WorkflowProgressBar({
  steps,
  currentStep,
  completedSteps,
}: WorkflowProgressBarProps) {
  if (steps.length === 0) return null;

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {steps.map((step, idx) => {
        const isCompleted = completedSteps.includes(idx);
        const isCurrent = idx === currentStep;

        return (
          <span key={idx} className="flex items-center gap-1">
            {idx > 0 && (
              <span
                className={cn(
                  "mx-0.5",
                  isCompleted || isCurrent
                    ? "text-muted-foreground"
                    : "text-muted-foreground/40",
                )}
              >
                {"\u2192"}
              </span>
            )}
            {isCompleted ? (
              <Check className="h-3 w-3 flex-shrink-0 text-emerald-500" />
            ) : isCurrent ? (
              <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-blue-500" />
            ) : (
              <Circle className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground/40" />
            )}
            <span
              className={cn(
                isCurrent && "font-medium text-foreground",
                isCompleted && "text-muted-foreground",
                !isCompleted && !isCurrent && "text-muted-foreground/50",
              )}
            >
              {step}
            </span>
          </span>
        );
      })}
    </div>
  );
}
