"use client";

import { ArrowRight } from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  NextStepsData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NextStepsBlockProps {
  block: PanelBlock;
  state: BlockState;
  onAction?: (actionType: string, payload: Record<string, unknown>) => void;
}

/**
 * L3 next-steps block: suggested follow-up actions as clickable chips.
 *
 * On click, sends suggestion text as user message via onAction.
 * Persistent (D-10).
 */
export function NextStepsBlock({
  block,
  state,
  onAction,
}: NextStepsBlockProps) {
  const data = block.data as NextStepsData | undefined;

  // Loading
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

  const suggestions = data.suggestions ?? [];

  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Next Steps
      </span>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            onClick={() =>
              onAction?.("send_message", { text: suggestion.action })
            }
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-colors"
          >
            {suggestion.label}
            <ArrowRight className="w-3 h-3" />
          </button>
        ))}
      </div>
    </div>
  );
}
