"use client";

import type { PanelBlock, BlockState, AgentStatusData, AgentStatusEntry } from "@/lib/panel-blocks/types";
import { Bot, Loader2, CheckCircle2 } from "lucide-react";

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
        <div className="flex items-center gap-2 rounded-md border border-indigo-200/60 bg-indigo-50/30 dark:border-indigo-800/40 dark:bg-indigo-950/20 px-3 py-1.5">
          <Bot className="h-3 w-3 flex-shrink-0 text-indigo-500" />
          <span className="text-xs text-muted-foreground">Starting...</span>
          <Loader2 className="ml-auto w-3 h-3 text-indigo-400 animate-spin" />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="rounded-md border border-indigo-200/60 bg-indigo-50/30 dark:border-indigo-800/40 dark:bg-indigo-950/20 px-3 py-2 space-y-1">
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
        <Bot className="h-3 w-3 flex-shrink-0 text-indigo-500" />
        <span className="text-xs font-medium text-foreground/80">{label}</span>
        {entry.task && (
          <span className="text-xs text-muted-foreground truncate max-w-[160px]">
            {entry.task}
          </span>
        )}
        {entry.iteration && (
          <span className="text-xs text-muted-foreground">
            ({entry.iteration.current}/{entry.iteration.max})
          </span>
        )}
        <Loader2 className="ml-auto w-3 h-3 text-indigo-400 animate-spin flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Bot className="h-3 w-3 flex-shrink-0 text-indigo-500/50" />
      <span className="text-xs text-muted-foreground">{label}</span>
      {entry.task && (
        <span className="text-xs text-muted-foreground/60 truncate max-w-[140px]">
          {entry.task}
        </span>
      )}
      {entry.toolCount && (
        <span className="text-xs text-muted-foreground/50">
          {entry.toolCount} tool{entry.toolCount !== 1 ? "s" : ""}
        </span>
      )}
      <CheckCircle2 className="ml-auto w-3 h-3 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
    </div>
  );
}
