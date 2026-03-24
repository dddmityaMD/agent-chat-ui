"use client";

/**
 * Custom node renderer for react-arborist file tree (Phase 64-03).
 *
 * Displays file type icon + filename. VS Code-like minimal style.
 * File type icons use lucide-react (already in project).
 */

import React from "react";
import type { NodeRendererProps } from "react-arborist";
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  Database,
  File,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import type { FileNode } from "@/types/workspace";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

function getFileIcon(node: FileNode, isOpen: boolean) {
  if (node.isFolder) {
    return isOpen ? (
      <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
    ) : (
      <Folder className="h-4 w-4 shrink-0 text-amber-500" />
    );
  }

  const ext = node.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "md":
    case "txt":
      return <FileText className="h-4 w-4 shrink-0 text-blue-400" />;
    case "sql":
      return <Database className="h-4 w-4 shrink-0 text-orange-400" />;
    case "py":
    case "js":
    case "ts":
    case "tsx":
    case "jsx":
      return <FileCode className="h-4 w-4 shrink-0 text-green-400" />;
    default:
      return <File className="h-4 w-4 shrink-0 text-zinc-400" />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FileTreeNode({
  node,
  style,
  dragHandle,
}: NodeRendererProps<FileNode>) {
  const data = node.data;
  const isOpen = node.isOpen;

  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        "flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-sm",
        "hover:bg-zinc-100 dark:hover:bg-zinc-800",
        node.isSelected && "bg-blue-50 dark:bg-blue-900/30",
      )}
      onClick={() => {
        if (data.isFolder) {
          node.toggle();
        } else {
          node.select();
        }
      }}
      data-testid={`file-tree-node-${data.path}`}
    >
      {/* Folder expand/collapse chevron */}
      {data.isFolder ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {isOpen ? (
            <ChevronDown className="h-3 w-3 text-zinc-400" />
          ) : (
            <ChevronRight className="h-3 w-3 text-zinc-400" />
          )}
        </span>
      ) : (
        <span className="h-4 w-4 shrink-0" />
      )}

      {/* File/folder icon */}
      {getFileIcon(data, isOpen)}

      {/* Name — inline edit when node.isEditing */}
      {node.isEditing ? (
        <input
          autoFocus
          type="text"
          defaultValue={data.name}
          className="min-w-0 flex-1 rounded border border-blue-400 bg-white px-1 py-0 text-sm outline-none dark:bg-zinc-800"
          onFocus={(e) => {
            // Select filename without extension
            const dot = e.target.value.lastIndexOf(".");
            e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length);
          }}
          onBlur={(e) => node.submit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") node.submit(e.currentTarget.value);
            if (e.key === "Escape") node.reset();
          }}
        />
      ) : (
        <span className="truncate">{data.name}</span>
      )}
    </div>
  );
}
