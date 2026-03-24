"use client";

/**
 * File context menu (Phase 64-03).
 *
 * Right-click menu for workspace files with actions:
 * - View (opens in canvas)
 * - Rename (inline rename via react-arborist)
 * - View history (sets historyFile in store, rendered by Plan 04)
 * - View latest diff (fetches diff, opens in canvas diff mode — Plan 04)
 * - Delete (confirm dialog + API call)
 */

import React, { useCallback } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { Eye, Pencil, History, GitCompare, Trash2 } from "lucide-react";
import type { FileNode } from "@/types/workspace";
import { useFileStore } from "@/stores/file-store";
import { useCanvasStore } from "@/stores/canvas-store";
import { getApiBaseUrl } from "@/lib/api-url";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FileContextMenuProps {
  file: FileNode;
  projectId: string | null;
  children: React.ReactNode;
  /** Callback to trigger inline rename in react-arborist */
  onRename?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "md":
      return "markdown";
    case "sql":
      return "sql";
    case "py":
      return "python";
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "yaml":
    case "yml":
      return "yaml";
    case "json":
      return "json";
    default:
      return "text";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FileContextMenu({
  file,
  projectId,
  children,
  onRename,
}: FileContextMenuProps) {
  const { setHistoryFile } = useFileStore();
  const canvasStore = useCanvasStore();

  const handleView = useCallback(async () => {
    if (!projectId || file.isFolder) return;

    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/workspace/projects/${projectId}/files/content?path=${encodeURIComponent(file.path)}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = await res.json();
      const language = getLanguageFromPath(file.path);
      canvasStore.open(
        "editor",
        { content: data.content, filePath: file.path, projectId, language },
        `file:${file.path}`,
      );
    } catch {
      // Silently fail — canvas will show empty state
    }
  }, [file, projectId, canvasStore]);

  const handleViewHistory = useCallback(() => {
    setHistoryFile(file);
  }, [file, setHistoryFile]);

  const handleViewDiff = useCallback(async () => {
    if (!projectId || file.isFolder) return;

    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/workspace/projects/${projectId}/git/history?path=${encodeURIComponent(file.path)}&limit=1`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = await res.json();
      // API returns flat array of CommitEntry, not { commits: [...] }
      const commits = Array.isArray(data) ? data : data.commits ?? [];
      if (commits.length > 0) {
        const sha = commits[0].sha;
        canvasStore.open(
          "diff",
          { oldContent: null, newContent: "", filename: file.path, commitSha: sha, projectId },
          `diff:${file.path}`,
        );
      }
    } catch {
      // Silently fail
    }
  }, [file, projectId, canvasStore]);

  const handleDelete = useCallback(async () => {
    if (!projectId || file.isFolder) return;

    const confirmed = window.confirm(
      `Delete "${file.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await fetch(
        `${getApiBaseUrl()}/api/workspace/projects/${projectId}/files/content?path=${encodeURIComponent(file.path)}`,
        { method: "DELETE", credentials: "include" },
      );
      // SSE event will update the tree, or we manually remove
      useFileStore.getState().applyFileChange({
        type: "workspace:file-change",
        operation: "delete",
        path: file.path,
        commit_sha: null,
      });
    } catch {
      // Silently fail
    }
  }, [file, projectId]);

  if (file.isFolder) {
    return <>{children}</>;
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="z-50 min-w-[160px] rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          data-testid="file-context-menu"
        >
          <ContextMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            onSelect={handleView}
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </ContextMenu.Item>

          {onRename && (
            <ContextMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              onSelect={onRename}
            >
              <Pencil className="h-3.5 w-3.5" />
              Rename
            </ContextMenu.Item>
          )}

          <ContextMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            onSelect={handleViewHistory}
          >
            <History className="h-3.5 w-3.5" />
            View history
          </ContextMenu.Item>

          <ContextMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            onSelect={handleViewDiff}
          >
            <GitCompare className="h-3.5 w-3.5" />
            View latest diff
          </ContextMenu.Item>

          <ContextMenu.Separator className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />

          <ContextMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-red-600 outline-none hover:bg-zinc-100 dark:text-red-400 dark:hover:bg-zinc-700"
            onSelect={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
