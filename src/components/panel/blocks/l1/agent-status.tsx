"use client";

import type { PanelBlock, BlockState, AgentStatusData } from "@/lib/panel-blocks/types";
import { Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Subagent ID to human-readable name mapping
// ---------------------------------------------------------------------------

const SUBAGENT_LABELS: Record<string, string> = {
  phase_research: "Research",
  phase_plan: "Plan",
  phase_build: "Build",
  phase_verify: "Verify",
  investigate: "Investigate",
  analyze: "Analyze",
  catalog_query: "Catalog",
  project_initiate: "Project Setup",
  project_research: "Project Research",
  project_plan: "Project Plan",
};

function getSubagentLabel(id?: string): string {
  if (!id) return "Working";
  return SUBAGENT_LABELS[id] ?? id.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AgentStatusBlockProps {
  block: PanelBlock;
  state: BlockState;
}

/**
 * L1 agent-status block (D-12): One compact status bar showing
 * subagent name, iteration progress, and current tool.
 *
 * This is the ONLY place showing real-time iteration progress.
 * Chat doesn't stream tool calls inline (they're hidden in collapsed details).
 */
export function AgentStatusBlock({ block, state }: AgentStatusBlockProps) {
  const data = block.data as AgentStatusData | undefined;

  // Loading state: pulsing dot + "Starting..."
  if (state === "loading" || !data) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <span className="text-xs text-muted-foreground">Starting...</span>
      </div>
    );
  }

  const label = getSubagentLabel(data.subagent_id);
  const iteration = data.iteration;
  const tool = data.tool;

  // Complete state: subtle checkmark
  if (state === "complete") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30">
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          Done
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    );
  }

  // Populated state: active status bar
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40">
      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
      <span className="text-xs font-medium text-foreground">{label}</span>
      {iteration && (
        <span className="text-xs text-muted-foreground">
          ({iteration.current}/{iteration.max})
        </span>
      )}
      {tool && (
        <>
          <span className="text-xs text-muted-foreground/50">-&gt;</span>
          <span className="text-xs text-muted-foreground truncate max-w-[160px]">
            {tool.name}
          </span>
        </>
      )}
    </div>
  );
}
