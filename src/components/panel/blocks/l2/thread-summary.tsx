"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Activity,
  Database,
  Wrench,
  Hash,
} from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  ThreadSummaryData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ThreadSummaryBlockProps {
  block: PanelBlock;
  state: BlockState;
}

export function ThreadSummaryBlock({ block, state }: ThreadSummaryBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const data = block.data as ThreadSummaryData | undefined;

  if (!data) return null;

  const entityCount = data.entities?.length ?? 0;
  const toolCount = data.toolsUsed?.reduce((sum, t) => sum + t.count, 0) ?? 0;
  const sourceList = data.sourcesTouched ?? [];

  // One-liner summary
  const parts: string[] = [];
  if (entityCount > 0) parts.push(`${entityCount} ${entityCount === 1 ? "entity" : "entities"}`);
  if (toolCount > 0) parts.push(`${toolCount} tool ${toolCount === 1 ? "call" : "calls"}`);
  if (sourceList.length > 0) parts.push(sourceList.join(" + "));
  const oneLiner = parts.length > 0 ? parts.join(", ") : "No activity yet";

  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left"
      >
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Thread Context
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/70">
          {oneLiner}
        </span>
        <Chevron className="h-3 w-3 text-muted-foreground/50" />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {/* Entities */}
          {entityCount > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Database className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                  Entities ({entityCount})
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {data.entities.map((e) => (
                  <span
                    key={`${e.type}-${e.name}`}
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px]"
                  >
                    <span className="text-muted-foreground">{e.type}</span>
                    <span className="font-medium">{e.name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tools used */}
          {data.toolsUsed && data.toolsUsed.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Wrench className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                  Tools ({toolCount})
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {data.toolsUsed.map((t) => (
                  <span
                    key={t.name}
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px]"
                  >
                    <span className="font-medium">{t.name}</span>
                    {t.count > 1 && (
                      <span className="text-muted-foreground">x{t.count}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {sourceList.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Hash className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                  Sources
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {sourceList.map((s) => (
                  <span
                    key={s}
                    className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
