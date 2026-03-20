"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  MapPin,
  CheckCircle2,
  Circle,
  ArrowRight,
} from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  RoadmapData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string }
> = {
  complete: {
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  current: {
    icon: ArrowRight,
    color: "text-primary",
  },
  pending: {
    icon: Circle,
    color: "text-muted-foreground/40",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RoadmapBlockProps {
  block: PanelBlock;
  state: BlockState;
}

/**
 * L3 roadmap block: project phases as vertical timeline.
 *
 * Compact: "Roadmap: 3 phases, 1 current"
 * Expanded: vertical timeline with status icons.
 */
export function RoadmapBlock({ block, state }: RoadmapBlockProps) {
  const data = block.data as RoadmapData | undefined;
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

  const phases = data.phases ?? [];
  const currentPhase = phases.find((p) => p.status === "current");
  const completedCount = phases.filter((p) => p.status === "complete").length;

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
        <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Roadmap
        </span>
        <span className="text-xs text-muted-foreground/60">
          {completedCount}/{phases.length} complete
        </span>
      </button>

      {/* Compact: current phase */}
      {!expanded && currentPhase && (
        <p className="text-xs text-foreground mt-1.5 ml-5 truncate">
          Current: {currentPhase.name}
        </p>
      )}

      {/* Expanded: vertical timeline */}
      {expanded && (
        <div className="mt-2 ml-5 relative">
          {/* Timeline line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-2">
            {phases.map((phase, idx) => {
              const config =
                STATUS_CONFIG[phase.status] ?? STATUS_CONFIG.pending;
              const Icon = config.icon;
              return (
                <div key={idx} className="flex items-start gap-2.5 relative">
                  <Icon
                    className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${config.color} bg-background`}
                  />
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-xs font-medium ${phase.status === "current" ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {phase.name}
                    </span>
                    <p className="text-[10px] text-muted-foreground/70 truncate">
                      {phase.goal}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
