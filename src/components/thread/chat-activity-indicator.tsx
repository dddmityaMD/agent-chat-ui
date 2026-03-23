"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Wrench,
} from "lucide-react";
import { deriveOneLiner } from "@/lib/panel-blocks/constants";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Execution record for a single tool call */
export interface ToolExecution {
  name: string;
  status: "running" | "completed" | "failed";
  durationMs?: number;
  resultData?: Record<string, unknown>;
}

/** Live activity state derived from SSE events */
export interface ActivityState {
  subagent: string | null;
  iteration: number | null;
  maxIterations: number | null;
  currentTool: string | null;
  toolHistory: ToolExecution[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Human-readable subagent names */
const SUBAGENT_LABELS: Record<string, string> = {
  investigation: "Investigating",
  project_research: "Researching",
  project_plan: "Planning",
  project_build: "Building",
  project_verify: "Verifying",
  project_initiate: "Starting project",
};

function getSubagentLabel(id: string | null): string {
  if (!id) return "Working";
  return SUBAGENT_LABELS[id] ?? id.replace(/_/g, " ");
}

/**
 * Derive a one-liner from tool result data.
 */
function getToolSummary(
  _toolName: string,
  resultData?: Record<string, unknown>,
): string | null {
  if (!resultData) return null;
  return deriveOneLiner(JSON.stringify(resultData));
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function totalDuration(history: ToolExecution[]): number {
  return history.reduce((sum, t) => sum + (t.durationMs ?? 0), 0);
}

// ---------------------------------------------------------------------------
// ToolExecutionLine — single tool line in the expanded trace
// ---------------------------------------------------------------------------

function ToolExecutionLine({
  tool,
  index,
}: {
  tool: ToolExecution;
  index: number;
}) {
  const summary = getToolSummary(tool.name, tool.resultData);

  return (
    <div className="flex items-start gap-2 py-0.5 text-xs">
      <span className="w-4 flex-shrink-0 text-right text-muted-foreground/60">
        {index + 1}.
      </span>
      {tool.status === "running" ? (
        <Loader2 className="mt-0.5 h-3 w-3 flex-shrink-0 animate-spin text-blue-500" />
      ) : tool.status === "completed" ? (
        <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-500" />
      ) : (
        <X className="mt-0.5 h-3 w-3 flex-shrink-0 text-red-500" />
      )}
      <code className="flex-shrink-0 font-mono text-foreground/80">
        {tool.name}
      </code>
      {summary && (
        <span className="truncate text-muted-foreground">{summary}</span>
      )}
      {tool.durationMs != null && (
        <span className="ml-auto flex-shrink-0 text-muted-foreground/50">
          {formatDuration(tool.durationMs)}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatActivityIndicator — replaces thought-process-pane (D-17)
// ---------------------------------------------------------------------------

interface ChatActivityIndicatorProps {
  activity: ActivityState;
  /** Whether the agent is actively streaming */
  isStreaming: boolean;
}

/**
 * Live activity indicator shown in the chat surface during agent execution.
 * Replaces the old thought-process-pane (D-17).
 *
 * During execution: Shows subagent name, iteration, current tool with spinner,
 * and last 2 completed tools with one-liner summaries derived from result content.
 * Expandable to show full tool trace.
 *
 * After execution: Collapses to single-line summary "N tools executed (Xs)".
 *
 * Idle: Returns null (not rendered).
 */
export function ChatActivityIndicator({
  activity,
  isStreaming,
}: ChatActivityIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { subagent, iteration, maxIterations, currentTool, toolHistory } =
    activity;

  // Idle — nothing to show
  const hasActivity = toolHistory.length > 0 || currentTool || subagent;
  if (!hasActivity && !isStreaming) return null;

  const completedTools = toolHistory.filter((t) => t.status === "completed");
  const failedTools = toolHistory.filter((t) => t.status === "failed");
  const total = totalDuration(toolHistory);
  const isDone = !isStreaming && toolHistory.length > 0;

  // Collapsed summary after execution
  if (isDone && !isExpanded) {
    const parts: string[] = [];
    parts.push(`${completedTools.length} tools executed`);
    if (failedTools.length > 0) parts.push(`${failedTools.length} failed`);
    if (total > 0) parts.push(formatDuration(total));

    return (
      <div className="my-1" data-testid="chat-activity-indicator">
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          <Wrench className="h-3 w-3 flex-shrink-0" />
          <span>{parts.join(" (") + (parts.length > 1 ? ")" : "")}</span>
          <Check className="ml-auto h-3 w-3 flex-shrink-0 text-emerald-500" />
        </button>
      </div>
    );
  }

  // Live or expanded view
  const recentTools = toolHistory.slice(-2);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="my-1"
        data-testid="chat-activity-indicator"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
      >
        <div className="rounded-md border border-border/60 bg-muted/20">
          {/* Header */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            )}

            {isStreaming ? (
              <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-blue-500" />
            ) : (
              <Wrench className="h-3 w-3 flex-shrink-0" />
            )}

            <span className="font-medium text-foreground">
              {getSubagentLabel(subagent)}
            </span>

            {iteration != null && maxIterations != null && (
              <span className="text-muted-foreground/70">
                ({iteration}/{maxIterations})
              </span>
            )}

            {currentTool && isStreaming && (
              <>
                <span className="text-muted-foreground/40">{"\u2192"}</span>
                <code className="font-mono text-foreground/80">
                  {currentTool}
                </code>
              </>
            )}

            {isDone && (
              <Check className="ml-auto h-3 w-3 flex-shrink-0 text-emerald-500" />
            )}
          </button>

          {/* Compact recent tools (not expanded, still streaming) */}
          {!isExpanded && isStreaming && recentTools.length > 0 && (
            <div className="border-t border-border/40 px-3 py-1.5">
              {recentTools.map((tool, idx) => (
                <ToolExecutionLine
                  key={`recent-${toolHistory.length - 2 + idx}`}
                  tool={tool}
                  index={toolHistory.indexOf(tool)}
                />
              ))}
            </div>
          )}

          {/* Expanded full trace */}
          {isExpanded && (
            <div className="border-t border-border/40 px-3 py-1.5">
              {toolHistory.map((tool, idx) => (
                <ToolExecutionLine key={`full-${idx}`} tool={tool} index={idx} />
              ))}
              {toolHistory.length === 0 && (
                <span className="text-xs text-muted-foreground/50">
                  No tools executed yet
                </span>
              )}
            </div>
          )}

          {/* Duration footer (when done and expanded) */}
          {isDone && isExpanded && total > 0 && (
            <div className="border-t border-border/40 px-3 py-1 text-right text-xs text-muted-foreground/60">
              Total: {formatDuration(total)}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
