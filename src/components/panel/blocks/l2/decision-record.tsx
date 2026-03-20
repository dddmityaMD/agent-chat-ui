"use client";

import { Check, X, ArrowRight, Clock } from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  DecisionRecordData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Action styling
// ---------------------------------------------------------------------------

const ACTION_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  approved: {
    icon: Check,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-300/40",
    label: "Approved",
  },
  rejected: {
    icon: X,
    color: "text-red-500 dark:text-red-400",
    bgColor: "bg-red-50/30 dark:bg-red-950/10 border-red-300/40",
    label: "Rejected",
  },
  selected: {
    icon: ArrowRight,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50/30 dark:bg-blue-950/10 border-blue-300/40",
    label: "Selected",
  },
};

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DecisionRecordBlockProps {
  block: PanelBlock;
  state: BlockState;
}

/**
 * L2 decision-record block (D-10): collapsed resolved action.
 *
 * Shows decision text, action (approved/rejected/selected) with icon,
 * timestamp. Styled subtle (muted green/red/blue, NOT amber like active actions).
 */
export function DecisionRecordBlock({
  block,
  state,
}: DecisionRecordBlockProps) {
  const data = block.data as DecisionRecordData | undefined;

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

  const config = ACTION_CONFIG[data.action] ?? ACTION_CONFIG.selected;
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border p-3 ${config.bgColor}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${config.color}`} />
        <span className={`text-xs font-medium ${config.color}`}>
          {config.label}:
        </span>
        <span className="text-xs text-foreground truncate flex-1">
          {data.decision}
        </span>
        {data.resolvedAt && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 flex-shrink-0">
            <Clock className="w-2.5 h-2.5" />
            {relativeTime(data.resolvedAt)}
          </span>
        )}
      </div>
      {data.details && (
        <p className="text-[11px] text-muted-foreground mt-1.5 ml-5">
          {data.details}
        </p>
      )}
    </div>
  );
}
