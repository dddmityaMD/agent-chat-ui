"use client";

/**
 * History panel — shows file-specific git commit history.
 *
 * Appears below the file tree when user right-clicks a file and selects
 * "View history". Click a commit to open its diff in the canvas pane.
 *
 * Phase 64-04: Part of the workspace management UI surface.
 */

import React, { useEffect, useState } from "react";
import { X, GitCommitHorizontal } from "lucide-react";
import { useFileStore } from "@/stores/file-store";
import { useCanvasStore } from "@/stores/canvas-store";
import type { DiffContentData } from "@/stores/canvas-store";
import { getApiBaseUrl } from "@/lib/api-url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommitEntry {
  sha: string;
  message: string;
  timestamp: string;
  author: string;
}

interface HistoryPanelProps {
  /** Project ID for API calls */
  projectId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HistoryPanel({ projectId }: HistoryPanelProps) {
  const historyFile = useFileStore((s) => s.historyFile);
  const setHistoryFile = useFileStore((s) => s.setHistoryFile);
  const openCanvas = useCanvasStore((s) => s.open);

  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch commits when historyFile changes
  useEffect(() => {
    if (!historyFile || !projectId) {
      setCommits([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(
      `${getApiBaseUrl()}/api/workspace/projects/${projectId}/git/history?path=${encodeURIComponent(historyFile.path)}`,
      { credentials: "include" },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch history (${res.status})`);
        return res.json();
      })
      .then((data: CommitEntry[]) => {
        if (!cancelled) setCommits(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [historyFile, projectId]);

  // Don't render if no file selected for history
  if (!historyFile) return null;

  const filename = historyFile.name;

  const handleCommitClick = (commit: CommitEntry) => {
    const diffData: DiffContentData = {
      oldContent: null,
      newContent: "",
      filename: historyFile.path,
      commitSha: commit.sha,
      projectId,
    };
    openCanvas("diff", diffData, `history-${commit.sha}`);
  };

  return (
    <div
      className="min-h-[33%] w-full border-t border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
      data-testid="history-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
          <GitCommitHorizontal className="h-3.5 w-3.5" />
          <span>History: {filename}</span>
        </div>
        <button
          type="button"
          onClick={() => setHistoryFile(null)}
          className="rounded p-0.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          aria-label="Close history panel"
          data-testid="history-panel-close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-1 pb-2">
        {loading && (
          <div className="px-2 py-3 text-center text-xs text-zinc-400">
            Loading history...
          </div>
        )}

        {error && (
          <div className="px-2 py-3 text-center text-xs text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && commits.length === 0 && (
          <div className="px-2 py-3 text-center text-xs text-zinc-400">
            No history available for this file
          </div>
        )}

        {!loading &&
          !error &&
          commits.map((commit) => (
            <button
              key={commit.sha}
              type="button"
              onClick={() => handleCommitClick(commit)}
              className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              data-testid={`history-commit-${commit.sha.slice(0, 8)}`}
            >
              <span className="mt-0.5 font-mono text-[10px] text-zinc-400">
                {commit.sha.slice(0, 7)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-zinc-700 dark:text-zinc-200">
                  {commit.message}
                </div>
                <div className="text-[10px] text-zinc-400">
                  {relativeTime(commit.timestamp)}
                </div>
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}
