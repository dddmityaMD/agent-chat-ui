/**
 * Zustand File Store (Phase 64-03)
 *
 * Manages workspace file tree state. Provides actions for:
 * - Setting the full file tree (from API fetch)
 * - Applying incremental SSE file-change events
 * - Selecting a file (for canvas viewing)
 * - Setting a history file (for git history panel)
 */

import { create } from "zustand";
import type { FileNode, WorkspaceFileChangeEvent } from "@/types/workspace";

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface FileStore {
  /** Full file tree (root-level nodes) */
  files: FileNode[];
  /** Currently selected file (shown in canvas) */
  selectedFile: FileNode | null;
  /** File whose git history is being viewed */
  historyFile: FileNode | null;

  /** Replace entire file tree */
  setFiles: (files: FileNode[]) => void;
  /** Apply an incremental SSE file-change event */
  applyFileChange: (event: WorkspaceFileChangeEvent) => void;
  /** Select a file for canvas viewing */
  selectFile: (file: FileNode | null) => void;
  /** Set file for git history panel */
  setHistoryFile: (file: FileNode | null) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split a path into segments: "a/b/c.md" -> ["a", "b", "c.md"]
 */
function pathSegments(p: string): string[] {
  return p.replace(/\\/g, "/").split("/").filter(Boolean);
}

/**
 * Ensure all parent folders exist in the tree for a given path.
 * Returns the updated root-level nodes array.
 */
function ensureParentFolders(nodes: FileNode[], segments: string[]): FileNode[] {
  if (segments.length <= 1) return nodes;

  const folderSegments = segments.slice(0, -1);
  let current = nodes;

  for (let i = 0; i < folderSegments.length; i++) {
    const folderName = folderSegments[i];
    const folderPath = folderSegments.slice(0, i + 1).join("/");
    let folder = current.find((n) => n.isFolder && n.name === folderName);
    if (!folder) {
      folder = {
        id: folderPath,
        name: folderName,
        path: folderPath,
        isFolder: true,
        children: [],
      };
      current.push(folder);
      current.sort(nodeSorter);
    }
    if (!folder.children) folder.children = [];
    current = folder.children;
  }

  return nodes;
}

/**
 * Remove a node at a given path from the tree.
 * Returns true if found and removed.
 */
function removeNode(nodes: FileNode[], targetPath: string): boolean {
  const idx = nodes.findIndex((n) => n.path === targetPath);
  if (idx !== -1) {
    nodes.splice(idx, 1);
    return true;
  }
  for (const node of nodes) {
    if (node.children && removeNode(node.children, targetPath)) {
      return true;
    }
  }
  return false;
}

/**
 * Find a node by path in the tree.
 */
function findNode(nodes: FileNode[], targetPath: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.children) {
      const found = findNode(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Sort: folders first, then alphabetical by name.
 */
function nodeSorter(a: FileNode, b: FileNode): number {
  if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/**
 * Insert a file node at the correct location in the tree.
 */
function insertFileNode(nodes: FileNode[], filePath: string): void {
  const segs = pathSegments(filePath);
  const fileName = segs[segs.length - 1];

  // Ensure parent folders
  ensureParentFolders(nodes, segs);

  // Navigate to parent
  let current = nodes;
  for (let i = 0; i < segs.length - 1; i++) {
    const folder = current.find((n) => n.isFolder && n.name === segs[i]);
    if (folder?.children) {
      current = folder.children;
    }
  }

  // Check if file already exists
  const existing = current.find((n) => n.path === filePath);
  if (!existing) {
    current.push({
      id: filePath,
      name: fileName,
      path: filePath,
      isFolder: false,
    });
    current.sort(nodeSorter);
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFileStore = create<FileStore>()((set) => ({
  files: [],
  selectedFile: null,
  historyFile: null,

  setFiles(files) {
    set({ files });
  },

  applyFileChange(event) {
    set((state) => {
      // Deep clone to avoid mutation issues
      const files = JSON.parse(JSON.stringify(state.files)) as FileNode[];

      switch (event.operation) {
        case "create": {
          insertFileNode(files, event.path);
          break;
        }
        case "modify": {
          // Update metadata if node exists, otherwise insert
          const node = findNode(files, event.path);
          if (node) {
            node.modified = Date.now() / 1000;
          } else {
            insertFileNode(files, event.path);
          }
          break;
        }
        case "delete": {
          removeNode(files, event.path);
          break;
        }
        case "rename": {
          if (event.old_path) {
            removeNode(files, event.old_path);
          }
          insertFileNode(files, event.path);
          break;
        }
      }

      return { files };
    });
  },

  selectFile(file) {
    set({ selectedFile: file });
  },

  setHistoryFile(file) {
    set({ historyFile: file });
  },
}));
