"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  ExternalLink,
  BarChart3,
  PieChart,
  LineChart,
  Table2,
  TrendingUp,
} from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  BiDashboardMetadataData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Visualization icon mapping
// ---------------------------------------------------------------------------

const VIZ_ICONS: Record<string, React.ElementType> = {
  bar: BarChart3,
  pie: PieChart,
  line: LineChart,
  table: Table2,
  number: TrendingUp,
  scalar: TrendingUp,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BiDashboardMetadataBlockProps {
  block: PanelBlock;
  state: BlockState;
}

/**
 * L3 bi-dashboard-metadata block (D-08 Approach A):
 * Dashboard name, card list (name, KPI, visualization type).
 * Prominent "Open in Metabase" link. If no metabaseUrl: "Not yet published" muted.
 *
 * Compact: "Dashboard: Sales Overview (4 cards)"
 * Expanded: card list with viz icons.
 */
export function BiDashboardMetadataBlock({
  block,
  state,
}: BiDashboardMetadataBlockProps) {
  const data = block.data as BiDashboardMetadataData | undefined;
  const [expanded, setExpanded] = useState(false);

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

  const cards = data.cards ?? [];

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
        <LayoutDashboard className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Dashboard
        </span>
        <span className="text-xs text-foreground font-medium truncate">
          {data.dashboardName}
        </span>
        <span className="text-xs text-muted-foreground/60 flex-shrink-0">
          ({cards.length} cards)
        </span>
      </button>

      {/* Expanded: card list + Metabase link */}
      {expanded && (
        <div className="mt-2 ml-5 space-y-1.5">
          {cards.map((card, idx) => {
            const VizIcon =
              VIZ_ICONS[card.visualization.toLowerCase()] ?? BarChart3;
            return (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs py-1 px-1.5 rounded hover:bg-muted/50 transition-colors"
              >
                <VizIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="font-medium text-foreground">{card.name}</span>
                {card.kpiName && (
                  <span className="text-[10px] text-primary/70 flex-shrink-0">
                    {card.kpiName}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground/50 ml-auto flex-shrink-0">
                  {card.visualization}
                </span>
              </div>
            );
          })}

          {/* Open in Metabase link */}
          {data.metabaseUrl ? (
            <a
              href={data.metabaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-fit"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in Metabase
            </a>
          ) : (
            <p className="text-[11px] text-muted-foreground/60 mt-2 italic">
              Not yet published
            </p>
          )}
        </div>
      )}
    </div>
  );
}
