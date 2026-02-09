"use client";

/**
 * Context Budget - Token budget usage display.
 *
 * Shows token budget used vs a reference maximum as a progress bar
 * and text indicator. The maximum is approximate since the actual
 * model context window varies by provider.
 */

import { cn } from "@/lib/utils";

/** Approximate context budget ceiling (tokens). */
const DEFAULT_MAX_TOKENS = 8000;

interface ContextBudgetProps {
  tokenBudgetUsed: number;
  maxTokens?: number;
}

export function ContextBudget({
  tokenBudgetUsed,
  maxTokens = DEFAULT_MAX_TOKENS,
}: ContextBudgetProps) {
  if (tokenBudgetUsed === 0) {
    return (
      <section>
        <h3 className="mb-1 text-sm font-semibold">Token Budget</h3>
        <p className="text-muted-foreground text-xs">
          No token usage recorded.
        </p>
      </section>
    );
  }

  const pct = Math.min((tokenBudgetUsed / maxTokens) * 100, 100);
  const isHigh = pct >= 80;
  const isMedium = pct >= 50 && pct < 80;

  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold">Token Budget</h3>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-gray-200">
          <div
            className={cn(
              "h-2 rounded-full transition-all",
              isHigh
                ? "bg-red-500"
                : isMedium
                  ? "bg-yellow-500"
                  : "bg-green-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-muted-foreground whitespace-nowrap text-xs">
          {tokenBudgetUsed.toLocaleString()} / {maxTokens.toLocaleString()}
        </span>
      </div>
      {isHigh && (
        <p className="mt-1 text-xs text-red-600">
          High token usage -- context may be truncated.
        </p>
      )}
    </section>
  );
}
