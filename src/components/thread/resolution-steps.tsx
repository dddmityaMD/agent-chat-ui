// TODO: Backend does not currently produce resolution_steps payloads.
// This component is restored for future backend integration when the resolver
// emits step-by-step resolution progress to sais_ui.resolution_steps.

"use client";

import { CheckCircle2 } from "lucide-react";
import type { ResolutionStepsPayload } from "@/lib/types";

interface ResolutionStepsProps {
  payload: ResolutionStepsPayload;
}

/**
 * ResolutionSteps shows resolver progress as gray debugging text.
 *
 * Per CONTEXT.md "verbose steps (gray text)" - this component renders
 * the resolution attempts for each scope with confidence scores.
 *
 * Shown when sais_ui.resolution_steps exists.
 */
export function ResolutionSteps({ payload }: ResolutionStepsProps) {
  if (!payload.steps || payload.steps.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="resolver-step"
      className="my-2 space-y-1 border-l-2 border-gray-200 pl-4 font-mono text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"
    >
      {payload.steps.map((step, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-gray-400 dark:text-gray-500">
            [{step.scope}]
          </span>
          <span>{step.action}</span>
          {step.result && (
            <span className="text-gray-600 dark:text-gray-400">
              {"->"} {step.result}
            </span>
          )}
          {step.confidence !== undefined && (
            <span className="text-gray-400 dark:text-gray-500">
              ({(step.confidence * 100).toFixed(0)}%)
            </span>
          )}
        </div>
      ))}
      {payload.final_result && (
        <div className="mt-1 flex items-center gap-1.5 font-medium text-gray-600 dark:text-gray-400">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          {payload.final_result}
        </div>
      )}
    </div>
  );
}

export default ResolutionSteps;
