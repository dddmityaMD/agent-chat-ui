"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import type { BlockRendererProps } from "../types";
import type { FlowSummaryBlockData } from "../types";

export function FlowSummaryBlock({ block }: BlockRendererProps) {
  const data = block as FlowSummaryBlockData;
  const [expanded, setExpanded] = useState(false);

  const label = data.flow_type
    ? data.flow_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Flow";

  const summary = `${label} \u00b7 ${data.stages_completed} of ${data.stages_total} stages completed`;

  return (
    <div className="my-3">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="border-border bg-muted/50 text-foreground hover:bg-muted flex w-full items-center gap-2 rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors"
      >
        {expanded ? (
          <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
        )}
        <span>{summary}</span>
      </button>

      {expanded && data.stage_details && data.stage_details.length > 0 && (
        <div className="mt-2 ml-4 space-y-1.5">
          {data.stage_details.map((stage) => (
            <div
              key={stage.id}
              className="text-foreground flex items-center gap-2 text-sm"
            >
              <CheckCircle2
                className={
                  stage.status === "completed"
                    ? "h-4 w-4 shrink-0 text-green-500"
                    : "text-muted-foreground h-4 w-4 shrink-0"
                }
              />
              <span>{stage.label}</span>
              {stage.subtitle && (
                <span className="text-muted-foreground text-xs">
                  — {stage.subtitle}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
