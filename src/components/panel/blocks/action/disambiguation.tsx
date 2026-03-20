"use client";

import { Database, HelpCircle } from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  EntityDisambiguationData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DisambiguationBlockProps {
  block: PanelBlock;
  state: BlockState;
  onAction?: (actionType: string, payload: Record<string, unknown>) => void;
}

/**
 * Action block: Entity disambiguation options as clickable cards.
 * Amber border, visually distinct. User selects one to continue.
 */
export function DisambiguationBlock({
  block,
  state,
  onAction,
}: DisambiguationBlockProps) {
  const data = block.data as EntityDisambiguationData | undefined;

  // Loading skeleton
  if (state === "loading" || !data) {
    return (
      <div className="rounded-lg border-2 border-amber-400/40 bg-amber-50/30 dark:bg-amber-950/20 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-4 rounded bg-amber-200/50 animate-pulse" />
          <div className="h-4 w-32 rounded bg-amber-200/50 animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-16 w-full rounded bg-amber-200/20 animate-pulse" />
          <div className="h-16 w-full rounded bg-amber-200/20 animate-pulse" />
        </div>
      </div>
    );
  }

  // Complete state
  if (state === "complete") {
    return (
      <div className="rounded-lg border border-emerald-300/50 bg-emerald-50/20 dark:bg-emerald-950/10 p-3">
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <Database className="w-4 h-4" />
          <span>Entity selected</span>
        </div>
      </div>
    );
  }

  const handleSelect = (candidateIndex: number) => {
    const candidate = data.candidates[candidateIndex];
    onAction?.("confirm_entity", {
      block_id: block.id,
      mention: data.mention,
      selected: candidate,
      index: candidateIndex,
    });
  };

  return (
    <div className="rounded-lg border-2 border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/20 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
          Disambiguation
        </span>
      </div>

      {/* Instruction */}
      <p className="text-sm text-muted-foreground mb-3">
        Multiple matches for &ldquo;{data.mention}&rdquo;. Select one to
        continue:
      </p>

      {/* Candidate cards */}
      <div className="space-y-2">
        {data.candidates.map((candidate, idx) => (
          <button
            key={idx}
            onClick={() => handleSelect(idx)}
            className="w-full text-left rounded-md border border-border bg-background p-3 hover:border-primary/50 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-foreground">
                {candidate.name}
              </span>
              <span className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                {candidate.type}
              </span>
            </div>
            {candidate.context && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {candidate.context}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
