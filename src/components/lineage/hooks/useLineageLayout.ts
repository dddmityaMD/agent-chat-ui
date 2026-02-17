/**
 * Hook for computing dagre layout positions for React Flow nodes.
 *
 * Uses @dagrejs/dagre to position nodes in a left-to-right DAG layout.
 * Only re-layouts when nodes have been measured by React Flow (i.e.,
 * after initial render) so that actual dimensions are used.
 *
 * Group nodes (layer overlays) are excluded from dagre — they are purely
 * decorative and positioned separately by the layer toggle logic.
 */
import { useEffect, useMemo, useRef } from "react";
import { useNodesInitialized, useReactFlow } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import dagre from "dagre";
import {
  computeLayerMap,
  LAYER_ORDER,
  type ArchitectureLayer,
} from "../utils/layer-classifier";

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
 * Group nodes (type === "groupNode") are excluded from the layout —
 * they are decorative overlays positioned by the layer toggle.
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
  const dataNodes = nodes.filter((n) => n.type !== "groupNode");
  const groupNodes = nodes.filter((n) => n.type === "groupNode");

  if (dataNodes.length === 0) return nodes;

  const { rankdir = "LR", nodesep = 60, ranksep = 100 } = options;

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir, nodesep, ranksep });
  g.setDefaultEdgeLabel(() => ({}));

  const dataNodeIds = new Set(dataNodes.map((n) => n.id));

  // Add only data nodes with their measured or default dimensions
  for (const node of dataNodes) {
    const w = node.measured?.width ?? DEFAULT_WIDTH;
    const h = node.measured?.height ?? DEFAULT_HEIGHT;
    g.setNode(node.id, { width: w, height: h });
  }

  // Add only edges between data nodes
  for (const edge of edges) {
    if (dataNodeIds.has(edge.source) && dataNodeIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  // Add constraint edges between architecture layers to enforce left-to-right
  // ordering: sources → staging → marts → consumption.
  // Uses graph-aware classification (promotes dbt output tables).
  const layerMap = computeLayerMap(dataNodes, edges);
  const layerNodeIds = new Map<ArchitectureLayer, string[]>();
  for (const node of dataNodes) {
    const layer = layerMap.get(node.id);
    if (!layer) continue;
    const arr = layerNodeIds.get(layer) ?? [];
    arr.push(node.id);
    layerNodeIds.set(layer, arr);
  }

  const occupiedLayers = LAYER_ORDER.filter(
    (l) => (layerNodeIds.get(l)?.length ?? 0) > 0,
  );

  // Chain representative nodes between adjacent layers (rank progression).
  for (let i = 0; i < occupiedLayers.length - 1; i++) {
    const currentIds = layerNodeIds.get(occupiedLayers[i])!;
    const nextIds = layerNodeIds.get(occupiedLayers[i + 1])!;
    if (!g.hasEdge(currentIds[0], nextIds[0])) {
      g.setEdge(currentIds[0], nextIds[0], { minlen: 2, weight: 0 });
    }
  }

  // Consumption barrier: force ALL consumption nodes to the right of ALL
  // non-consumption nodes.  Without this, cards that read directly from
  // source tables end up at rank 1 (next to sources) instead of far right.
  //
  // An invisible barrier node is placed at the max rank of all
  // non-consumption nodes, then each consumption node must be ≥1 rank later.
  const consumptionIds = layerNodeIds.get("consumption") ?? [];
  const nonConsumptionLayers = occupiedLayers.filter(
    (l) => l !== "consumption",
  );

  if (consumptionIds.length > 0 && nonConsumptionLayers.length > 0) {
    const barrierId = "__consumption_barrier";
    g.setNode(barrierId, { width: 1, height: 1 });

    // Every non-consumption node → barrier  (barrier sits at the rightmost
    // rank of staging/marts/sources or later).
    for (const layer of nonConsumptionLayers) {
      for (const nodeId of layerNodeIds.get(layer)!) {
        g.setEdge(nodeId, barrierId, { minlen: 0, weight: 0 });
      }
    }

    // Barrier → every consumption node  (consumption starts after barrier).
    for (const cId of consumptionIds) {
      g.setEdge(barrierId, cId, { minlen: 1, weight: 0 });
    }
  }

  // Run dagre layout
  dagre.layout(g);

  // Map computed positions back to React Flow nodes.
  // dagre returns center positions; React Flow uses top-left origin.
  const positioned = dataNodes.map((node) => {
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

  // Return positioned data nodes + unchanged group nodes
  return [...groupNodes, ...positioned];
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

  // Count only data nodes (not group overlays) for change detection
  const dataNodeCount = useMemo(
    () => nodes.filter((n) => n.type !== "groupNode").length,
    [nodes],
  );

  // Apply layout once nodes are initialized (measured)
  useEffect(() => {
    if (!nodesInitialized || layoutApplied.current || dataNodeCount === 0) {
      return;
    }

    // Get measured nodes from React Flow internal state
    const measuredNodes = getNodes();
    const positioned = getLayoutedNodes(measuredNodes, edges, options);
    setNodes(positioned);
    layoutApplied.current = true;

    // Fit viewport to show all nodes after layout settles
    const rafId = window.requestAnimationFrame(() => {
      fitView({ duration: 0, padding: 0.15, includeHiddenNodes: false });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [nodesInitialized, dataNodeCount, edges, getNodes, setNodes, fitView, options]);

  // Reset flag when data node count changes (e.g., new data fetched).
  // Does NOT reset when group overlay nodes are added/removed.
  useEffect(() => {
    layoutApplied.current = false;
  }, [dataNodeCount]);

  // On first render, return un-positioned nodes (dagre runs after measurement)
  return useMemo(() => {
    if (layoutApplied.current) {
      return getNodes();
    }
    return nodes;
  }, [nodes, getNodes]);
}
