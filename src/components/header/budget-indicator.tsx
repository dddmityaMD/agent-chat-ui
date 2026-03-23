"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "@/lib/api-url";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BudgetStatus {
  used_usd: number;
  limit_usd: number;
  remaining_usd: number;
  percent_used: number;
  warning_active: boolean;
  total_tokens: number;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return tokens.toString();
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

export function BudgetIndicator() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const warnedRef = useRef(false);

  const fetchBudget = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/cost/budget`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data: BudgetStatus = await res.json();
      setBudget(data);

      // One-time toast at 80% threshold
      if (data.warning_active && !warnedRef.current) {
        warnedRef.current = true;
        const pct = Math.round(data.percent_used * 100);
        toast.warning(
          `Budget alert: You've used ${pct}% of your monthly limit (${formatCost(data.used_usd)} of ${formatCost(data.limit_usd)})`,
          {
            duration: 8000,
            closeButton: true,
          },
        );
      }
    } catch {
      // Silently ignore budget fetch failures
    }
  }, []);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  // Re-fetch budget when stream completes (listen for custom event)
  useEffect(() => {
    const handler = () => fetchBudget();
    window.addEventListener("sais:stream-complete", handler);
    return () => window.removeEventListener("sais:stream-complete", handler);
  }, [fetchBudget]);

  if (!budget) return null;

  const pct = Math.min(budget.percent_used, 1);
  const barColor =
    pct > 0.8
      ? "bg-red-500"
      : pct > 0.6
        ? "bg-yellow-500"
        : "bg-emerald-500";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
              Budget
            </span>
            <div className="h-2 w-20 rounded-full bg-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.round(pct * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {formatCost(budget.used_usd)}/{formatCost(budget.limit_usd)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">
            Monthly budget: {formatCost(budget.used_usd)} of{" "}
            {formatCost(budget.limit_usd)} ({Math.round(pct * 100)}%)
          </p>
          <p className="text-xs text-muted-foreground">
            {formatTokens(budget.total_tokens)} tokens total
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
