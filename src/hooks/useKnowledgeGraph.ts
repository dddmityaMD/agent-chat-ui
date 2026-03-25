"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { getApiBaseUrl } from "@/lib/api-url";

// ---------------------------------------------------------------------------
// API response types (matches backend Pydantic models)
// ---------------------------------------------------------------------------

export interface GraphNodeResponse {
  id: string;
  label: string;
  type: string;
  source_type: string;
  props: Record<string, unknown>;
  confidence: number;
}

export interface GraphEdgeResponse {
  id: string;
  source: string;
  target: string;
  type: string;
  props: Record<string, unknown>;
  confidence: number;
}

export interface KnowledgeGraphResponse {
  nodes: GraphNodeResponse[];
  edges: GraphEdgeResponse[];
  total_nodes: number;
  total_edges: number;
}

export interface KnowledgeGraphStatsResponse {
  total_nodes: number;
  total_edges: number;
  by_type: Record<string, number>;
  by_source: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Sigma-ready node/edge types
// ---------------------------------------------------------------------------

export interface SigmaNode {
  id: string;
  label: string;
  type: string;
  sourceType: string;
  props: Record<string, unknown>;
  confidence: number;
  x: number;
  y: number;
  size: number;
  color: string;
}

export interface SigmaEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Color mapping by entity type
// ---------------------------------------------------------------------------

const NODE_COLOR_MAP: Record<string, string> = {
  table: "#3b82f6",
  column: "#9ca3af",
  metric: "#22c55e",
  dashboard: "#8b5cf6",
  model: "#f59e0b",
};

const DEFAULT_NODE_COLOR = "#6b7280";

export function getNodeColor(entityType: string): string {
  return NODE_COLOR_MAP[entityType] ?? DEFAULT_NODE_COLOR;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface KnowledgeGraphFilters {
  source_type?: string;
  entity_type?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseKnowledgeGraphReturn {
  nodes: SigmaNode[];
  edges: SigmaEdge[];
  stats: KnowledgeGraphStatsResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: (filters?: KnowledgeGraphFilters) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

function buildEdgeCountMap(edges: GraphEdgeResponse[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
  }
  return counts;
}

function transformNodes(
  apiNodes: GraphNodeResponse[],
  edgeCounts: Map<string, number>,
): SigmaNode[] {
  return apiNodes.map((n) => {
    const connections = edgeCounts.get(n.id) ?? 0;
    // Size: base 4, scale with connections (log scale to prevent giants)
    const size = 4 + Math.min(Math.log2(connections + 1) * 3, 16);

    return {
      id: n.id,
      label: n.label,
      type: n.type,
      sourceType: n.source_type,
      props: n.props,
      confidence: n.confidence,
      // Random initial positions — ForceAtlas2 will reposition
      x: Math.random() * 100 - 50,
      y: Math.random() * 100 - 50,
      size,
      color: getNodeColor(n.type),
    };
  });
}

function transformEdges(apiEdges: GraphEdgeResponse[]): SigmaEdge[] {
  return apiEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type,
    label: e.type,
  }));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKnowledgeGraph(
  initialFilters?: KnowledgeGraphFilters,
): UseKnowledgeGraphReturn {
  const baseUrl = getApiBaseUrl();
  const [nodes, setNodes] = useState<SigmaNode[]>([]);
  const [edges, setEdges] = useState<SigmaEdge[]>([]);
  const [stats, setStats] = useState<KnowledgeGraphStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const filtersRef = useRef(initialFilters);

  const fetchGraph = useCallback(
    async (filters?: KnowledgeGraphFilters) => {
      const active = filters ?? filtersRef.current;
      filtersRef.current = active;

      setIsLoading(true);
      setError(null);

      try {
        // Build query string
        const params = new URLSearchParams();
        if (active?.source_type) params.set("source_type", active.source_type);
        if (active?.entity_type) params.set("entity_type", active.entity_type);
        if (active?.limit) params.set("limit", String(active.limit));
        const qs = params.toString();

        // Fetch graph + stats in parallel
        const [graphRes, statsRes] = await Promise.all([
          fetch(`${baseUrl}/api/knowledge-graph${qs ? `?${qs}` : ""}`),
          fetch(`${baseUrl}/api/knowledge-graph/stats`),
        ]);

        if (!graphRes.ok) {
          throw new Error(
            `KG API error: ${graphRes.status} ${graphRes.statusText}`,
          );
        }

        const graphData: KnowledgeGraphResponse = await graphRes.json();
        const edgeCounts = buildEdgeCountMap(graphData.edges);

        setNodes(transformNodes(graphData.nodes, edgeCounts));
        setEdges(transformEdges(graphData.edges));

        if (statsRes.ok) {
          const statsData: KnowledgeGraphStatsResponse = await statsRes.json();
          setStats(statsData);
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [baseUrl],
  );

  // Initial fetch on mount
  useEffect(() => {
    fetchGraph(initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { nodes, edges, stats, isLoading, error, refetch: fetchGraph };
}
