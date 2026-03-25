"use client";

import React, { useEffect, useCallback, useState, useMemo, useRef } from "react";
import {
  SigmaContainer,
  useRegisterEvents,
  useLoadGraph,
  useSigma,
} from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import Graph from "graphology";
import FA2LayoutSupervisor from "graphology-layout-forceatlas2/worker";
import { inferSettings } from "graphology-layout-forceatlas2";

import {
  useKnowledgeGraph,
  type SigmaNode,
  type SigmaEdge,
  type KnowledgeGraphStatsResponse,
  type KnowledgeGraphFilters,
  getNodeColor,
} from "@/hooks/useKnowledgeGraph";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphExplorerInnerProps {
  className?: string;
}

interface NodeDetails {
  id: string;
  label: string;
  type: string;
  sourceType: string;
  props: Record<string, unknown>;
  confidence: number;
}

// ---------------------------------------------------------------------------
// GraphLoader — loads nodes/edges into the Sigma graph instance
// ---------------------------------------------------------------------------

function GraphLoader({
  nodes,
  edges,
}: {
  nodes: SigmaNode[];
  edges: SigmaEdge[];
}) {
  const loadGraph = useLoadGraph();
  const sigma = useSigma();

  useEffect(() => {
    const graph = new Graph();

    for (const node of nodes) {
      graph.addNode(node.id, {
        label: node.label,
        x: node.x,
        y: node.y,
        size: node.size,
        color: node.color,
        type: node.type,
        sourceType: node.sourceType,
        props: node.props,
        confidence: node.confidence,
      });
    }

    for (const edge of edges) {
      // Skip duplicate edges or self-loops
      if (edge.source === edge.target) continue;
      if (graph.hasEdge(edge.source, edge.target)) continue;
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;

      graph.addEdge(edge.source, edge.target, {
        label: edge.label,
        size: 1,
        color: "#e2e8f0",
      });
    }

    loadGraph(graph);

    // Run async ForceAtlas2 layout
    if (graph.order > 0) {
      const settings = inferSettings(graph);
      const supervisor = new FA2LayoutSupervisor(graph, {
        settings: { ...settings, gravity: 1, slowDown: 10 },
      });
      supervisor.start();

      // Stop layout after 3 seconds to save CPU
      const timer = setTimeout(() => {
        supervisor.stop();
      }, 3000);

      return () => {
        clearTimeout(timer);
        supervisor.kill();
      };
    }
  }, [nodes, edges, loadGraph, sigma]);

  return null;
}

// ---------------------------------------------------------------------------
// EventHandler — handles hover/click interactions
// ---------------------------------------------------------------------------

function EventHandler({
  onNodeClick,
  onNodeHover,
  onNodeOut,
}: {
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string) => void;
  onNodeOut: () => void;
}) {
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();

  useEffect(() => {
    registerEvents({
      clickNode: (event) => {
        onNodeClick(event.node);
      },
      enterNode: (event) => {
        onNodeHover(event.node);
        // Highlight connected edges
        const graph = sigma.getGraph();
        const neighbors = new Set(graph.neighbors(event.node));
        sigma.setSetting("nodeReducer", (node, data) => {
          if (node === event.node || neighbors.has(node)) {
            return { ...data, zIndex: 1 };
          }
          return { ...data, color: "#e2e8f0", zIndex: 0 };
        });
        sigma.setSetting("edgeReducer", (edge, data) => {
          const graph = sigma.getGraph();
          const src = graph.source(edge);
          const tgt = graph.target(edge);
          if (src === event.node || tgt === event.node) {
            return { ...data, color: "#3b82f6", size: 2 };
          }
          return { ...data, color: "#f1f5f9", size: 0.5 };
        });
      },
      leaveNode: () => {
        onNodeOut();
        sigma.setSetting("nodeReducer", null);
        sigma.setSetting("edgeReducer", null);
      },
    });
  }, [registerEvents, sigma, onNodeClick, onNodeHover, onNodeOut]);

  return null;
}

// ---------------------------------------------------------------------------
// FilterBar — source_type / entity_type dropdowns + stats
// ---------------------------------------------------------------------------

