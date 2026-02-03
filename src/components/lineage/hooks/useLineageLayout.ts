/**
 * Hook for computing dagre layout positions for React Flow nodes.
 *
 * Uses @dagrejs/dagre to position nodes in a left-to-right DAG layout.
 * Only re-layouts when nodes have been measured by React Flow (i.e.,
 * after initial render) so that actual dimensions are used.
 */
import { useEffect, useMemo, useRef } from "react";
import { useNodesInitialized, useReactFlow } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import dagre from "dagre";

// Default node dimensions for dagre when measured sizes are unavailable
const DEFAULT_WIDTH = 180;
const DEFAULT_HEIGHT = 60;

interface LayoutOptions {
  /** Direction of the graph: LR (left-to-right) or TB (top-to-bottom). */
  rankdir?: "LR" | "TB";
  /** Horizontal spacing between nodes. */
  nodesep?: number;
  /** Vertical spacing between ranks. */
  ranksep?: number;
}

/**
 * Compute dagre-positioned nodes from the current React Flow state.
 *
 * @param nodes  - React Flow nodes (possibly un-positioned).
 * @param edges  - React Flow edges.
 * @param options - Dagre layout options.
 * @returns Positioned nodes array (same nodes with updated x/y).
 */
export function getLayoutedNodes(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {},
): Node[] {
  if (nodes.length === 0) return [];

  const { rankdir = "LR", nodesep = 40, ranksep = 80 } = options;

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir, nodesep, ranksep });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes with their measured or default dimensions
  for (const node of nodes) {
    const w = node.measured?.width ?? DEFAULT_WIDTH;
    const h = node.measured?.height ?? DEFAULT_HEIGHT;
    g.setNode(node.id, { width: w, height: h });
  }

  // Add edges
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  // Run dagre layout
  dagre.layout(g);

  // Map computed positions back to React Flow nodes.
  // dagre returns center positions; React Flow uses top-left origin.
  return nodes.map((node) => {
    const dagreNode = g.node(node.id);
    if (!dagreNode) return node;

    const w = node.measured?.width ?? DEFAULT_WIDTH;
    const h = node.measured?.height ?? DEFAULT_HEIGHT;

    return {
      ...node,
      position: {
        x: dagreNode.x - w / 2,
        y: dagreNode.y - h / 2,
      },
    };
  });
}

/**
 * React hook that auto-layouts nodes using dagre after they are measured.
 *
 * Listens for `useNodesInitialized` to know when React Flow has rendered
 * and measured all nodes, then applies the dagre layout once.
 *
 * @param nodes  - Input nodes from data fetching.
 * @param edges  - Input edges from data fetching.
 * @param options - Dagre layout options.
 * @returns Positioned nodes ready for React Flow rendering.
 */
export function useLineageLayout(
  nodes: Node[],
  edges: Edge[],
  options?: LayoutOptions,
): Node[] {
  const nodesInitialized = useNodesInitialized();
  const { getNodes, setNodes, fitView } = useReactFlow();
  const layoutApplied = useRef(false);

  // Apply layout once nodes are initialized (measured)
  useEffect(() => {
    if (!nodesInitialized || layoutApplied.current || nodes.length === 0) {
      return;
    }

    // Get measured nodes from React Flow internal state
    const measuredNodes = getNodes();
    const positioned = getLayoutedNodes(measuredNodes, edges, options);
    setNodes(positioned);
    layoutApplied.current = true;

    // Fit view after a short delay to let positions settle
    window.requestAnimationFrame(() => {
      fitView({ padding: 0.1 });
    });
  }, [nodesInitialized, nodes.length, edges, getNodes, setNodes, fitView, options]);

  // Reset flag when input nodes change (e.g., new root selected)
  useEffect(() => {
    layoutApplied.current = false;
  }, [nodes]);

  // On first render, return un-positioned nodes (dagre runs after measurement)
  return useMemo(() => {
    if (layoutApplied.current) {
      return getNodes();
    }
    return nodes;
  }, [nodes, getNodes]);
}
