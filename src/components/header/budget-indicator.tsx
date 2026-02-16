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

function getColorClass(percentUsed: number): string {
  if (percentUsed > 0.8) return "text-red-600";
  if (percentUsed > 0.6) return "text-yellow-600";
  return "text-green-600";
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

  const colorClass = getColorClass(budget.percent_used);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 text-xs tabular-nums ${colorClass}`}
          >
            <span>{formatTokens(budget.total_tokens)}</span>
            <span className="text-muted-foreground">tokens</span>
            <span>(~{formatCost(budget.used_usd)})</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">
            Monthly budget: {formatCost(budget.used_usd)} used of{" "}
            {formatCost(budget.limit_usd)} limit
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
