/**
 * LineageGraph - Main React Flow wrapper for lineage visualization.
 *
 * Renders the knowledge graph as a DAG with custom node types,
 * animated directional edges, and automatic dagre layout (left-to-right).
 *
 * Features:
 * - Click a node to open a detail panel (right-side slide-in)
 * - Double-click a node to navigate to its source system
 * - Minimap always visible for navigation orientation
 * - Fullscreen toggle for detailed exploration
 * - Layer toggle for architecture zone backgrounds
 * - Direction toggle for upstream/downstream filtering
 *
 * Usage:
 *   <LineageGraph />                          // full environment graph
 *   <LineageGraph rootNodeId="uuid-here" />   // subgraph from root
 */
"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";
import type {
  NodeTypes,
  EdgeTypes,
  Node,
  NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { TableNode } from "./nodes/TableNode";
import { CardNode } from "./nodes/CardNode";
import { DbtModelNode } from "./nodes/DbtModelNode";
import { ColumnNode } from "./nodes/ColumnNode";
import { KpiNode } from "./nodes/KpiNode";
import { GroupNode } from "./nodes/GroupNode";
import { AnimatedEdge } from "./edges/AnimatedEdge";
import { useLineageData } from "./hooks/useLineageData";
import { useLineageLayout } from "./hooks/useLineageLayout";
import { NodeDetailPanel } from "./panels/NodeDetailPanel";
import { ImpactPanel } from "./panels/ImpactPanel";
import { LayerToggle } from "./controls/LayerToggle";
import { DirectionToggle } from "./controls/DirectionToggle";
import type { LineageNodeData, ImpactResult } from "@/lib/lineage-api";
import { fetchImpactAnalysis, fetchLineageGraph } from "@/lib/lineage-api";
import type { LineageNodePayload } from "./utils/graph-transform";
import { applyImpactStyling } from "./utils/graph-transform";
import type { Direction } from "./controls/DirectionToggle";
import {
  LAYER_COLORS,
  LAYER_ORDER,
  computeLayerMap,
  type ArchitectureLayer,
} from "./utils/layer-classifier";
import { Maximize2, Minimize2, Network } from "lucide-react";

// -------------------------------------------------------------------
// Node and edge type registries (MUST be defined outside component)
// -------------------------------------------------------------------

const nodeTypes: NodeTypes = {
  tableNode: TableNode,
  cardNode: CardNode,
  dbtModelNode: DbtModelNode,
  columnNode: ColumnNode,
  kpiNode: KpiNode,
  groupNode: GroupNode,
};

const edgeTypes: EdgeTypes = {
  animatedEdge: AnimatedEdge,
};

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

/** Default zoom level — keeps nodes readable. */
const DEFAULT_ZOOM = 1;

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
  /** Whether the graph is in fullscreen mode (controlled by parent). */
  isFullscreen?: boolean;
  /** Callback to toggle fullscreen. */
  onToggleFullscreen?: () => void;
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

/**
 * Build a source system URL for double-click navigation.
 * Returns null if no external system is available for this node type.
 */
/** Slugify a name for Metabase URL (e.g. "E-Commerce Insights" → "e-commerce-insights"). */
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Extract the numeric Metabase ID from a canonical key like "metabase:card:5". */
function extractMetabaseId(canonicalKey: string | null | undefined): string | null {
  if (!canonicalKey) return null;
  const parts = canonicalKey.split(":");
  // Expected format: "metabase:{card|dashboard}:{id}"
  if (parts.length >= 3 && parts[0] === "metabase") return parts[2];
  return null;
}

function buildSourceUrl(node: LineageNodeData): string | null {
  const metabaseBase =
    process.env.NEXT_PUBLIC_METABASE_URL || "http://localhost:3001";

  switch (node.type) {
    case "metabase.card": {
      const numId = extractMetabaseId(node.canonical_key);
      if (!numId) return null;
      const name = node.props?.name as string | undefined;
      const slug = name ? `${numId}-${slugify(name)}` : numId;
      return `${metabaseBase}/question/${slug}`;
    }
    case "metabase.dashboard": {
      const numId = extractMetabaseId(node.canonical_key);
      if (!numId) return null;
      const name = node.props?.name as string | undefined;
      const slug = name ? `${numId}-${slugify(name)}` : numId;
      return `${metabaseBase}/dashboard/${slug}`;
    }
    case "dbt.model":
    case "dbt.source": {
      const dbtBase = process.env.NEXT_PUBLIC_DBT_DOCS_URL;
      if (!dbtBase) return null;
      const uniqueId = (node.props?.unique_id as string) ?? node.id;
      return `${dbtBase}/#!/model/${uniqueId}`;
    }
    default:
      return null;
  }
}

/**
 * Convert a React Flow node to LineageNodeData for the detail panel.
 * Passes embedded columns through via a _columns prop key.
 */
function toLineageNodeData(rfNode: Node): LineageNodeData {
  const payload = rfNode.data as unknown as LineageNodePayload;
  return {
    id: rfNode.id,
    type: payload.backendType,
    label: payload.label,
    props: {
      ...payload.props,
      ...(payload.columns ? { _columns: payload.columns } : {}),
    },
    canonical_key: payload.canonicalKey,
  };
}

/**
 * Build overlay group nodes for architecture layers.
 *
 * Group nodes are purely decorative backgrounds — they do NOT parent child
 * nodes.  This avoids React Flow reparenting side-effects (position drift,
 * extent constraints).  Each group is placed behind regular nodes via
 * zIndex: -1 and pointer-events: none.
 */
/**
 * Build non-overlapping vertical stripe overlays for architecture layers.
 *
 * Computes full-height vertical stripes based on actual node bounds (min/max x)
 * so that every node sits comfortably inside its layer stripe with padding.
 * Boundaries between adjacent stripes are placed at the midpoint of the gap
 * between the two layers' node extents.
 */
function buildLayerOverlayNodes(
  nodes: Node[],
  nodeLayerMap: Map<string, ArchitectureLayer>,
): Node[] {
  // Group nodes by layer
  const layerNodesMap = new Map<ArchitectureLayer, Node[]>();
  let globalMinY = Infinity;
  let globalMaxY = -Infinity;

  for (const node of nodes) {
    if (node.type === "groupNode") continue;
    const layer = nodeLayerMap.get(node.id);
    if (!layer) continue;

    const h = node.measured?.height ?? 60;
    globalMinY = Math.min(globalMinY, node.position.y);
    globalMaxY = Math.max(globalMaxY, node.position.y + h);

    const arr = layerNodesMap.get(layer) ?? [];
    arr.push(node);
    layerNodesMap.set(layer, arr);
  }

  if (globalMinY === Infinity) return [];

  const padding = 40;

  // Compute actual x-bounds for each occupied layer
  interface LayerInfo {
    layer: ArchitectureLayer;
    minX: number; // leftmost node position
    maxX: number; // rightmost node edge (pos + width)
    medianX: number;
  }

  const layerInfos: LayerInfo[] = [];
  for (const layer of LAYER_ORDER) {
    const lNodes = layerNodesMap.get(layer);
    if (!lNodes || lNodes.length === 0) continue;

    let minX = Infinity;
    let maxX = -Infinity;
    const centers: number[] = [];
    for (const n of lNodes) {
      const w = n.measured?.width ?? 180;
      minX = Math.min(minX, n.position.x);
      maxX = Math.max(maxX, n.position.x + w);
      centers.push(n.position.x + w / 2);
    }
    centers.sort((a, b) => a - b);
    layerInfos.push({
      layer,
      minX,
      maxX,
      medianX: centers[Math.floor(centers.length / 2)],
    });
  }

  // Sort by median x (should match LAYER_ORDER for a well-laid-out graph)
  layerInfos.sort((a, b) => a.medianX - b.medianX);

  // Compute non-overlapping stripe boundaries.
  // Boundaries sit at the midpoint of the gap between adjacent layers'
  // actual node extents, so every node has padding within its stripe.
  const overlayNodes: Node[] = [];
  const gap = 10; // visual gap between stripes

  for (let i = 0; i < layerInfos.length; i++) {
    const info = layerInfos[i];
    const colors = LAYER_COLORS[info.layer];

    let left: number;
    let right: number;

    if (i === 0) {
      left = info.minX - padding;
    } else {
      // Midpoint of the gap between previous layer's rightmost node
      // and this layer's leftmost node
      const prevMax = layerInfos[i - 1].maxX;
      const currMin = info.minX;
      left = (prevMax + currMin) / 2 + gap / 2;
    }

    if (i === layerInfos.length - 1) {
      right = info.maxX + padding;
    } else {
      // Midpoint of the gap between this layer's rightmost node
      // and next layer's leftmost node
      const currMax = info.maxX;
      const nextMin = layerInfos[i + 1].minX;
      right = (currMax + nextMin) / 2 - gap / 2;
    }

    // Safety: ensure stripe always covers all nodes with minimum padding
    left = Math.min(left, info.minX - 20);
    right = Math.max(right, info.maxX + 20);

    overlayNodes.push({
      id: `group-${info.layer}`,
      type: "groupNode",
      position: { x: left, y: globalMinY - padding - 24 },
      zIndex: -1,
      selectable: false,
      draggable: false,
      data: {
        label: colors.label,
        layer: info.layer,
        bg: colors.bg,
        border: colors.border,
      },
      style: {
        width: Math.max(right - left, 120),
        height: globalMaxY - globalMinY + padding * 2 + 24,
      },
    });
  }

  return overlayNodes;
}

// -------------------------------------------------------------------
// Inner component (needs ReactFlowProvider context)
// -------------------------------------------------------------------

// -- Context menu component ---------------------------------------------------

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  nodeLabel: string;
}

