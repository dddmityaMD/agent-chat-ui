"use client";

import React, { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api-url";
import { LoaderCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CostStep {
  operation_type: string;
  label: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
}

interface ThreadCostData {
  steps: CostStep[];
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
}

interface CostTabProps {
  threadId?: string;
}

function formatCost(cost: number | null): string {
  if (cost === null || cost === undefined) return "N/A";
  if (cost < 0.0001) return "<$0.0001";
  return `$${cost.toFixed(4)}`;
}

function abbreviateLabel(label: string, maxLen = 12): string {
  if (label.length <= maxLen) return label;
  return label.slice(0, maxLen - 1) + "\u2026";
}

export function CostTab({ threadId }: CostTabProps) {
  const [data, setData] = useState<ThreadCostData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!threadId) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${getApiBaseUrl()}/api/cost/thread/${threadId}`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  if (!threadId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a thread to view cost data.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-500">
        Failed to load cost data: {error}
      </div>
    );
  }

  if (!data || !data.steps || data.steps.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No cost data yet. Cost tracking data will appear here after sending messages.
      </div>
    );
  }

  const chartData = data.steps.map((s) => ({
    name: abbreviateLabel(s.label),
    cost: s.cost_usd ?? 0,
  }));

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Cost Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1.5 pr-2 font-medium">Operation</th>
              <th className="py-1.5 pr-2 font-medium">Model</th>
              <th className="py-1.5 pr-2 text-right font-medium">In</th>
              <th className="py-1.5 pr-2 text-right font-medium">Out</th>
              <th className="py-1.5 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.steps.map((step, i) => (
              <tr
                key={`${step.operation_type}-${i}`}
                className={i % 2 === 0 ? "bg-muted/30" : ""}
              >
                <td className="py-1.5 pr-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-default font-medium">
                          {step.label}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">{step.operation_type}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </td>
                <td className="py-1.5 pr-2 text-muted-foreground">
                  {step.model || "unknown"}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {step.input_tokens.toLocaleString()}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {step.output_tokens.toLocaleString()}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatCost(step.cost_usd)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="py-1.5 pr-2" colSpan={2}>
                Total
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {data.total_input_tokens.toLocaleString()}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {data.total_output_tokens.toLocaleString()}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {formatCost(data.total_cost_usd)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mini Bar Chart (only if 2+ steps) */}
      {data.steps.length >= 2 && (
        <div className="mt-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Cost per Operation
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={35}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                width={45}
                tickFormatter={(v: number) => `$${v.toFixed(3)}`}
              />
              <RechartsTooltip
                formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
                contentStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
