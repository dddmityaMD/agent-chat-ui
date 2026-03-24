"use client";

import React, { useEffect, useMemo, useState } from "react";
import { diffLines, type Change } from "diff";
import type { DiffContentData } from "@/stores/canvas-store";
import { getApiBaseUrl } from "@/lib/api-url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiffRendererProps {
  data: unknown;
}

function isDiffData(v: unknown): v is DiffContentData {
  return (
    v != null &&
    typeof v === "object" &&
    "newContent" in v &&
    typeof (v as DiffContentData).newContent === "string" &&
    "filename" in v &&
    typeof (v as DiffContentData).filename === "string"
  );
}

// ---------------------------------------------------------------------------
// Diff line model
// ---------------------------------------------------------------------------

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  oldLineNo: number | null;
  newLineNo: number | null;
}

function computeDiffLines(oldText: string, newText: string): DiffLine[] {
  const changes: Change[] = diffLines(oldText, newText);
  const result: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const change of changes) {
    const lines = change.value.replace(/\n$/, "").split("\n");
    // Handle empty string (empty diff side)
    if (lines.length === 1 && lines[0] === "" && change.value === "") continue;

    for (const line of lines) {
      if (change.added) {
        result.push({ type: "added", content: line, oldLineNo: null, newLineNo: newLine++ });
      } else if (change.removed) {
        result.push({ type: "removed", content: line, oldLineNo: oldLine++, newLineNo: null });
      } else {
        result.push({ type: "unchanged", content: line, oldLineNo: oldLine++, newLineNo: newLine++ });
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Git-backed diff parser (unified diff format)
// ---------------------------------------------------------------------------

function parseUnifiedDiff(diffText: string): { oldContent: string; newContent: string } {
  const lines = diffText.split("\n");
  const oldLines: string[] = [];
  const newLines: string[] = [];
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    if (line.startsWith("-")) {
      oldLines.push(line.slice(1));
    } else if (line.startsWith("+")) {
      newLines.push(line.slice(1));
    } else if (line.startsWith(" ")) {
      oldLines.push(line.slice(1));
      newLines.push(line.slice(1));
    } else {
      // Context line without prefix (some diff formats)
      oldLines.push(line);
      newLines.push(line);
    }
  }

  return { oldContent: oldLines.join("\n"), newContent: newLines.join("\n") };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DiffRenderer({ data }: DiffRendererProps) {
  const [fetchedDiff, setFetchedDiff] = useState<{ old: string; new: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const valid = isDiffData(data);
  const oldContent = valid ? data.oldContent : null;
  const newContent = valid ? data.newContent : "";
  const filename = valid ? data.filename : "";
  const commitSha = valid ? data.commitSha : undefined;
  const projectId = valid ? data.projectId : undefined;

  // Fetch git-backed diff if we have commitSha + projectId but no inline content
  useEffect(() => {
    if (!valid) return;
    if (commitSha && projectId && oldContent === null && newContent === "") {
      setLoading(true);
      setFetchError(null);
      fetch(`${getApiBaseUrl()}/api/workspace/projects/${projectId}/git/diff/${commitSha}`, { credentials: "include" })
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch diff (${res.status})`);
          return res.json();
        })
        .then((json: { diff: string }) => {
          const parsed = parseUnifiedDiff(json.diff);
          setFetchedDiff({ old: parsed.oldContent, new: parsed.newContent });
        })
        .catch((err: Error) => setFetchError(err.message))
        .finally(() => setLoading(false));
    }
  }, [valid, commitSha, projectId, oldContent, newContent]);

  // Determine content to diff
  const effectiveOld = fetchedDiff ? fetchedDiff.old : oldContent ?? "";
  const effectiveNew = fetchedDiff ? fetchedDiff.new : newContent;

  const diffResult = useMemo(
    () => computeDiffLines(effectiveOld, effectiveNew),
    [effectiveOld, effectiveNew],
  );

  if (!valid) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        No diff data available
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        Loading diff...
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        {fetchError}
      </div>
    );
  }

  if (diffResult.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        No changes to display
      </div>
    );
  }

  const isNewFile = oldContent === null && !fetchedDiff;

  return (
    <div className="h-full overflow-auto" data-testid="diff-renderer">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">{filename}</span>
        {commitSha && (
          <span className="font-mono text-xs text-zinc-400">{commitSha.slice(0, 8)}</span>
        )}
        {isNewFile && (
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
            New file
          </span>
        )}
      </div>

      {/* Side-by-side diff */}
      <div className="grid grid-cols-2 divide-x divide-zinc-200 font-mono text-xs dark:divide-zinc-700">
        {/* Left column header */}
        <div className="bg-red-50/50 px-2 py-1 text-xs font-medium text-red-600 dark:bg-red-950/20 dark:text-red-400">
          {isNewFile ? "(new file)" : "Previous"}
        </div>
        <div className="bg-green-50/50 px-2 py-1 text-xs font-medium text-green-600 dark:bg-green-950/20 dark:text-green-400">
          Current
        </div>

        {/* Diff lines */}
        {diffResult.map((line, i) => (
          <React.Fragment key={i}>
            {/* Left (old) */}
            <div
              className={`flex ${
                line.type === "removed"
                  ? "bg-red-50 dark:bg-red-950/30"
                  : line.type === "added"
                    ? "bg-zinc-50 dark:bg-zinc-900"
                    : ""
              }`}
            >
              <span className="w-10 shrink-0 select-none px-2 py-0.5 text-right text-zinc-400">
                {line.oldLineNo ?? ""}
              </span>
              <span
                className={`flex-1 whitespace-pre-wrap break-all px-2 py-0.5 ${
                  line.type === "removed"
                    ? "text-red-700 dark:text-red-300"
                    : line.type === "added"
                      ? "text-zinc-300 dark:text-zinc-600"
                      : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {line.type === "removed" && "- "}
                {line.type !== "added" ? line.content : ""}
              </span>
            </div>

            {/* Right (new) */}
            <div
              className={`flex ${
                line.type === "added"
                  ? "bg-green-50 dark:bg-green-950/30"
                  : line.type === "removed"
                    ? "bg-zinc-50 dark:bg-zinc-900"
                    : ""
              }`}
            >
              <span className="w-10 shrink-0 select-none px-2 py-0.5 text-right text-zinc-400">
                {line.newLineNo ?? ""}
              </span>
              <span
                className={`flex-1 whitespace-pre-wrap break-all px-2 py-0.5 ${
                  line.type === "added"
                    ? "text-green-700 dark:text-green-300"
                    : line.type === "removed"
                      ? "text-zinc-300 dark:text-zinc-600"
                      : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {line.type === "added" && "+ "}
                {line.type !== "removed" ? line.content : ""}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
