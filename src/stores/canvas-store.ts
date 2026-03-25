/**
 * Zustand Canvas Store (Phase 49-06)
 *
 * Tracks canvas viewer state: what content is displayed and which block
 * triggered it. Canvas is a universal viewer — no modes, no auto-trigger (D-14).
 */

import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CanvasContentType = "lineage" | "table" | "code" | "diff" | "editor" | "graph-explorer";

// ---------------------------------------------------------------------------
// Diff & Editor content data shapes
// ---------------------------------------------------------------------------

export interface DiffContentData {
  /** Old content (null for new files) */
  oldContent: string | null;
  /** New content */
  newContent: string;
  /** Filename to display in header */
  filename: string;
  /** Commit SHA (for git-backed diffs) */
  commitSha?: string;
  /** Project ID (for fetching git-backed diffs) */
  projectId?: string;
}

export interface EditorContentData {
  /** File content */
  content: string;
  /** Relative file path */
  filePath: string;
  /** Project ID (for save API calls) */
  projectId: string;
  /** Language hint for syntax highlighting */
  language?: string;
}

interface CanvasStore {
  isOpen: boolean;
  contentType: CanvasContentType | null;
  contentData: unknown;
  sourceBlockId: string | null;

  open: (
    contentType: CanvasContentType,
    contentData: unknown,
    sourceBlockId: string,
  ) => void;
  close: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCanvasStore = create<CanvasStore>()((set) => ({
  isOpen: false,
  contentType: null,
  contentData: null,
  sourceBlockId: null,

  open(contentType, contentData, sourceBlockId) {
    set({ isOpen: true, contentType, contentData, sourceBlockId });
  },

  close() {
    set({
      isOpen: false,
      contentType: null,
      contentData: null,
      sourceBlockId: null,
    });
  },
}));
