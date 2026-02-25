"use client";

import type { BlockRendererProps, BlockData } from "../types";
import { CheckCircle2, XCircle } from "lucide-react";

interface InterruptDecisionBlockData extends BlockData {
  type: "interrupt_decision";
  card_type: string;
  decision: "approved" | "rejected";
  feedback?: string | null;
  decided_at?: string;
}

/**
 * Compact decision badge for interrupt_decision blocks.
 *
 * These blocks are emitted by gate nodes after interrupt() resume.
 * They appear as separate messages in chronological order after
 * the corresponding interrupt_card message.
 */
export function InterruptDecisionBlock({ block }: BlockRendererProps) {
  const data = block as InterruptDecisionBlockData;
  const isApproved = data.decision === "approved";

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
      {isApproved ? (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Approved
        </div>
      ) : (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800 dark:bg-red-900/50 dark:text-red-300">
          <XCircle className="h-3.5 w-3.5" />
          Rejected
        </div>
      )}
      {data.decided_at && (
        <span className="text-xs">
          {new Date(data.decided_at).toLocaleTimeString()}
        </span>
      )}
      {data.feedback && (
        <p className="text-xs italic">{data.feedback}</p>
      )}
    </div>
  );
}
