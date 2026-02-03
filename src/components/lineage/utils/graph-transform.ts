/**
 * Transform backend lineage data to React Flow nodes and edges.
 *
 * Maps backend node types to React Flow custom node type identifiers
 * and backend edges to animated React Flow edges.
 */
import type { Node, Edge } from "@xyflow/react";
import type { LineageGraphResponse } from "@/lib/lineage-api";

// -- Node type mapping ----------------------------------------------------

const NODE_TYPE_MAP: Record<string, string> = {
  "metabase.card": "cardNode",
  "warehouse.table": "tableNode",
  "warehouse.column": "columnNode",
  "dbt.model": "dbtModelNode",
  "dbt.source": "dbtModelNode",
  "metric.kpi": "kpiNode",
};

function resolveNodeType(backendType: string): string {
  return NODE_TYPE_MAP[backendType] ?? "tableNode";
}

// -- Transform ------------------------------------------------------------

export interface LineageNodePayload {
  label: string;
  backendType: string;
  canonicalKey: string | null;
  props: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Convert backend lineage graph response to React Flow nodes and edges.
 *
 * Nodes are created without positions -- the dagre layout hook positions
 * them after initial render and measurement.
 */
export function transformToReactFlow(data: LineageGraphResponse): {
  nodes: Node<LineageNodePayload>[];
  edges: Edge[];
} {
  const nodes: Node<LineageNodePayload>[] = data.nodes.map((n) => ({
    id: n.id,
    type: resolveNodeType(n.type),
    position: { x: 0, y: 0 }, // dagre layout fills these in
    data: {
      label: n.label,
      backendType: n.type,
      canonicalKey: n.canonical_key,
      props: n.props,
    },
  }));

  const edges: Edge[] = data.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "animatedEdge",
    data: {
      edgeType: e.type,
      props: e.props,
    },
  }));

  return { nodes, edges };
}
