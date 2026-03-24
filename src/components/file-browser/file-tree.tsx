"use client";

/**
 * File tree component (Phase 64-03).
 *
 * Uses react-arborist to render workspace files in a VS Code-like tree.
 * - Single click on file: open in canvas pane (read-only)
 * - Click on folder: expand/collapse
 * - Right-click: context menu (view, rename, history, diff, delete)
 * - Empty state when no files exist
 */

import React, { useCallback, useRef } from "react";
import { Tree, type NodeRendererProps, type TreeApi } from "react-arborist";
import { FolderOpen, Loader2 } from "lucide-react";
import type { FileNode } from "@/types/workspace";
import { useFileStore } from "@/stores/file-store";
import { useWorkspaceFiles } from "@/hooks/useWorkspaceFiles";
import { useCanvasStore } from "@/stores/canvas-store";
import { getApiBaseUrl } from "@/lib/api-url";
import { FileTreeNode } from "./file-tree-node";
import { FileContextMenu } from "./file-context-menu";
import { HistoryPanel } from "./history-panel";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FileTreeProps {
  projectId: string | null;
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
// Node wrapper with context menu
// ---------------------------------------------------------------------------

function NodeWithContextMenu(
  props: NodeRendererProps<FileNode> & { projectId: string | null },
) {
  const { projectId, ...nodeProps } = props;
  const data = nodeProps.node.data;

  return (
    <FileContextMenu
      file={data}
      projectId={projectId}
      onRename={() => nodeProps.node.edit()}
    >
      <div>
        <FileTreeNode {...nodeProps} />
      </div>
    </FileContextMenu>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FileTree({ projectId }: FileTreeProps) {
  const { files, isLoading, error } = useWorkspaceFiles(projectId);
  const { selectFile } = useFileStore();
  const canvasStore = useCanvasStore();
  const treeRef = useRef<TreeApi<FileNode> | null>(null);

  // Handle file selection: open in canvas
  const handleSelect = useCallback(
    async (nodes: Array<{ data: FileNode }>) => {
      const selected = nodes[0]?.data;
      if (!selected || selected.isFolder || !projectId) return;

      selectFile(selected);

      try {
        const res = await fetch(
          `${getApiBaseUrl()}/api/workspace/projects/${projectId}/files/content?path=${encodeURIComponent(selected.path)}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const data = await res.json();
        const language = getLanguageFromPath(selected.path);
        canvasStore.open(
          "editor",
          { content: data.content, filePath: selected.path, projectId, language },
          `file:${selected.path}`,
        );
      } catch {
        // Silently fail — canvas remains in previous state
      }
    },
    [projectId, selectFile, canvasStore],
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Loading files...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="px-3 py-4 text-xs text-red-500">
        Failed to load files: {error}
      </div>
    );
  }

  // Empty state
  if (files.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center"
        data-testid="file-tree-empty"
      >
        <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">
          No files yet
        </p>
        <p className="text-xs text-muted-foreground/70">
          Start a conversation to see workspace files appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="file-tree">
      <div className="flex-1 overflow-auto">
        <Tree<FileNode>
          ref={treeRef}
          data={files}
          openByDefault={false}
          width="100%"
          indent={16}
          rowHeight={28}
          paddingTop={4}
          paddingBottom={4}
          onSelect={handleSelect}
          childrenAccessor="children"
          idAccessor="id"
          disableDrag
          disableDrop
        >
          {(props) => (
            <NodeWithContextMenu {...props} projectId={projectId} />
          )}
        </Tree>
      </div>
      {projectId && <HistoryPanel projectId={projectId} />}
    </div>
  );
}
