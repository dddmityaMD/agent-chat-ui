'use client';

import { GitBranch, GitMerge, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MultiIntentPayload, DecomposedIntent, IntentResult } from '@/lib/types';

interface MultiIntentResultProps {
  payload: MultiIntentPayload;
}

/**
 * MultiIntentResult shows decomposed intent execution with transparency.
 *
 * Displays:
 * - Intent decomposition (what intents were extracted)
 * - Parallel vs sequential execution indicator (header only, not per-intent)
 * - Per-intent status and results
 * - Merged output summary
 */
export function MultiIntentResult({ payload }: MultiIntentResultProps) {
  const { intents, results, was_parallel, merged_output } = payload;

  return (
    <div
      data-testid="multi-intent-result"
      className="rounded-lg border border-purple-200 bg-purple-50 p-4 my-2 dark:border-purple-800 dark:bg-purple-950"
    >
      {/* Header with execution mode */}
      <div className="flex items-center gap-2 mb-3" data-testid="multi-intent-header">
        {was_parallel ? (
          <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        ) : (
          <GitMerge className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        )}
        <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
          {intents.length} intents detected
          {was_parallel ? ' (executed in parallel)' : ' (executed sequentially)'}
        </span>
      </div>

      {/* Intent list with results */}
      <div className="space-y-2">
        {intents.map((intent, idx) => {
          const result = results.find((r) => r.index === idx);

          return (
            <IntentItem
              key={idx}
              index={idx}
              intent={intent}
              result={result}
            />
          );
        })}
      </div>

      {/* Merged output summary (expandable) */}
      {merged_output && Object.keys(merged_output).length > 0 && (
        <details className="mt-3 pt-2 border-t border-purple-200 dark:border-purple-700">
          <summary className="text-xs cursor-pointer text-purple-600 dark:text-purple-400 hover:underline">
            View merged output
          </summary>
          <pre className="mt-2 p-2 bg-white dark:bg-purple-900 rounded text-xs overflow-x-auto">
            {JSON.stringify(merged_output, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function IntentItem({
  index,
  intent,
  result,
}: {
  index: number;
  intent: DecomposedIntent;
  result?: IntentResult;
}) {
  const success = result?.success ?? false;

  return (
    <div
      data-testid="intent-item"
      className={cn(
        'flex items-start gap-2 p-2 rounded',
        success
          ? 'bg-white dark:bg-purple-900'
          : 'bg-red-50 dark:bg-red-950'
      )}
    >
      {/* Status icon */}
      <div className="mt-0.5">
        {success ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        ) : (
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
        )}
      </div>

      {/* Intent content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
            {index + 1}. {intent.intent_text}
          </span>
          {intent.skill_hint && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-200 dark:bg-purple-700 text-purple-700 dark:text-purple-200">
              {intent.skill_hint}
            </span>
          )}
          {intent.is_write_capable && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-700 text-amber-700 dark:text-amber-200">
              write
            </span>
          )}
        </div>

        {/* Dependencies */}
        {intent.depends_on.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Depends on: {intent.depends_on.map((d) => d + 1).join(', ')}
          </p>
        )}

        {/* Error message */}
        {result && !result.success && result.error && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {result.error}
          </p>
        )}
      </div>
    </div>
  );
}

export default MultiIntentResult;
