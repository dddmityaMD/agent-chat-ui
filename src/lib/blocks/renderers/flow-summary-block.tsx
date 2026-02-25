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
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span>{summary}</span>
      </button>

      {expanded && data.stage_details && data.stage_details.length > 0 && (
        <div className="ml-4 mt-2 space-y-1.5">
          {data.stage_details.map((stage) => (
            <div
              key={stage.id}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <CheckCircle2
                className={
                  stage.status === "completed"
                    ? "h-4 w-4 shrink-0 text-green-500"
                    : "h-4 w-4 shrink-0 text-muted-foreground"
                }
              />
              <span>{stage.label}</span>
              {stage.subtitle && (
                <span className="text-xs text-muted-foreground">— {stage.subtitle}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
