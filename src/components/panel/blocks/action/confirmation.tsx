"use client";

import { AlertTriangle, Check, X } from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  ConfirmationData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ConfirmationBlockProps {
  block: PanelBlock;
  state: BlockState;
  onAction?: (actionType: string, payload: Record<string, unknown>) => void;
}

/**
 * Action confirmation block: yes/no confirmation with amber border.
 *
 * Action description + [Confirm] [Cancel].
 */
export function ConfirmationBlock({
  block,
  state,
  onAction,
}: ConfirmationBlockProps) {
  const data = block.data as ConfirmationData | undefined;

  if (state === "loading" || !data) {
    return (
      <div className="rounded-lg border-2 border-amber-400/40 bg-amber-50/30 dark:bg-amber-950/20 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-amber-200/50 animate-pulse" />
          <div className="h-4 w-32 rounded bg-amber-200/50 animate-pulse" />
        </div>
      </div>
    );
  }

  // Complete state
  if (state === "complete") {
    return (
      <div className="rounded-lg border border-emerald-300/50 bg-emerald-50/20 dark:bg-emerald-950/10 p-3">
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <Check className="w-4 h-4" />
          <span>Confirmed</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/20 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
          Confirm Action
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-foreground mb-3">{data.action_description}</p>

      {/* Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() =>
            onAction?.("confirm_action", {
              block_id: block.id,
              action_id: data.action_id,
            })
          }
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          Confirm
        </button>
        <button
          onClick={() =>
            onAction?.("cancel_action", {
              block_id: block.id,
              action_id: data.action_id,
            })
          }
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}
