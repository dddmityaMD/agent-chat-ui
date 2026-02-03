/**
 * Hook for fetching and transforming lineage graph data.
 *
 * Calls the backend lineage API and converts the response to React Flow
 * nodes and edges via graph-transform.
 */
import { useCallback, useEffect, useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import { fetchLineageGraph } from "@/lib/lineage-api";
import {
  transformToReactFlow,
  type LineageNodePayload,
} from "../utils/graph-transform";

interface UseLineageDataResult {
  nodes: Node<LineageNodePayload>[];
  edges: Edge[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetch lineage data from the backend and transform to React Flow format.
 *
 * @param nodeId    - Optional root node UUID for subgraph traversal.
 * @param direction - Optional direction: "upstream", "downstream", or "both".
 * @returns Object with nodes, edges, loading state, error, and refetch function.
 */
export function useLineageData(
  nodeId?: string,
  direction?: string,
): UseLineageDataResult {
  const [nodes, setNodes] = useState<Node<LineageNodePayload>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchLineageGraph(nodeId, direction);
        if (cancelled) return;

        const { nodes: rfNodes, edges: rfEdges } = transformToReactFlow(data);
        setNodes(rfNodes);
        setEdges(rfEdges);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        setNodes([]);
        setEdges([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [nodeId, direction, fetchKey]);

  return { nodes, edges, loading, error, refetch };
}
