"use client";

import type { PanelBlock, BlockState, AgentStatusData, AgentStatusEntry } from "@/lib/panel-blocks/types";
import { Loader2, CheckCircle2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Subagent ID to human-readable name mapping
// ---------------------------------------------------------------------------

const SUBAGENT_LABELS: Record<string, string> = {
  phase_research: "Research",
  phase_plan: "Plan",
  phase_plan_checker: "Plan Check",
  phase_build: "Build",
  phase_verify: "Verify",
  investigate: "Investigate",
  analyze: "Analyze",
  catalog_query: "Catalog",
  project_initiate: "Project Setup",
  project_research: "Project Research",
  project_plan: "Project Plan",
};

function getSubagentLabel(id: string): string {
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
 * L1 agent-status block: Chronological list of subagent executions.
 * Each entry shows subagent name + status (active spinner or done check).
 * Entries render in execution order (append-only).
 */
export function AgentStatusBlock({ block, state }: AgentStatusBlockProps) {
  const data = block.data as AgentStatusData | undefined;
  const entries = data?.entries ?? [];

  if (entries.length === 0) {
    if (state === "loading") {
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
    return null;
  }

  return (
    <div className="rounded-md bg-muted/30 px-3 py-2 space-y-1">
      {entries.map((entry) => (
        <EntryRow key={entry.subagent_id} entry={entry} />
      ))}
    </div>
  );
}

function EntryRow({ entry }: { entry: AgentStatusEntry }) {
  const label = getSubagentLabel(entry.subagent_id);

  if (entry.status === "active") {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />
        <span className="text-xs font-medium text-foreground">{label}</span>
        {entry.iteration && (
          <span className="text-xs text-muted-foreground">
            ({entry.iteration.current}/{entry.iteration.max})
          </span>
        )}
        {entry.tool && (
          <>
            <span className="text-xs text-muted-foreground/50">&rarr;</span>
            <span className="text-xs text-muted-foreground truncate max-w-[160px]">
              {entry.tool.name}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
