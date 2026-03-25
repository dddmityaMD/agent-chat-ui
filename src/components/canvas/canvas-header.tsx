"use client";

import { X, Network, Table2, Code2, GitCompareArrows, FileEdit, Share2 } from "lucide-react";
import type { CanvasContentType } from "@/stores/canvas-store";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CanvasHeaderProps {
  contentType: CanvasContentType;
  sourceBlockId: string | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONTENT_LABELS: Record<CanvasContentType, { label: string; Icon: typeof Network }> = {
  lineage: { label: "Lineage Graph", Icon: Network },
  table: { label: "Data Table", Icon: Table2 },
  code: { label: "Code Preview", Icon: Code2 },
  diff: { label: "Diff Viewer", Icon: GitCompareArrows },
  editor: { label: "File Editor", Icon: FileEdit },
  "graph-explorer": { label: "Knowledge Graph", Icon: Share2 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CanvasHeader({ contentType, sourceBlockId, onClose }: CanvasHeaderProps) {
  const { label, Icon } = CONTENT_LABELS[contentType] ?? { label: contentType, Icon: Table2 };

  return (
    <div
      className="flex h-10 items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 dark:border-zinc-700 dark:bg-zinc-900"
      data-testid="canvas-header"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
        {sourceBlockId && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            from {sourceBlockId}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
        aria-label="Close canvas"
        data-testid="canvas-close-button"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
