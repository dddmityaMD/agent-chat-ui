/**
 * LineageGraphInner.tsx — Core graph implementation.
 *
 * Renders nodes, edges, handles layout, zoom, pan.
 * Must be rendered inside a ReactFlowProvider.
 */

"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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
import { fetchImpactAnalysis } from "@/lib/lineage-api";
import type { LineageNodePayload } from "./utils/graph-transform";
import { applyImpactStyling } from "./utils/graph-transform";
import type { Direction } from "./controls/DirectionToggle";
import { computeLayerMap } from "./utils/layer-classifier";
import { Maximize2, Minimize2 } from "lucide-react";

import { toLineageNodeData, buildSourceUrl, buildLayerOverlayNodes } from "./lineage-helpers";
import { NodeContextMenu, type ContextMenuState } from "./NodeContextMenu";

// Node and edge type registries (MUST be defined outside component)
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

/** Default zoom level */
const DEFAULT_ZOOM = 1;

export interface LineageGraphInnerProps {
  /** Root node UUID for subgraph traversal. Omit for full graph. */
  rootNodeId?: string;
  /** CSS class for the container div. */
  className?: string;
  /** Optional: auto-trigger impact analysis for this node. */
  impactNodeId?: string;
  /** Whether the graph is in fullscreen mode (controlled by parent). */
  isFullscreen?: boolean;
  /** Callback to toggle fullscreen. */
  onToggleFullscreen?: () => void;
  /** Canonical keys to filter the graph to. */
  filterEntities?: string[];
}

export function LineageGraphInner({
  rootNodeId,
  className,
  impactNodeId,
  isFullscreen,
  onToggleFullscreen,
  filterEntities,
}: LineageGraphInnerProps) {
  // State: direction, selected node, layers
  const [direction, setDirection] = useState<Direction>("both");
  const [selectedNode, setSelectedNode] = useState<LineageNodeData | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [layersEnabled, setLayersEnabled] = useState(false);

  // Impact analysis state
  const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [dimUnaffected, setDimUnaffected] = useState(true);
  const [hideUnaffected, setHideUnaffected] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const { setViewport, fitView } = useReactFlow();

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
  React.useEffect(() => {
    if (!layersEnabled) {
      setNodes((current) => current.filter((n) => n.type !== "groupNode"));
      return;
    }

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

  // -- Client-side direction filtering
  React.useEffect(() => {
    if (!selectedNode) {
      setNodes((current) =>
        current.map((n) => (n.type === "groupNode" ? n : { ...n, hidden: false })),
      );
      setEdges((current) =>
        current.map((e) => ({ ...e, hidden: false })),
      );
      return;
    }

    if (direction === "both") {
      const reachable = new Set<string>();
      const queue: string[] = [selectedNode.id];
      reachable.add(selectedNode.id);

      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const e of rawEdges) {
          if (e.source === current && !reachable.has(e.target)) {
            reachable.add(e.target);
            queue.push(e.target);
          }
          if (e.target === current && !reachable.has(e.source)) {
            reachable.add(e.source);
            queue.push(e.source);
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
      return;
    }

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

  // -- External entity filter
  React.useEffect(() => {
    if (!filterEntities || filterEntities.length === 0) return;
    if (selectedNode) return;

    const canonicalSet = new Set(filterEntities);
    const matchedIds: string[] = [];
    for (const node of rawNodes) {
      if (node.type === "groupNode") continue;
      const payload = node.data as unknown as LineageNodePayload;
      if (payload.canonicalKey && canonicalSet.has(payload.canonicalKey)) {
        matchedIds.push(node.id);
      }
    }

    if (matchedIds.length === 0) return;

    const reachable = new Set<string>(matchedIds);
    const queue = [...matchedIds];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const e of rawEdges) {
        if (e.source === current && !reachable.has(e.target)) {
          reachable.add(e.target);
          queue.push(e.target);
        }
        if (e.target === current && !reachable.has(e.source)) {
          reachable.add(e.source);
          queue.push(e.source);
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

    const tid = setTimeout(() => {
      fitView({ duration: 300, padding: 0.15, includeHiddenNodes: false });
    }, 150);
    return () => clearTimeout(tid);
  }, [filterEntities, selectedNode, rawNodes, rawEdges, setNodes, setEdges, fitView]);

  // -- Event handlers

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, rfNode) => {
      const nodeData = toLineageNodeData(rfNode);
      setSelectedNode(nodeData);
      setPanelOpen(true);
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
    setPanelOpen(false);
  }, []);

  // -- Impact analysis handlers

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

  const clearImpact = useCallback(() => {
    setImpactResult(null);
    setContextMenu(null);
  }, []);

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, rfNode) => {
      event.preventDefault();
      const payload = rfNode.data as unknown as LineageNodePayload;
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

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  // -- Apply impact styling to nodes

  React.useEffect(() => {
    if (!impactResult) {
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

  // -- Auto-trigger impact analysis from prop

  React.useEffect(() => {
    if (impactNodeId && !impactLoading && nodes.length > 0) {
      triggerImpactAnalysis(impactNodeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impactNodeId]);

  // -- Loading / error / empty states

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
        <NodeDetailPanel
          selectedNode={panelOpen ? selectedNode : null}
          onClose={onClosePanel}
        />
      )}
    </div>
  );
}
