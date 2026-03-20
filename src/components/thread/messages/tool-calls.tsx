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
import { TOOL_CHAT_TEMPLATE } from "@/lib/panel-blocks/constants";
import { cn } from "@/lib/utils";

function isComplexValue(value: any): boolean {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

// ---------------------------------------------------------------------------
// Chat one-liner helpers (D-13)
// ---------------------------------------------------------------------------

/**
 * Fill a TOOL_CHAT_TEMPLATE with data extracted from tool result content.
 * Returns null if no template exists for this tool.
 */
function getChatOneLiner(
  toolName: string | undefined,
  resultData: Record<string, unknown> | null,
): string | null {
  if (!toolName) return null;
  const template =
    TOOL_CHAT_TEMPLATE[toolName as keyof typeof TOOL_CHAT_TEMPLATE];
  if (!template) return null;
  if (!resultData) return template.replace(/\{[^}]+\}/g, "?");
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const val = resultData[key];
    return val !== undefined && val !== null ? String(val) : "?";
  });
}

/** Try to parse tool result content as a JSON object for template filling */
function parseResultData(
  content: string | unknown,
): Record<string, unknown> | null {
  if (typeof content !== "string") return null;
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed))
      return parsed;
    return null;
  } catch {
    return null;
  }
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
 * Tool calls display with one-liner summaries using TOOL_CHAT_TEMPLATE (D-13).
 *
 * Collapsed (default): "[Wrench icon] N tools executed (Xs)" — single line, expandable.
 * Expanded: numbered list with tool name (mono font), status icon, one-liner summary, duration.
 *
 * Keeps backward compat: if no TOOL_CHAT_TEMPLATE match, falls back to tool name only.
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
    const resultData = matchingResult
      ? parseResultData(matchingResult.content)
      : null;
    const oneLiner = getChatOneLiner(tc.name, resultData);
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
// ToolResult — backward-compatible raw tool result display
// ---------------------------------------------------------------------------

/**
 * Raw tool result display for individual ToolMessages.
 * Kept for backward compatibility with older threads that render
 * individual tool results. New threads use ToolCalls with one-liner summaries.
 */
export function ToolResult({ message }: { message: ToolMessage }) {
  const [isExpanded, setIsExpanded] = useState(false);

  let parsedContent: any;
  let isJsonContent = false;

  try {
    if (typeof message.content === "string") {
      parsedContent = JSON.parse(message.content);
      isJsonContent = isComplexValue(parsedContent);
    }
  } catch {
    // Content is not JSON, use as is
    parsedContent = message.content;
  }

  // Check for one-liner summary
  const resultData = parseResultData(message.content);
  const oneLiner = getChatOneLiner(message.name, resultData);

  const contentStr = isJsonContent
    ? JSON.stringify(parsedContent, null, 2)
    : String(message.content);
  const contentLines = contentStr.split("\n");
  const shouldTruncate = contentLines.length > 4 || contentStr.length > 500;
  const displayedContent =
    shouldTruncate && !isExpanded
      ? contentStr.length > 500
        ? contentStr.slice(0, 500) + "..."
        : contentLines.slice(0, 4).join("\n") + "\n..."
      : contentStr;

  return (
    <div className="mx-auto grid max-w-3xl grid-rows-[1fr_auto] gap-2">
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {message.name ? (
              <h3 className="font-medium text-gray-900">
                <Check className="mr-1.5 inline h-3.5 w-3.5 text-emerald-500" />
                <code className="rounded bg-gray-100 px-2 py-1">
                  {message.name}
                </code>
                {oneLiner && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    {oneLiner}
                  </span>
                )}
              </h3>
            ) : (
              <h3 className="font-medium text-gray-900">Tool Result</h3>
            )}
            {message.tool_call_id && (
              <code className="ml-2 rounded bg-gray-100 px-2 py-1 text-sm">
                {message.tool_call_id}
              </code>
            )}
          </div>
        </div>
        <motion.div
          className="min-w-full bg-gray-100"
          initial={false}
          animate={{ height: "auto" }}
          transition={{ duration: 0.3 }}
        >
          <div className="p-3">
            <AnimatePresence
              mode="wait"
              initial={false}
            >
              <motion.div
                key={isExpanded ? "expanded" : "collapsed"}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                {isJsonContent ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="divide-y divide-gray-200">
                      {(Array.isArray(parsedContent)
                        ? isExpanded
                          ? parsedContent
                          : parsedContent.slice(0, 5)
                        : Object.entries(parsedContent)
                      ).map((item, argIdx) => {
                        const [key, value] = Array.isArray(parsedContent)
                          ? [argIdx, item]
                          : [item[0], item[1]];
                        return (
                          <tr key={argIdx}>
                            <td className="px-4 py-2 text-sm font-medium whitespace-nowrap text-gray-900">
                              {key}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {isComplexValue(value) ? (
                                <code className="rounded bg-gray-50 px-2 py-1 font-mono text-sm break-all">
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
                  <code className="block text-sm">{displayedContent}</code>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          {((shouldTruncate && !isJsonContent) ||
            (isJsonContent &&
              Array.isArray(parsedContent) &&
              parsedContent.length > 5)) && (
            <motion.button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex w-full cursor-pointer items-center justify-center border-t-[1px] border-gray-200 py-2 text-gray-500 transition-all duration-200 ease-in-out hover:bg-gray-50 hover:text-gray-600"
              initial={{ scale: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isExpanded ? <ChevronUp /> : <ChevronDown />}
            </motion.button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
