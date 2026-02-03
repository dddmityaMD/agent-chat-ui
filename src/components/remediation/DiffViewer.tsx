/**
 * DiffViewer - Renders a unified diff string as a syntax-highlighted view.
 *
 * Uses custom styling to color-code additions (green), removals (red),
 * and context lines (neutral). Line numbers are displayed in the gutter.
 */

"use client";

import { useMemo } from "react";

export interface DiffViewerProps {
  /** Unified diff string to render */
  diff: string;
  /** Maximum height before scrolling (default: 400px) */
  maxHeight?: number;
}

interface DiffLine {
  type: "add" | "remove" | "context" | "header" | "meta";
  content: string;
  lineNumber: number | null;
}

function parseDiffLines(diff: string): DiffLine[] {
  const raw = diff.split("\n");
  const lines: DiffLine[] = [];
  let lineNum = 0;

  for (const line of raw) {
    if (line.startsWith("---") || line.startsWith("+++")) {
      lines.push({ type: "meta", content: line, lineNumber: null });
    } else if (line.startsWith("@@")) {
      // Parse hunk header for line numbers
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
      if (match) {
        lineNum = parseInt(match[1], 10) - 1;
      }
      lines.push({ type: "header", content: line, lineNumber: null });
    } else if (line.startsWith("+")) {
      lineNum++;
      lines.push({ type: "add", content: line, lineNumber: lineNum });
    } else if (line.startsWith("-")) {
      lines.push({ type: "remove", content: line, lineNumber: null });
    } else {
      lineNum++;
      lines.push({ type: "context", content: line, lineNumber: lineNum });
    }
  }

  return lines;
}

const LINE_STYLES: Record<DiffLine["type"], string> = {
  add: "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300",
  remove: "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  context: "text-gray-700 dark:text-gray-300",
  header: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-medium",
  meta: "text-gray-500 dark:text-gray-400 italic",
};

const GUTTER_STYLES: Record<DiffLine["type"], string> = {
  add: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400",
  remove: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  context: "bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500",
  header: "bg-blue-100 text-blue-500 dark:bg-blue-900/40 dark:text-blue-400",
  meta: "bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500",
};

const PREFIX_CHARS: Record<DiffLine["type"], string> = {
  add: "+",
  remove: "-",
  context: " ",
  header: "",
  meta: "",
};

export function DiffViewer({ diff, maxHeight = 400 }: DiffViewerProps) {
  const lines = useMemo(() => parseDiffLines(diff), [diff]);

  if (!diff.trim()) {
    return (
      <div className="rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
        No diff available
      </div>
    );
  }

  return (
    <div
      className="overflow-auto rounded border border-gray-200 font-mono text-xs dark:border-gray-700"
      style={{ maxHeight: `${maxHeight}px` }}
      data-testid="diff-viewer"
    >
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, idx) => (
            <tr key={idx} className={LINE_STYLES[line.type]}>
              {/* Gutter: line number or prefix */}
              <td
                className={`select-none border-r border-gray-200 px-2 py-0 text-right align-top dark:border-gray-700 ${GUTTER_STYLES[line.type]}`}
                style={{ minWidth: "3rem" }}
              >
                {line.lineNumber ?? ""}
              </td>
              {/* Prefix (+/-/space) */}
              <td
                className={`select-none px-1 py-0 text-center align-top ${GUTTER_STYLES[line.type]}`}
                style={{ minWidth: "1rem" }}
              >
                {PREFIX_CHARS[line.type]}
              </td>
              {/* Content */}
              <td className="whitespace-pre-wrap px-2 py-0 align-top">
                {line.type === "meta" || line.type === "header"
                  ? line.content
                  : line.content.slice(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
