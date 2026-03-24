/**
 * Workspace file types — shared between file store, hooks, and components.
 *
 * The WorkspaceFileChangeEvent mirrors the backend Pydantic model
 * (Phase 64-02: WorkspaceFileChangeEvent in workspace_hooks.py).
 */

// ---------------------------------------------------------------------------
// SSE event contract (must mirror backend Pydantic model exactly)
// ---------------------------------------------------------------------------

export interface WorkspaceFileChangeEvent {
  type: "workspace:file-change";
  operation: "create" | "modify" | "delete" | "rename";
  path: string;
  commit_sha: string | null;
  old_path?: string; // only for rename
}

// ---------------------------------------------------------------------------
// File tree node (used by react-arborist and Zustand store)
// ---------------------------------------------------------------------------

export interface FileNode {
  /** Unique id — uses the file path as id */
  id: string;
  /** Display name (filename or folder name) */
  name: string;
  /** Full relative path from workspace root */
  path: string;
  /** Whether this node represents a directory */
  isFolder: boolean;
  /** File size in bytes (files only) */
  size?: number;
  /** Last modified timestamp (epoch seconds) */
  modified?: number;
  /** Child nodes (folders only) */
  children?: FileNode[];
}
