'use client';

import { CheckCircle2 } from 'lucide-react';
import type { ResolutionStepsPayload } from '@/lib/types';

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
      className="text-xs text-gray-500 font-mono space-y-1 my-2 pl-4 border-l-2 border-gray-200 dark:text-gray-400 dark:border-gray-700"
    >
      {payload.steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 flex-wrap">
          <span className="text-gray-400 dark:text-gray-500">[{step.scope}]</span>
          <span>{step.action}</span>
          {step.result && (
            <span className="text-gray-600 dark:text-gray-400">
              {'->'} {step.result}
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
        <div className="font-medium text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          {payload.final_result}
        </div>
      )}
    </div>
  );
}

export default ResolutionSteps;
