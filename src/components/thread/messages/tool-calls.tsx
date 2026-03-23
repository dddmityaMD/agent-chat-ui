import { AIMessage, ToolMessage } from "@langchain/langgraph-sdk";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Check,
  Loader2,
  X,
  Wrench,
} from "lucide-react";
import { deriveOneLiner } from "@/lib/panel-blocks/constants";
import { cn } from "@/lib/utils";
import type { ToolInteraction } from "@/lib/message-groups";

function isComplexValue(value: any): boolean {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

// ---------------------------------------------------------------------------
// ToolCalls — collapsed by default with one-liner summaries
// ---------------------------------------------------------------------------

interface ToolCallEntry {
  name: string;
  id?: string;
  status: "completed" | "running" | "failed";
  oneLiner: string | null;
  durationMs?: number;
  args: Record<string, any>;
}

/**
 * Tool calls display with one-liner summaries derived from tool result content.
 *
 * Collapsed (default): "[Wrench icon] N tools executed (Xs)" — single line, expandable.
 * Expanded: numbered list with tool name (mono font), status icon, one-liner summary, duration.
 */
export function ToolCalls({
  toolCalls,
  toolResults,
  elapsedMs,
}: {
  toolCalls: AIMessage["tool_calls"];
  /** Optional matching tool results for one-liner generation */
  toolResults?: ToolMessage[];
  /** Optional total elapsed time for all tool calls */
  elapsedMs?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!toolCalls || toolCalls.length === 0) return null;

  // Build entries with one-liner summaries
  const entries: ToolCallEntry[] = toolCalls.map((tc) => {
    const matchingResult = toolResults?.find(
      (r) => r.tool_call_id === tc.id,
    );
    const oneLiner = matchingResult
      ? deriveOneLiner(matchingResult.content)
      : null;
    const status: ToolCallEntry["status"] = matchingResult
      ? "completed"
      : "running";

    return {
      name: tc.name ?? "unknown",
      id: tc.id,
      status,
      oneLiner,
      args: tc.args as Record<string, any>,
    };
  });

  const completedCount = entries.filter((e) => e.status === "completed").length;
  const allDone = completedCount === entries.length;

  // Collapsed view — single line summary
  if (!isExpanded) {
    const summaryParts: string[] = [];
    summaryParts.push(
      `${entries.length} tool${entries.length !== 1 ? "s" : ""} executed`,
    );
    if (elapsedMs != null && elapsedMs > 0) {
      summaryParts.push(
        `${elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(1)}s`}`,
      );
    }

    return (
      <div
        className="mx-auto max-w-3xl"
        data-testid="tool-calls-collapsed"
      >
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md",
            "border border-border/60 bg-muted/20 px-3 py-1.5",
            "text-xs text-muted-foreground transition-colors hover:text-foreground",
          )}
        >
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          <Wrench className="h-3 w-3 flex-shrink-0" />
          <span>
            {summaryParts.join(" (")}
            {summaryParts.length > 1 ? ")" : ""}
          </span>
          {allDone ? (
            <Check className="ml-auto h-3 w-3 flex-shrink-0 text-emerald-500" />
          ) : (
            <Loader2 className="ml-auto h-3 w-3 flex-shrink-0 animate-spin text-blue-500" />
          )}
        </button>
      </div>
    );
  }

  // Expanded view — numbered list with details
  return (
    <div className="mx-auto max-w-3xl" data-testid="tool-calls-expanded">
      <div className="rounded-md border border-border/60 bg-muted/20">
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
          <Wrench className="h-3 w-3 flex-shrink-0" />
          <span>
            {entries.length} tool{entries.length !== 1 ? "s" : ""}
          </span>
          {allDone && (
            <Check className="ml-auto h-3 w-3 flex-shrink-0 text-emerald-500" />
          )}
        </button>

        <div className="border-t border-border/40 px-3 py-1.5 space-y-0.5">
          {entries.map((entry, idx) => (
            <div
              key={entry.id ?? idx}
              className="flex items-start gap-2 py-0.5 text-xs"
            >
              <span className="w-4 flex-shrink-0 text-right text-muted-foreground/60">
                {idx + 1}.
              </span>
              {entry.status === "completed" ? (
                <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-500" />
              ) : entry.status === "failed" ? (
                <X className="mt-0.5 h-3 w-3 flex-shrink-0 text-red-500" />
              ) : (
                <Loader2 className="mt-0.5 h-3 w-3 flex-shrink-0 animate-spin text-blue-500" />
              )}
              <code className="flex-shrink-0 font-mono text-foreground/80">
                {entry.name}
              </code>
              {entry.oneLiner && (
                <span className="truncate text-muted-foreground">
                  {entry.oneLiner}
                </span>
              )}
              {entry.durationMs != null && (
                <span className="ml-auto flex-shrink-0 text-muted-foreground/50">
                  {entry.durationMs < 1000
                    ? `${entry.durationMs}ms`
                    : `${(entry.durationMs / 1000).toFixed(1)}s`}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LiveToolCalls — renders ToolInteraction[] using the same ToolCalls UI
// ---------------------------------------------------------------------------

/**
 * Adapter that renders live (in-flight) tool interactions during streaming.
 * Converts ToolInteraction[] to the shape ToolCalls expects, keeping a
 * single rendering path for both live and historical tool display.
 */
export function LiveToolCalls({
  interactions,
  methodologyDisplayName,
}: {
  interactions: ToolInteraction[];
  methodologyDisplayName?: string;
}) {
  if (interactions.length === 0) return null;

  // Convert ToolInteraction[] to AIMessage["tool_calls"] + ToolMessage[]
  const toolCalls = interactions.map((ti, i) => ({
    name: ti.toolName,
    id: `live-${i}`,
    args: {} as Record<string, unknown>,
    type: "tool_call" as const,
  }));

  const toolResults = interactions
    .filter((ti) => ti.result)
    .map((ti, i) => {
      const result = ti.result!;
      // Create a ToolMessage-compatible object with a matching tool_call_id
      const idx = interactions.indexOf(ti);
      return {
        ...result,
        tool_call_id: `live-${idx}`,
      } as ToolMessage;
    });

  return (
    <div data-testid="live-tool-calls">
      <ToolCalls
        toolCalls={toolCalls}
        toolResults={toolResults}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolResult — collapsed one-liner by default, expandable to full content
// ---------------------------------------------------------------------------

/**
 * Tool result display for individual ToolMessages.
 * Collapsed by default showing tool name + one-liner from content.
 * Expandable to full result content.
 */
export function ToolResult({
  message,
  toolName: toolNameProp,
}: {
  message: ToolMessage;
  /** Explicit tool name (from AIMessage.tool_calls lookup). Falls back to message.name. */
  toolName?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const oneLiner = deriveOneLiner(message.content);
  const toolName = toolNameProp ?? message.name ?? "tool";

  let parsedContent: any;
  let isJsonContent = false;

  try {
    if (typeof message.content === "string") {
      parsedContent = JSON.parse(message.content);
      isJsonContent = isComplexValue(parsedContent);
    }
  } catch {
    parsedContent = message.content;
  }

  const contentStr = isJsonContent
    ? JSON.stringify(parsedContent, null, 2)
    : String(message.content);

  // Collapsed: one-liner with tool name
  if (!isExpanded) {
    return (
      <div className="mx-auto max-w-3xl" data-testid="tool-result-collapsed">
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md",
            "border border-border/60 bg-muted/20 px-3 py-1.5",
            "text-xs text-muted-foreground transition-colors hover:text-foreground",
          )}
        >
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          <Check className="h-3 w-3 flex-shrink-0 text-emerald-500" />
          <code className="flex-shrink-0 font-mono text-foreground/80">
            {toolName}
          </code>
          {oneLiner && (
            <span className="truncate text-muted-foreground">
              {oneLiner}
            </span>
          )}
        </button>
      </div>
    );
  }

  // Expanded: full content
  return (
    <div className="mx-auto max-w-3xl" data-testid="tool-result-expanded">
      <div className="overflow-hidden rounded-lg border border-border/60">
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="flex w-full items-center gap-2 border-b border-border/40 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
          <Check className="h-3 w-3 flex-shrink-0 text-emerald-500" />
          <code className="flex-shrink-0 font-mono text-foreground/80">
            {toolName}
          </code>
        </button>
        <div className="bg-muted/10 p-3">
          {isJsonContent ? (
            <table className="min-w-full divide-y divide-border/40">
              <tbody className="divide-y divide-border/40">
                {(Array.isArray(parsedContent)
                  ? parsedContent
                  : Object.entries(parsedContent)
                ).map((item, argIdx) => {
                  const [key, value] = Array.isArray(parsedContent)
                    ? [argIdx, item]
                    : [item[0], item[1]];
                  return (
                    <tr key={argIdx}>
                      <td className="px-4 py-2 text-sm font-medium whitespace-nowrap text-foreground/80">
                        {key}
                      </td>
                      <td className="px-4 py-2 text-sm text-muted-foreground">
                        {isComplexValue(value) ? (
                          <code className="rounded bg-muted/30 px-2 py-1 font-mono text-sm break-all">
                            {JSON.stringify(value, null, 2)}
                          </code>
                        ) : (
                          String(value)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <code className="block text-sm whitespace-pre-wrap">{contentStr}</code>
          )}
        </div>
      </div>
    </div>
  );
}