function FilterBar({
  stats,
  filters,
  onFilterChange,
}: {
  stats: KnowledgeGraphStatsResponse | null;
  filters: KnowledgeGraphFilters;
  onFilterChange: (f: KnowledgeGraphFilters) => void;
}) {
  const sourceTypes = useMemo(
    () => (stats ? Object.keys(stats.by_source).sort() : []),
    [stats],
  );
  const entityTypes = useMemo(
    () => (stats ? Object.keys(stats.by_type).sort() : []),
    [stats],
  );

  return (
    <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-muted-foreground">Source:</label>
        <select
          className="rounded border border-border bg-background px-2 py-0.5 text-xs"
          value={filters.source_type ?? ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              source_type: e.target.value || undefined,
            })
          }
        >
          <option value="">All</option>
          {sourceTypes.map((s) => (
            <option key={s} value={s}>
              {s} ({stats?.by_source[s] ?? 0})
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs text-muted-foreground">Type:</label>
        <select
          className="rounded border border-border bg-background px-2 py-0.5 text-xs"
          value={filters.entity_type ?? ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              entity_type: e.target.value || undefined,
            })
          }
        >
          <option value="">All</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {t} ({stats?.by_type[t] ?? 0})
            </option>
          ))}
        </select>
      </div>

      {stats && (
        <div className="ml-auto text-xs text-muted-foreground">
          {stats.total_nodes} entities, {stats.total_edges} relationships
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NodeTooltip — shows node properties on click
// ---------------------------------------------------------------------------

function NodeTooltip({
  node,
  onClose,
}: {
  node: NodeDetails;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-3 top-14 z-10 w-72 rounded-lg border border-border bg-background p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{node.label}</h4>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: getNodeColor(node.type) }}
          />
          <span className="text-muted-foreground">Type:</span>
          <span>{node.type}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Source:</span>{" "}
          <span>{node.sourceType}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Confidence:</span>{" "}
          <span>{(node.confidence * 100).toFixed(0)}%</span>
        </div>
        {Object.entries(node.props).length > 0 && (
          <div className="mt-2 border-t border-border pt-2">
            <span className="font-medium text-muted-foreground">Properties:</span>
            <dl className="mt-1 space-y-0.5">
              {Object.entries(node.props)
                .filter(([, v]) => v != null && v !== "")
                .slice(0, 8)
                .map(([key, val]) => (
                  <div key={key} className="flex gap-1">
                    <dt className="text-muted-foreground">{key}:</dt>
                    <dd className="truncate">{String(val)}</dd>
                  </div>
                ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GraphExplorerInner({ className }: GraphExplorerInnerProps) {
  const [filters, setFilters] = useState<KnowledgeGraphFilters>({});
  const { nodes, edges, stats, isLoading, error, refetch } =
    useKnowledgeGraph(filters);
  const [selectedNode, setSelectedNode] = useState<NodeDetails | null>(null);
  const graphRef = useRef<Graph | null>(null);

  const handleFilterChange = useCallback(
    (newFilters: KnowledgeGraphFilters) => {
      setFilters(newFilters);
      setSelectedNode(null);
      refetch(newFilters);
    },
    [refetch],
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        setSelectedNode({
          id: node.id,
          label: node.label,
          type: node.type,
          sourceType: node.sourceType,
          props: node.props,
          confidence: node.confidence,
        });
      }
    },
    [nodes],
  );

  const handleNodeHover = useCallback(() => {
    // Hover highlighting is handled by the EventHandler's enterNode
  }, []);

  const handleNodeOut = useCallback(() => {
    // Unhighlight handled by EventHandler's leaveNode
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-red-500">
        Failed to load knowledge graph: {error.message}
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col ${className ?? ""}`} data-testid="graph-explorer">
      <FilterBar
        stats={stats}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <div className="relative flex-1">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
            <span className="text-sm text-muted-foreground">Loading graph...</span>
          </div>
        )}

        {nodes.length === 0 && !isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No entities in the knowledge graph yet. Run an investigation to populate it.
          </div>
        ) : (
          <SigmaContainer
            style={{ width: "100%", height: "100%" }}
            settings={{
              defaultNodeColor: "#6b7280",
              defaultEdgeColor: "#e2e8f0",
              labelRenderedSizeThreshold: 8,
              labelDensity: 0.15,
              labelGridCellSize: 80,
              renderEdgeLabels: false,
              enableEdgeEvents: false,
            }}
          >
            <GraphLoader nodes={nodes} edges={edges} />
            <EventHandler
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              onNodeOut={handleNodeOut}
            />
          </SigmaContainer>
        )}

        {selectedNode && (
          <NodeTooltip
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}
