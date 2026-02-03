/**
 * LineageGraph - Main React Flow wrapper for lineage visualization.
 *
 * Renders the knowledge graph as a DAG with custom node types,
 * animated directional edges, and automatic dagre layout (left-to-right).
 *
 * Features:
 * - Click a node to open a detail panel (right-side slide-in)
 * - Double-click a node to navigate to its source system
 * - Minimap auto-shows for large graphs or when zoomed out
 * - Layer toggle for architecture zone backgrounds
 * - Direction toggle for upstream/downstream filtering
 *
 * Usage:
 *   <LineageGraph />                          // full environment graph
 *   <LineageGraph rootNodeId="uuid-here" />   // subgraph from root
 */
"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import type {
  NodeTypes,
  EdgeTypes,
  Node,
  Edge,
  NodeMouseHandler,
  Viewport,
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
import { fetchImpactAnalysis } from "@/lib/lineage-api";
import type { LineageNodePayload } from "./utils/graph-transform";
import { applyImpactStyling } from "./utils/graph-transform";
import type { Direction } from "./controls/DirectionToggle";
import {
  classifyLayer,
  LAYER_COLORS,
  type ArchitectureLayer,
} from "./utils/layer-classifier";

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

/** Node count threshold for auto-showing the minimap. */
const MINIMAP_NODE_THRESHOLD = 15;

/** Zoom level below which the minimap auto-shows. */
const MINIMAP_ZOOM_THRESHOLD = 0.5;

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
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

/**
 * Build a source system URL for double-click navigation.
 * Returns null if no external system is available for this node type.
 */
function buildSourceUrl(node: LineageNodeData): string | null {
  switch (node.type) {
    case "metabase.card": {
      const base =
        process.env.NEXT_PUBLIC_METABASE_URL || "http://localhost:3001";
      const match = node.id.match(/(\d+)$/);
      const cardId = match ? match[1] : node.id;
      return `${base}/question/${cardId}`;
    }
    case "dbt.model":
    case "dbt.source": {
      const dbtBase = process.env.NEXT_PUBLIC_DBT_DOCS_URL;
      if (!dbtBase) return null;
      const uniqueId = (node.props?.unique_id as string) ?? node.id;
      return `${dbtBase}/#!/model/${uniqueId}`;
    }
    // warehouse.table, warehouse.column, metric.kpi have no external system
    default:
      return null;
  }
}

/**
 * Convert a React Flow node to LineageNodeData for the detail panel.
 */
function toLineageNodeData(rfNode: Node): LineageNodeData {
  const payload = rfNode.data as unknown as LineageNodePayload;
  return {
    id: rfNode.id,
    type: payload.backendType,
    label: payload.label,
    props: payload.props,
    canonical_key: payload.canonicalKey,
  };
}

/**
 * Build group nodes for architecture layers when layers are enabled.
 * Computes bounding boxes around nodes in each layer.
 */
function buildLayerGroupNodes(
  nodes: Node[],
): { groupNodes: Node[]; updatedNodes: Node[] } {
  // Classify each node into a layer
  const layerMap = new Map<ArchitectureLayer, Node[]>();

  for (const node of nodes) {
    // Skip existing group nodes
    if (node.type === "groupNode") continue;

    const payload = node.data as unknown as LineageNodePayload;
    const fakeNodeData: LineageNodeData = {
      id: node.id,
      type: payload.backendType,
      label: payload.label,
      props: payload.props,
      canonical_key: payload.canonicalKey,
    };

    const layer = classifyLayer(fakeNodeData);
    const existing = layerMap.get(layer) ?? [];
    existing.push(node);
    layerMap.set(layer, existing);
  }

  const groupNodes: Node[] = [];
  const updatedNodes: Node[] = [];
  const padding = 40;

  for (const [layer, layerNodes] of layerMap.entries()) {
    if (layerNodes.length === 0) continue;

    const groupId = `group-${layer}`;
    const colors = LAYER_COLORS[layer];

    // Compute bounding box of all nodes in this layer
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of layerNodes) {
      const w = n.measured?.width ?? 180;
      const h = n.measured?.height ?? 60;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }

    const groupNode: Node = {
      id: groupId,
      type: "groupNode",
      position: { x: minX - padding, y: minY - padding - 24 },
      data: {
        label: colors.label,
        layer,
        bg: colors.bg,
        border: colors.border,
      },
      style: {
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2 + 24,
      },
    };

    groupNodes.push(groupNode);

    // Update child nodes to be relative to the group
    for (const n of layerNodes) {
      updatedNodes.push({
        ...n,
        parentId: groupId,
        extent: "parent" as const,
        position: {
          x: n.position.x - (minX - padding),
          y: n.position.y - (minY - padding - 24),
        },
      });
    }
  }

  return { groupNodes, updatedNodes };
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
}: LineageGraphProps) {
  // State: direction, selected node, minimap, layers
  const [direction, setDirection] = useState<Direction>("both");
  const [selectedNode, setSelectedNode] = useState<LineageNodeData | null>(null);
  const [showMinimap, setShowMinimap] = useState(false);
  const [layersEnabled, setLayersEnabled] = useState(false);

  // Impact analysis state
  const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [dimUnaffected, setDimUnaffected] = useState(true);
  const [hideUnaffected, setHideUnaffected] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

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

  // Auto-show minimap for large graphs
  React.useEffect(() => {
    if (nodes.length > MINIMAP_NODE_THRESHOLD) {
      setShowMinimap(true);
    }
  }, [nodes.length]);

  // Build layer groups when enabled
  React.useEffect(() => {
    if (!layersEnabled) {
      // Remove group nodes and reset parentId
      setNodes((current) =>
        current
          .filter((n) => n.type !== "groupNode")
          .map((n) => {
            if (n.parentId?.startsWith("group-")) {
              const { parentId, extent, ...rest } = n;
              // Suppress unused variable lint -- parentId and extent are
              // intentionally destructured to exclude them from the rest.
              void parentId;
              void extent;
              return rest as Node;
            }
            return n;
          }),
      );
      return;
    }

    // When layers are enabled, compute group nodes
    setNodes((current) => {
      const nonGroupNodes = current.filter((n) => n.type !== "groupNode");
      if (nonGroupNodes.length === 0) return current;

      const { groupNodes, updatedNodes } = buildLayerGroupNodes(nonGroupNodes);
      // Group nodes must come first (React Flow renders groups before children)
      return [...groupNodes, ...updatedNodes];
    });
  }, [layersEnabled, setNodes]);

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

  /** Auto-show minimap when zoomed out below threshold. */
  const onViewportChange = useCallback((viewport: Viewport) => {
    if (viewport.zoom < MINIMAP_ZOOM_THRESHOLD) {
      setShowMinimap(true);
    }
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

  if (nodes.length === 0) {
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
        onViewportChange={onViewportChange}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls />
        {showMinimap && (
          <MiniMap
            nodeStrokeWidth={2}
            zoomable
            pannable
            className="!bottom-2 !right-2"
          />
        )}
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
// Exported component (wraps with ReactFlowProvider)
// -------------------------------------------------------------------

export default function LineageGraph(props: LineageGraphProps) {
  return (
    <ReactFlowProvider>
      <LineageGraphInner {...props} />
    </ReactFlowProvider>
  );
}
