"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Check,
  Plus,
} from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  KpiSuggestionsData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface KpiSuggestionsBlockProps {
  block: PanelBlock;
  state: BlockState;
  onAction?: (actionType: string, payload: Record<string, unknown>) => void;
}

/**
 * L3 kpi-suggestions block: KPI list with name, formula, [Register] button.
 *
 * Compact: "3 KPIs discovered"
 * Expanded: list with register action.
 */
export function KpiSuggestionsBlock({
  block,
  state,
  onAction,
}: KpiSuggestionsBlockProps) {
  const data = block.data as KpiSuggestionsData | undefined;
  const [expanded, setExpanded] = useState(false);

  if (state === "loading" || !data) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-muted-foreground/20 animate-pulse" />
          <div className="h-3 w-24 rounded bg-muted-foreground/20 animate-pulse" />
        </div>
      </div>
    );
  }

  const suggestions = data.suggestions ?? [];
  const registeredCount = suggestions.filter((s) => s.registered).length;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <TrendingUp className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          KPIs
        </span>
        <span className="text-xs text-muted-foreground/60">
          {suggestions.length} discovered
          {registeredCount > 0 && `, ${registeredCount} registered`}
        </span>
      </button>

      {/* Compact: KPI names */}
      {!expanded && suggestions.length > 0 && (
        <p className="text-xs text-foreground mt-1.5 ml-5 truncate">
          {suggestions.map((s) => s.name).join(", ")}
        </p>
      )}

      {/* Expanded: full list with register buttons */}
      {expanded && (
        <div className="mt-2 ml-5 space-y-1.5">
          {suggestions.map((kpi, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 text-xs py-1.5 px-1.5 rounded hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium text-foreground">{kpi.name}</span>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  {kpi.formula}
                </p>
              </div>
              {kpi.registered ? (
                <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                  <Check className="w-3 h-3" />
                  Registered
                </span>
              ) : (
                <button
                  onClick={() =>
                    onAction?.("register_kpi", {
                      block_id: block.id,
                      kpi_name: kpi.name,
                      kpi_index: idx,
                    })
                  }
                  className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-medium rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
                >
                  <Plus className="w-2.5 h-2.5" />
                  Register
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