function NodeContextMenu({
  menu,
  onAnalyzeImpact,
  onClose,
}: {
  menu: ContextMenuState;
  onAnalyzeImpact: (nodeId: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-[60] min-w-[180px] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: menu.x, top: menu.y }}
      data-testid="node-context-menu"
    >
      <div className="px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {menu.nodeLabel}
      </div>
      <hr className="border-zinc-200 dark:border-zinc-700" />
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
        onClick={() => {
          onAnalyzeImpact(menu.nodeId);
          onClose();
        }}
        data-testid="context-menu-analyze-impact"
      >
        <span className="text-red-500">&#9889;</span>
        Analyze Impact
      </button>
    </div>
  );
}

function LineageGraphInner({
  rootNodeId,
  className,
  impactNodeId,
  isFullscreen,
  onToggleFullscreen,
}: LineageGraphProps) {
  // State: direction, selected node, layers
  const [direction, setDirection] = useState<Direction>("both");
  const [selectedNode, setSelectedNode] = useState<LineageNodeData | null>(null);
  const [layersEnabled, setLayersEnabled] = useState(false);

  // Impact analysis state
  const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [dimUnaffected, setDimUnaffected] = useState(true);
  const [hideUnaffected, setHideUnaffected] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const { setViewport } = useReactFlow();

  const {
    nodes: rawNodes,
    edges: rawEdges,
    loading,
    error,
  } = useLineageData(rootNodeId, direction);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(rawNodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  // Sync fetched data into React Flow state
  React.useEffect(() => {
    setNodes(rawNodes as Node[]);
    setEdges(rawEdges);
  }, [rawNodes, rawEdges, setNodes, setEdges]);

  // Apply dagre layout after nodes are measured
  useLineageLayout(nodes, edges);

  // Build layer overlay groups when enabled.
  // Uses requestAnimationFrame to ensure dagre positions are settled.
  React.useEffect(() => {
    if (!layersEnabled) {
      setNodes((current) => current.filter((n) => n.type !== "groupNode"));
      return;
    }

    // Wait one frame for dagre positions to be applied
    const raf = window.requestAnimationFrame(() => {
      setNodes((current) => {
        const nonGroupNodes = current.filter((n) => n.type !== "groupNode");
        if (nonGroupNodes.length === 0) return current;

        const nodeLayerMap = computeLayerMap(nonGroupNodes, edges);
        const overlayNodes = buildLayerOverlayNodes(nonGroupNodes, nodeLayerMap);
        return [...overlayNodes, ...nonGroupNodes];
      });
    });

    return () => window.cancelAnimationFrame(raf);
  }, [layersEnabled, setNodes, edges]);

  // -- Client-side direction filtering: hide nodes not matching direction ----
  // Uses the full edge set (rawEdges from useLineageData) for BFS traversal,
  // preserving dagre-computed positions by toggling hidden instead of re-layout.
  React.useEffect(() => {
    if (direction === "both" || !selectedNode) {
      // Show all nodes (restore from any previous filtering)
      setNodes((current) =>
        current.map((n) => (n.type === "groupNode" ? n : { ...n, hidden: false })),
      );
      setEdges((current) =>
        current.map((e) => ({ ...e, hidden: false })),
      );
      return;
    }

    // BFS from selected node in the specified direction
    const selectedId = selectedNode.id;
    const reachable = new Set<string>([selectedId]);
    const queue = [selectedId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of rawEdges) {
        if (
          direction === "upstream" &&
          edge.target === current &&
          !reachable.has(edge.source)
        ) {
          reachable.add(edge.source);
          queue.push(edge.source);
        } else if (
          direction === "downstream" &&
          edge.source === current &&
          !reachable.has(edge.target)
        ) {
          reachable.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    setNodes((current) =>
      current.map((n) =>
        n.type === "groupNode" ? n : { ...n, hidden: !reachable.has(n.id) },
      ),
    );
    setEdges((current) =>
      current.map((e) => ({
        ...e,
        hidden: !reachable.has(e.source) || !reachable.has(e.target),
      })),
    );
  }, [direction, selectedNode, rawEdges, setNodes, setEdges]);

  // -- Event handlers -------------------------------------------------------

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, rfNode) => {
      const nodeData = toLineageNodeData(rfNode);
      setSelectedNode(nodeData);
    },
    [],
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, rfNode) => {
      const nodeData = toLineageNodeData(rfNode);
      const url = buildSourceUrl(nodeData);
      if (url) {
        window.open(url, "_blank");
      }
    },
    [],
  );

  const onClosePanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // -- Impact analysis handlers -----------------------------------------------

  /** Trigger impact analysis for a node. */
  const triggerImpactAnalysis = useCallback(
    async (nodeId: string) => {
      setImpactLoading(true);
      try {
        const result = await fetchImpactAnalysis(nodeId);
        setImpactResult(result);
        setDimUnaffected(true);
        setHideUnaffected(false);
      } catch (err) {
        console.error("Impact analysis failed:", err);
      } finally {
        setImpactLoading(false);
      }
    },
    [],
  );

  /** Clear impact analysis state. */
  const clearImpact = useCallback(() => {
    setImpactResult(null);
    setContextMenu(null);
  }, []);

  /** Right-click handler for context menu. */
  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, rfNode) => {
      event.preventDefault();
      const payload = rfNode.data as unknown as LineageNodePayload;
      // Use the event coordinates relative to the container
      const container = (event.target as HTMLElement).closest(
        ".react-flow",
      );
      const rect = container?.getBoundingClientRect() ?? {
        left: 0,
        top: 0,
      };
      setContextMenu({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        nodeId: rfNode.id,
        nodeLabel: payload.label,
      });
    },
    [],
  );

  /** Close context menu on pane click. */
  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  // -- Apply impact styling to nodes ------------------------------------------

  React.useEffect(() => {
    if (!impactResult) {
      // Clear styles when no impact result
      setNodes((current) =>
        current.map((n) => ({
          ...n,
          hidden: false,
          style: {
            ...n.style,
            opacity: 1,
            borderColor: undefined,
            borderWidth: undefined,
          },
        })),
      );
      return;
    }

    setNodes((current) => {
      const nonGroupNodes = current.filter((n) => n.type !== "groupNode");
      const groupNodes = current.filter((n) => n.type === "groupNode");
      const styled = applyImpactStyling(
        nonGroupNodes as Node<LineageNodePayload>[],
        impactResult,
        dimUnaffected,
        hideUnaffected,
      );
      return [...groupNodes, ...styled];
    });
  }, [impactResult, dimUnaffected, hideUnaffected, setNodes]);

  // -- Auto-trigger impact analysis from prop ---------------------------------

  React.useEffect(() => {
    if (impactNodeId && !impactLoading && nodes.length > 0) {
      triggerImpactAnalysis(impactNodeId);
    }
    // Only trigger when impactNodeId changes, not on every re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impactNodeId]);

  // -- Loading / error / empty states ---------------------------------------

  if (loading) {
    return (
      <div className={`flex h-full items-center justify-center ${className ?? ""}`}>
        <div className="text-sm text-muted-foreground">Loading lineage graph...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex h-full items-center justify-center ${className ?? ""}`}>
        <div className="text-sm text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (rawNodes.length === 0) {
    return (
      <div className={`flex h-full items-center justify-center ${className ?? ""}`}>
        <div className="text-sm text-muted-foreground">
          No lineage data available.
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      {/* Control bar */}
      <div className="absolute right-2 top-2 z-40 flex flex-col gap-1">
        <DirectionToggle direction={direction} onChange={setDirection} />
        <LayerToggle enabled={layersEnabled} onToggle={setLayersEnabled} />
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="flex items-center justify-center rounded-md border border-zinc-200 bg-white p-1.5 text-zinc-600 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            data-testid="fullscreen-toggle"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Node count indicator */}
      <div className="absolute left-2 top-2 z-40 rounded-md bg-white/80 px-2 py-1 text-xs text-zinc-500 shadow-sm backdrop-blur-sm">
        {rawNodes.length} nodes
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        minZoom={0.05}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: DEFAULT_ZOOM }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls showFitView />
        <MiniMap
          nodeStrokeWidth={2}
          zoomable
          pannable
          className="!bottom-2 !right-2"
        />
      </ReactFlow>

      {/* Context menu */}
      {contextMenu && (
        <NodeContextMenu
          menu={contextMenu}
          onAnalyzeImpact={triggerImpactAnalysis}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Impact loading indicator */}
      {impactLoading && (
        <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-white shadow-lg">
          Analyzing impact...
        </div>
      )}

      {/* Impact panel (slide-in from right) */}
      <ImpactPanel
        impactResult={impactResult}
        onClose={clearImpact}
        onNodeClick={(nodeId) => {
          // Highlight node in graph by selecting it
          const rfNode = nodes.find((n) => n.id === nodeId);
          if (rfNode) {
            setSelectedNode(toLineageNodeData(rfNode));
          }
        }}
        dimUnaffected={dimUnaffected}
        onToggleDim={() => setDimUnaffected((v) => !v)}
        hideUnaffected={hideUnaffected}
        onToggleHide={() => setHideUnaffected((v) => !v)}
      />

      {/* Node detail panel (slide-in from right, behind impact panel) */}
      {!impactResult && (
        <NodeDetailPanel selectedNode={selectedNode} onClose={onClosePanel} />
      )}
    </div>
  );
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

export default function LineageGraph(props: Omit<LineageGraphProps, "isFullscreen" | "onToggleFullscreen">) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stats, setStats] = useState({ nodes: 0, edges: 0, loading: true, error: null as string | null });

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
        // Subtract column nodes from count to match the filtered graph
        const visibleNodes = data.nodes.filter((n) => n.type !== "warehouse.column").length;
        const columnIds = new Set(data.nodes.filter((n) => n.type === "warehouse.column").map((n) => n.id));
        const visibleEdges = data.edges.filter((e) => !columnIds.has(e.source) && !columnIds.has(e.target)).length;
        setStats({ nodes: visibleNodes, edges: visibleEdges, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setStats({ nodes: 0, edges: 0, loading: false, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }
    loadStats();
    return () => { cancelled = true; };
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
