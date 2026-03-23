"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Database,
  BarChart3,
  Table2,
  Layers,
  HelpCircle,
  ExternalLink,
} from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  EntityMapData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Entity type icon mapping
// ---------------------------------------------------------------------------

const ENTITY_TYPE_ICONS: Record<string, React.ElementType> = {
  table: Table2,
  column: Layers,
  model: Database,
  dashboard: BarChart3,
};

function getEntityIcon(type: string) {
  return ENTITY_TYPE_ICONS[type] ?? HelpCircle;
}

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : pct >= 50
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-500 dark:text-red-400";

  return <span className={`text-[10px] font-medium ${color}`}>{pct}%</span>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EntityMapBlockProps {
  block: PanelBlock;
  state: BlockState;
  onCanvasOpen?: (contentType: string, contentData: unknown) => void;
  onLineageOpen?: (entityKey: string) => void;
}

/**
 * L2 entity-map block: resolved entities with confidence, type icon,
 * and canvas expand affordance for lineage (D-14).
 *
 * Persistent -- appears when entities arrive, never disappears (D-10).
 */
export function EntityMapBlock({
  block,
  state,
  onCanvasOpen,
  onLineageOpen,
}: EntityMapBlockProps) {
  const data = block.data as EntityMapData | undefined;
  const [expanded, setExpanded] = useState(false);

  // Loading state
  if (state === "loading" || !data) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-muted-foreground/20 animate-pulse" />
          <div className="h-3 w-20 rounded bg-muted-foreground/20 animate-pulse" />
        </div>
      </div>
    );
  }

  const entities = data.entities ?? [];
  const resolvedCount = entities.filter((e) => e.resolved).length;

  // Compact view: one-liner summary
  const compactLine =
    entities.length <= 3
      ? entities.map((e) => e.name).join(", ")
      : `${entities
          .slice(0, 3)
          .map((e) => e.name)
          .join(", ")} +${entities.length - 3}`;

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
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Entities
        </span>
        <span className="text-xs text-muted-foreground/60">
          {resolvedCount}/{entities.length} resolved
        </span>
      </button>

      {/* Compact: name list */}
      {!expanded && (
        <p className="text-xs text-foreground mt-1.5 ml-5 truncate">
          {compactLine}
        </p>
      )}

      {/* Expanded: full entity cards */}
      {expanded && (
        <div className="mt-2 ml-5 space-y-1.5">
          {entities.map((entity, idx) => {
            const Icon = getEntityIcon(entity.type);
            return (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs py-1 px-1.5 rounded hover:bg-muted/50 transition-colors"
              >
                <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span
                  className={`font-medium ${entity.resolved ? "text-foreground" : "text-amber-600 dark:text-amber-400"}`}
                >
                  {entity.name}
                </span>
                <span className="text-muted-foreground/60">{entity.type}</span>
                <ConfidenceBadge value={entity.confidence} />
                {!entity.resolved && (
                  <span className="text-[10px] text-amber-500 italic">
                    ambiguous
                  </span>
                )}
              </div>
            );
          })}

          {/* Inline lineage affordance */}
          {onLineageOpen && (
            <button
              onClick={() => {
                const first = entities[0] as Record<string, unknown> | undefined;
                const nodeId = first?.node_id as string | undefined;
                if (nodeId) onLineageOpen(nodeId);
              }}
              className="flex items-center gap-1 mt-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View lineage
            </button>
          )}
        </div>
      )}
    </div>
  );
}
