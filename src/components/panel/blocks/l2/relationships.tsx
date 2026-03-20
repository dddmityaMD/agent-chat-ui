"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  ExternalLink,
  ArrowRight,
} from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  RelationshipsData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RelationshipsBlockProps {
  block: PanelBlock;
  state: BlockState;
  onCanvasOpen?: (contentType: string, contentData: unknown) => void;
}

/**
 * L2 relationships block: FK/lineage relationships as compact list.
 *
 * Compact: "2 relationships detected"
 * Expanded: full list with from -> to and type.
 * Canvas expand: opens lineage renderer (D-14, D-15).
 */
export function RelationshipsBlock({
  block,
  state,
  onCanvasOpen,
}: RelationshipsBlockProps) {
  const data = block.data as RelationshipsData | undefined;
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

  const relationships = data.relationships ?? [];

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
        <GitBranch className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Relationships
        </span>
        <span className="text-xs text-muted-foreground/60">
          {relationships.length} detected
        </span>
      </button>

      {/* Compact: first relationship */}
      {!expanded && relationships.length > 0 && (
        <p className="text-xs text-foreground mt-1.5 ml-5 truncate">
          {relationships[0].from} &rarr; {relationships[0].to} ({relationships[0].type})
          {relationships.length > 1 && ` +${relationships.length - 1} more`}
        </p>
      )}

      {/* Expanded: full list */}
      {expanded && (
        <div className="mt-2 ml-5 space-y-1.5">
          {relationships.map((rel, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 text-xs py-1 px-1.5 rounded hover:bg-muted/50 transition-colors"
            >
              <span className="font-medium text-foreground">{rel.from}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-foreground">{rel.to}</span>
              <span className="text-muted-foreground/60 text-[10px] uppercase">
                {rel.type}
              </span>
            </div>
          ))}

          {/* Canvas expand affordance (D-14, D-15) */}
          {onCanvasOpen && (
            <button
              onClick={() => onCanvasOpen("lineage", { relationships })}
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
