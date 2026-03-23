/**
 * SubagentGroup — collapsible wrapper for tool interactions belonging to a subagent.
 *
 * Phase 63-04: Backend tags ToolMessages with response_metadata.subagent_id
 * and response_metadata.subagent_task. This component groups consecutive
 * subagent tool interactions under a collapsible header.
 *
 * Rule 3.6: No hardcoded subagent names. subagent_id and subagent_task
 * come entirely from backend metadata.
 */

import { useState } from "react";
import { ChevronRight, ChevronDown, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubagentGroupProps {
  /** Subagent identifier from response_metadata.subagent_id */
  subagentId: string;
  /** Task description from response_metadata.subagent_task */
  subagentTask: string;
  /** Nested tool call messages */
  children: React.ReactNode;
  /** Number of tool interactions in this group */
  toolCount: number;
  /** Whether to start expanded (default false) */
  defaultExpanded?: boolean;
}

/**
 * Renders a collapsible group header for subagent tool interactions.
 * Follows the same visual pattern as ToolCalls (tool-calls.tsx) for consistency.
 */
export function SubagentGroup({
  subagentId,
  subagentTask,
  children,
  toolCount,
  defaultExpanded = false,
}: SubagentGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const Chevron = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div data-testid="subagent-group">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md",
          "border border-indigo-200/60 bg-indigo-50/30 dark:border-indigo-800/40 dark:bg-indigo-950/20 px-3 py-1.5",
          "text-xs text-muted-foreground transition-colors hover:text-foreground",
        )}
      >
        <Chevron className="h-3.5 w-3.5 flex-shrink-0" />
        <Bot className="h-3 w-3 flex-shrink-0 text-indigo-500" />
        <span className="font-medium text-foreground/80">{subagentId}</span>
        {subagentTask && (
          <span className="truncate text-muted-foreground">
            {subagentTask}
          </span>
        )}
        <span className="ml-auto flex-shrink-0 text-muted-foreground/60">
          {toolCount} tool{toolCount !== 1 ? "s" : ""}
        </span>
      </button>
      {isExpanded && (
        <div className="mt-1 ml-2 space-y-1 border-l-2 border-indigo-200/40 dark:border-indigo-800/30 pl-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grouping utility
// ---------------------------------------------------------------------------

export interface SubagentToolGroup {
  type: "subagent";
  subagentId: string;
  subagentTask: string;
  /** Indices into the original toolInteractions array */
  indices: number[];
}

export interface StandaloneToolEntry {
  type: "standalone";
  /** Index into the original toolInteractions array */
  index: number;
}

export type GroupedToolEntry = SubagentToolGroup | StandaloneToolEntry;

/**
 * Groups consecutive tool interactions by subagent_id from response_metadata.
 * Tool interactions without a subagent_id are returned as standalone entries.
 *
 * @param toolInteractions - Array of ToolInteraction objects from message-groups.ts
 * @returns Array of grouped entries preserving original order
 */
export function groupToolsBySubagent(
  toolInteractions: Array<{
    toolName: string;
    result?: { response_metadata?: Record<string, unknown> };
  }>,
): GroupedToolEntry[] {
  const groups: GroupedToolEntry[] = [];
  let currentSubagent: SubagentToolGroup | null = null;

  for (let i = 0; i < toolInteractions.length; i++) {
    const ti = toolInteractions[i];
    const meta = ti.result?.response_metadata;
    const subagentId =
      meta && typeof meta["subagent_id"] === "string"
        ? meta["subagent_id"]
        : "";

    if (subagentId) {
      // Continue existing group or start new one
      if (currentSubagent && currentSubagent.subagentId === subagentId) {
        currentSubagent.indices.push(i);
      } else {
        // Close previous group
        if (currentSubagent) {
          groups.push(currentSubagent);
        }
        currentSubagent = {
          type: "subagent",
          subagentId,
          subagentTask:
            typeof meta!["subagent_task"] === "string"
              ? (meta!["subagent_task"] as string)
              : "",
          indices: [i],
        };
      }
    } else {
      // No subagent_id: either a standalone tool, or a pending tool during streaming
      // that likely belongs to the current subagent group (result hasn't arrived yet).
      if (currentSubagent && !ti.result) {
        // Pending tool (no result yet) — keep in the current subagent group
        currentSubagent.indices.push(i);
      } else {
        // Standalone tool with result — close any open subagent group
        if (currentSubagent) {
          groups.push(currentSubagent);
          currentSubagent = null;
        }
        groups.push({ type: "standalone", index: i });
      }
    }
  }

  // Close final group
  if (currentSubagent) {
    groups.push(currentSubagent);
  }

  return groups;
}
