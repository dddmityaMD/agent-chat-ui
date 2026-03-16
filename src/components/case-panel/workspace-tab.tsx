"use client";

/**
 * Workspace tab - Shows workspace files the agent has written.
 *
 * Displays a file tree (build manifests, working notes, KPI specs, intermediate
 * results) and a read-only file viewer. Refreshes at breakpoints (stream
 * completion) via the refreshKey prop, not real-time.
 *
 * Data source: GET /api/threads/{thread_id}/workspace (file listing)
 *              GET /api/threads/{thread_id}/workspace/file?path=... (file content)
 */

import React, { useCallback, useEffect, useState } from "react";
import { FileText, FolderOpen, Folder } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceFile {
  path: string;
  size: number;
  modified: number;
}

interface TreeNode {
  name: string;
  fullPath: string | null; // null for directories
  children: TreeNode[];
}

// ---------------------------------------------------------------------------
// Tree building
// ---------------------------------------------------------------------------

/** Build a tree structure from flat file paths */
function buildTree(files: WorkspaceFile[]): TreeNode[] {
  const root: TreeNode = { name: "", fullPath: null, children: [] };

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          fullPath: isFile ? file.path : null,
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }
  }

  // Sort: directories first, then files, alphabetically within each group
  function sortTree(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      const aIsDir = a.children.length > 0;
      const bIsDir = b.children.length > 0;
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      sortTree(node.children);
    }
  }

  sortTree(root.children);
  return root.children;
}

// ---------------------------------------------------------------------------
// Tree Node component
// ---------------------------------------------------------------------------

function TreeNodeItem({
  node,
  depth,
  selectedFile,
  onSelectFile,
}: {
  node: TreeNode;
  depth: number;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isDir = node.children.length > 0;
  const isSelected = node.fullPath === selectedFile;

  if (isDir) {
    return (
      <div>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-1.5 py-0.5 text-xs hover:bg-muted/50 rounded px-1",
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          )}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {expanded && (
          <div>
            {node.children.map((child) => (
              <TreeNodeItem
                key={child.fullPath ?? child.name}
                node={child}
                depth={depth + 1}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-1.5 py-0.5 text-xs rounded px-1",
        isSelected
          ? "bg-blue-100 text-blue-800"
          : "hover:bg-muted/50 text-foreground",
      )}
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
      onClick={() => node.fullPath && onSelectFile(node.fullPath)}
    >
      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceTab
// ---------------------------------------------------------------------------

interface WorkspaceTabProps {
  threadId?: string | null;
  refreshKey?: number;
}

export function WorkspaceTab({ threadId, refreshKey }: WorkspaceTabProps) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);

  // Fetch file listing
  const fetchFiles = useCallback(async (tid: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/threads/${tid}/workspace`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setFiles([]);
        return;
      }
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and when threadId or refreshKey changes
  useEffect(() => {
    if (!threadId) {
      setFiles([]);
      setSelectedFile(null);
      setFileContent(null);
      return;
    }
    fetchFiles(threadId);
  }, [threadId, refreshKey, fetchFiles]);

  // Fetch file content when selectedFile changes
  useEffect(() => {
    if (!threadId || !selectedFile) {
      setFileContent(null);
      return;
    }

    let cancelled = false;
    setContentLoading(true);

    fetch(
      `${getApiBaseUrl()}/api/threads/${threadId}/workspace/file?path=${encodeURIComponent(selectedFile)}`,
      { credentials: "include" },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setFileContent(data.content ?? "");
      })
      .catch(() => {
        if (!cancelled) setFileContent("Failed to load file content.");
      })
      .finally(() => {
        if (!cancelled) setContentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [threadId, selectedFile]);

  // No thread
  if (!threadId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No thread selected.
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  // Empty state
  if (files.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No workspace files yet.
      </div>
    );
  }

  const tree = buildTree(files);

  return (
    <div className="flex h-full flex-col">
      {/* File tree */}
      <div className="max-h-[40%] overflow-y-auto border-b p-2">
        {tree.map((node) => (
          <TreeNodeItem
            key={node.fullPath ?? node.name}
            node={node}
            depth={0}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
          />
        ))}
      </div>

      {/* File viewer */}
      <div className="flex-1 overflow-y-auto p-3">
        {contentLoading ? (
          <div className="text-xs text-muted-foreground">Loading...</div>
        ) : fileContent !== null ? (
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground truncate">
              {selectedFile}
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap break-all rounded border bg-muted/30 p-2.5">
              <code>{fileContent}</code>
            </pre>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Select a file to view its contents.
          </div>
        )}
      </div>
    </div>
  );
}
