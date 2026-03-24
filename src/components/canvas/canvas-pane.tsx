"use client";

import React from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { CanvasHeader } from "./canvas-header";
import { LineageRenderer } from "./renderers/lineage-renderer";
import { TableRenderer } from "./renderers/table-renderer";
import { CodeRenderer } from "./renderers/code-renderer";
import { DiffRenderer } from "./renderers/diff-renderer";
import { EditorRenderer } from "./renderers/editor-renderer";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Canvas pane — universal viewer container (D-14, D-15).
 *
 * Routes to the appropriate renderer based on contentType.
 * No modes, no auto-trigger — canvas opens only when user clicks
 * expand on a panel block.
 */
export function CanvasPane() {
  const { contentType, contentData, sourceBlockId, close } = useCanvasStore();

  if (!contentType) {
    return null;
  }

  return (
    <div
      className="flex h-full flex-col bg-white dark:bg-zinc-950"
      data-testid="canvas-pane"
    >
      <CanvasHeader
        contentType={contentType}
        sourceBlockId={sourceBlockId}
        onClose={close}
      />
      <div className="flex-1 overflow-auto">
        {contentType === "lineage" && <LineageRenderer data={contentData} />}
        {contentType === "table" && <TableRenderer data={contentData} />}
        {contentType === "code" && <CodeRenderer data={contentData} />}
        {contentType === "diff" && <DiffRenderer data={contentData} />}
        {contentType === "editor" && <EditorRenderer data={contentData} />}
      </div>
    </div>
  );
}
