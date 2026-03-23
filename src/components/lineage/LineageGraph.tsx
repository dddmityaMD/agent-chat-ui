/**
 * LineageGraph.tsx — Slim wrapper for the lineage graph visualization.
 *
 * Handles React Flow provider setup, fullscreen toggle, and the collapsed
 * summary card. Core graph implementation is in LineageGraphInner.tsx.
 *
 * Usage:
 *   <LineageGraph />                          // full environment graph
 *   <LineageGraph rootNodeId="uuid-here" />   // subgraph from root
 */
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { fetchLineageGraph } from "@/lib/lineage-api";
import { Maximize2, Network } from "lucide-react";
import { LineageGraphInner } from "./LineageGraphInner";

// -------------------------------------------------------------------
// Props
// -------------------------------------------------------------------

interface LineageGraphProps {
  /** Root node UUID for subgraph traversal. Omit for full graph. */
  rootNodeId?: string;
  /** CSS class for the container div. */
  className?: string;
  /** Optional: auto-trigger impact analysis for this node (e.g. from chat). */
  impactNodeId?: string;
  /** Canonical keys to filter the graph to (show these + their upstream/downstream). */
  filterEntities?: string[];
}

// -------------------------------------------------------------------
// Collapsed summary card (shown inline instead of the full graph)
// -------------------------------------------------------------------

function LineageSummaryCard({
  nodeCount,
  edgeCount,
  loading,
  error,
  onExpand,
}: {
  nodeCount: number;
  edgeCount: number;
  loading: boolean;
  error: string | null;
  onExpand: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
        <Network className="h-5 w-5 animate-pulse text-zinc-400" />
        <span className="text-sm text-zinc-500">Loading lineage...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950">
        <Network className="h-5 w-5 text-red-400" />
        <span className="text-sm text-red-600 dark:text-red-400">
          Failed to load lineage
        </span>
      </div>
    );
  }

  if (nodeCount === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
        <Network className="h-5 w-5 text-zinc-400" />
        <span className="text-sm text-zinc-500">No lineage data available</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onExpand}
      className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-700 dark:hover:bg-blue-950"
      data-testid="lineage-expand-button"
    >
      <Network className="h-5 w-5 text-blue-500" />
      <div className="flex-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Lineage Graph
        </span>
        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
          {nodeCount} nodes &middot; {edgeCount} edges
        </span>
      </div>
      <Maximize2 className="h-4 w-4 text-zinc-400" />
    </button>
  );
}

// -------------------------------------------------------------------
// Exported component (wraps with ReactFlowProvider + fullscreen)
// -------------------------------------------------------------------

export default function LineageGraph(props: LineageGraphProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stats, setStats] = useState({
    nodes: 0,
    edges: 0,
    loading: true,
    error: null as string | null,
  });

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => !v);
  }, []);

  // Fetch graph stats for the summary card
  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      try {
        const data = await fetchLineageGraph(props.rootNodeId);
        if (cancelled) return;
        const visibleNodes = data.nodes.filter(
          (n) => n.type !== "warehouse.column",
        ).length;
        const columnIds = new Set(
          data.nodes
            .filter((n) => n.type === "warehouse.column")
            .map((n) => n.id),
        );
        const visibleEdges = data.edges.filter(
          (e) => !columnIds.has(e.source) && !columnIds.has(e.target),
        ).length;
        setStats({
          nodes: visibleNodes,
          edges: visibleEdges,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setStats({
          nodes: 0,
          edges: 0,
          loading: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
    loadStats();
    return () => {
      cancelled = true;
    };
  }, [props.rootNodeId]);

  // Close fullscreen on Escape
  useEffect(() => {
    if (!isFullscreen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsFullscreen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  if (isFullscreen) {
    return (
      <div
        className="fixed inset-0 z-50 bg-white dark:bg-zinc-950"
        data-testid="lineage-fullscreen"
      >
        <ReactFlowProvider>
          <LineageGraphInner
            {...props}
            className="h-full w-full"
            isFullscreen
            onToggleFullscreen={toggleFullscreen}
          />
        </ReactFlowProvider>
      </div>
    );
  }

  return (
    <LineageSummaryCard
      nodeCount={stats.nodes}
      edgeCount={stats.edges}
      loading={stats.loading}
      error={stats.error}
      onExpand={toggleFullscreen}
    />
  );
}
