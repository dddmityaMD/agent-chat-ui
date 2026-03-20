"use client";

import { PanelRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PointerCard — compact panel reference shown in chat
// ---------------------------------------------------------------------------

interface PointerCardProps {
  /** The panel block ID this card points to */
  blockId: string;
  /** One-line summary of the block content */
  summary: string;
  /** Click handler — scrolls/focuses the panel to the relevant block */
  onClick?: () => void;
}

/**
 * Compact card shown in chat when content is also available in the panel.
 * Emits a custom event that the BlockPanel can listen for to scroll/focus.
 *
 * Example rendering:
 * [Panel icon] Evidence collected: 5 items across 3 connectors [See in panel ->]
 */
export function PointerCard({ blockId, summary, onClick }: PointerCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Emit custom event for BlockPanel to handle
      window.dispatchEvent(
        new CustomEvent("panel:focus-block", { detail: { blockId } }),
      );
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "my-1 flex w-full items-center gap-2 rounded-md",
        "border border-border/50 bg-muted/30 px-3 py-2",
        "text-left text-xs text-muted-foreground",
        "transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground",
      )}
      data-testid="pointer-card"
      data-block-id={blockId}
    >
      <PanelRight className="h-3.5 w-3.5 flex-shrink-0 text-blue-500/70" />
      <span className="flex-1 truncate">{summary}</span>
      <span className="flex flex-shrink-0 items-center gap-0.5 text-blue-500/70">
        See in panel
        <ArrowRight className="h-3 w-3" />
      </span>
    </button>
  );
}
