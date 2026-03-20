"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  VerificationData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Status icon
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: string }) {
  if (status === "passed" || status === "true") {
    return (
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
    );
  }
  if (status === "failed" || status === "false") {
    return (
      <XCircle className="w-3.5 h-3.5 text-red-500 dark:text-red-400 flex-shrink-0" />
    );
  }
  return (
    <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin flex-shrink-0" />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface VerificationBlockProps {
  block: PanelBlock;
  state: BlockState;
}

/**
 * L3 verification block: L0-L3 verification layers as vertical checklist.
 *
 * Compact: "Verified: 4/4 checks passed"
 * Expanded: each layer with icon, label, status, detail.
 */
export function VerificationBlock({
  block,
  state,
}: VerificationBlockProps) {
  const data = block.data as VerificationData | undefined;
  const [expanded, setExpanded] = useState(false);

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

  const layers = data.layers ?? {};
  const entries = Object.entries(layers);
  const passedCount = entries.filter(([, v]) => v.passed).length;
  const allPassed = passedCount === entries.length;

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
        <ShieldCheck
          className={`w-3.5 h-3.5 flex-shrink-0 ${allPassed ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
        />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Verification
        </span>
        <span className="text-xs text-muted-foreground/60">
          {passedCount}/{entries.length} passed
        </span>
      </button>

      {/* Expanded: layer checklist */}
      {expanded && (
        <div className="mt-2 ml-5 space-y-1">
          {entries.map(([name, layer]) => (
            <div
              key={name}
              className="flex items-start gap-2 text-xs py-1 px-1.5 rounded hover:bg-muted/50 transition-colors"
            >
              <StatusIcon status={layer.passed ? "passed" : "failed"} />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-foreground">{name}</span>
                <p className="text-muted-foreground truncate">
                  {layer.summary}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
