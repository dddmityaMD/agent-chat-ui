"use client";

import React from "react";
import { ReactFlowProvider } from "@xyflow/react";
import LineageGraph from "@/components/lineage/LineageGraph";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LineageRendererProps {
  /**
   * Expected shape: { rootNodeId?: string; filterEntities?: string[] }
   * Falls back to full graph if no rootNodeId provided.
   */
  data: unknown;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

interface LineageData {
  rootNodeId?: string;
  filterEntities?: string[];
}

function isLineageData(v: unknown): v is LineageData {
  return v != null && typeof v === "object";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LineageRenderer({ data }: LineageRendererProps) {
  if (!isLineageData(data)) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        No lineage data available
      </div>
    );
  }

  return (
    <div className="h-full w-full" data-testid="lineage-renderer">
      <ReactFlowProvider>
        <LineageGraph
          rootNodeId={data.rootNodeId}
          filterEntities={data.filterEntities}
          className="h-full w-full"
        />
      </ReactFlowProvider>
    </div>
  );
}
