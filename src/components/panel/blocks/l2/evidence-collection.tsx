"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  EvidenceCollectionData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupBySource(
  items: EvidenceCollectionData["items"]
): Record<string, EvidenceCollectionData["items"]> {
  const groups: Record<string, EvidenceCollectionData["items"]> = {};
  for (const item of items) {
    const key = item.source || "unknown";
    (groups[key] ??= []).push(item);
  }
  return groups;
}

function QualityIcon({ flag }: { flag: string }) {
  if (flag === "verified" || flag === "high") {
    return (
      <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
    );
  }
  return <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EvidenceCollectionBlockProps {
  block: PanelBlock;
  state: BlockState;
  onCanvasOpen?: (contentType: string, contentData: unknown) => void;
}

/**
 * L2 evidence-collection block: evidence items grouped by connector.
 *
 * Compact: single summary line with counts per source.
 * Expanded: evidence items with quality flags.
 * Canvas affordance for table results (D-14).
 * Persistent (D-10).
 */
export function EvidenceCollectionBlock({
  block,
  state,
  onCanvasOpen,
}: EvidenceCollectionBlockProps) {
  const data = block.data as EvidenceCollectionData | undefined;
  const [expanded, setExpanded] = useState(false);

  // Loading
  if (state === "loading" || !data) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-muted-foreground/20 animate-pulse" />
          <div className="h-3 w-28 rounded bg-muted-foreground/20 animate-pulse" />
        </div>
      </div>
    );
  }

  const items = data.items ?? [];
  const groups = groupBySource(items);
  const sourceSummary = Object.entries(groups)
    .map(([src, arr]) => `${src} (${arr.length})`)
    .join(" | ");

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
          Evidence
        </span>
        <span className="text-xs text-muted-foreground/60">
          {data.count ?? items.length} items
        </span>
      </button>

      {/* Compact */}
      {!expanded && (
        <p className="text-xs text-foreground mt-1.5 ml-5 truncate">
          {sourceSummary || "No evidence yet"}
        </p>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="mt-2 ml-5 space-y-2">
          {Object.entries(groups).map(([source, sourceItems]) => (
            <div key={source}>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {source}
              </span>
              <div className="mt-1 space-y-1">
                {sourceItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-1.5 text-xs py-0.5"
                  >
                    <QualityIcon flag={item.quality_flag} />
                    <span className="text-foreground">{item.finding}</span>
                    <span className="text-muted-foreground/50 flex-shrink-0">
                      via {item.tool_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Canvas expand for table results (D-14) */}
          {onCanvasOpen && (
            <button
              onClick={() => onCanvasOpen("table", { items })}
              className="flex items-center gap-1 mt-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View table
            </button>
          )}
        </div>
      )}
    </div>
  );
}
