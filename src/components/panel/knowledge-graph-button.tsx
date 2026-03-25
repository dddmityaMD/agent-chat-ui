"use client";

import { useState, useEffect, useCallback } from "react";
import { Share2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

interface KnowledgeGraphButtonProps {
  onCanvasOpen?: (contentType: string, contentData: unknown) => void;
}

/**
 * Knowledge Graph button that sits in the block panel header.
 * Shows entity count badge from /api/knowledge-graph/stats.
 * Clicking opens the graph explorer in the canvas pane.
 */
export function KnowledgeGraphButton({ onCanvasOpen }: KnowledgeGraphButtonProps) {
  const [entityCount, setEntityCount] = useState<number | null>(null);

  useEffect(() => {
    const baseUrl = getApiBaseUrl();
    fetch(`${baseUrl}/api/knowledge-graph/stats`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data && typeof data.total_nodes === "number") {
          setEntityCount(data.total_nodes);
        }
      })
      .catch(() => {
        // Silently ignore — button still works without badge
      });
  }, []);

  const handleClick = useCallback(() => {
    if (onCanvasOpen) {
      onCanvasOpen("graph-explorer", {});
    }
  }, [onCanvasOpen]);

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      title="Open Knowledge Graph Explorer"
    >
      <Share2 className="w-3.5 h-3.5" />
      <span>Knowledge Graph</span>
      {entityCount != null && entityCount > 0 && (
        <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-blue-100 px-1.5 py-0 text-[10px] font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
          {entityCount}
        </span>
      )}
    </button>
  );
}
