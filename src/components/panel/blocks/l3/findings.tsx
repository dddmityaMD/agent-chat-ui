"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Target, Quote } from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  FindingsData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FindingsBlockProps {
  block: PanelBlock;
  state: BlockState;
}

/**
 * L3 findings block: root cause statement + confidence + key observations.
 *
 * Compact: "Root cause: {statement} ({confidence}%)"
 * Expanded: full observations + evidence refs.
 * Persistent & accumulative (D-10).
 */
export function FindingsBlock({ block, state }: FindingsBlockProps) {
  const data = block.data as FindingsData | undefined;
  const [expanded, setExpanded] = useState(false);

  // Loading
  if (state === "loading" || !data) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-muted-foreground/20 animate-pulse" />
          <div className="h-3 w-36 rounded bg-muted-foreground/20 animate-pulse" />
        </div>
      </div>
    );
  }

  const confidencePct = Math.round(data.confidence * 100);
  const observations = data.observations ?? [];
  const evidenceRefs = data.evidence_refs ?? [];

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
        <Target className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Findings
        </span>
        <span className="text-xs text-muted-foreground/60">
          {confidencePct}% confidence
        </span>
      </button>

      {/* Compact: root cause one-liner */}
      {!expanded && (
        <p className="text-xs text-foreground mt-1.5 ml-5 line-clamp-2">
          {data.root_cause}
        </p>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="mt-2 ml-5 space-y-2">
          {/* Root cause */}
          <div className="flex items-start gap-1.5">
            <Quote className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-xs font-medium text-foreground">
              {data.root_cause}
            </span>
          </div>

          {/* Observations */}
          {observations.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Observations
              </span>
              <ul className="space-y-0.5">
                {observations.map((obs, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-foreground flex items-start gap-1.5"
                  >
                    <span className="text-muted-foreground/50 mt-0.5">-</span>
                    {obs}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence refs */}
          {evidenceRefs.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {evidenceRefs.map((ref, idx) => (
                <span
                  key={idx}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                >
                  {ref}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
