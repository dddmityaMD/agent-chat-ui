/**
 * LineageGraph - Main React Flow wrapper for lineage visualization.
 *
 * Renders the knowledge graph as a DAG with custom node types,
 * animated directional edges, and automatic dagre layout (left-to-right).
 *
 * Usage:
 *   <LineageGraph />                          // full environment graph
 *   <LineageGraph rootNodeId="uuid-here" />   // subgraph from root
 *   <LineageGraph direction="upstream" />      // upstream only
 */
"use client";

import React from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import type { NodeTypes, EdgeTypes, Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { TableNode } from "./nodes/TableNode";
import { CardNode } from "./nodes/CardNode";
import { DbtModelNode } from "./nodes/DbtModelNode";
import { ColumnNode } from "./nodes/ColumnNode";
import { KpiNode } from "./nodes/KpiNode";
import { AnimatedEdge } from "./edges/AnimatedEdge";
import { useLineageData } from "./hooks/useLineageData";
import { useLineageLayout } from "./hooks/useLineageLayout";

// -------------------------------------------------------------------
// Node and edge type registries (MUST be defined outside component)
// -------------------------------------------------------------------

const nodeTypes: NodeTypes = {
  tableNode: TableNode,
  cardNode: CardNode,
  dbtModelNode: DbtModelNode,
  columnNode: ColumnNode,
  kpiNode: KpiNode,
};

const edgeTypes: EdgeTypes = {
  animatedEdge: AnimatedEdge,
};

// -------------------------------------------------------------------
// Props
// -------------------------------------------------------------------

interface LineageGraphProps {
  /** Root node UUID for subgraph traversal. Omit for full graph. */
  rootNodeId?: string;
  /** Traversal direction: upstream, downstream, or both. */
  direction?: "upstream" | "downstream" | "both";
  /** Whether to show the minimap. */
  showMiniMap?: boolean;
  /** CSS class for the container div. */
  className?: string;
}

// -------------------------------------------------------------------
// Inner component (needs ReactFlowProvider context)
// -------------------------------------------------------------------

function LineageGraphInner({
  rootNodeId,
  direction = "both",
  showMiniMap = true,
  className,
}: LineageGraphProps) {
  const { nodes: rawNodes, edges: rawEdges, loading, error } = useLineageData(
    rootNodeId,
    direction,
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(rawNodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  // Sync fetched data into React Flow state
  React.useEffect(() => {
    setNodes(rawNodes as Node[]);
    setEdges(rawEdges);
  }, [rawNodes, rawEdges, setNodes, setEdges]);

  // Apply dagre layout after nodes are measured
  useLineageLayout(nodes, edges);

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
    <div className={`h-full w-full ${className ?? ""}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls />
        {showMiniMap && (
          <MiniMap
            nodeStrokeWidth={2}
            zoomable
            pannable
            className="!bottom-2 !right-2"
          />
        )}
      </ReactFlow>
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
