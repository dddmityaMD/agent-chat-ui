/**
 * Transform backend lineage data to React Flow nodes and edges.
 *
 * Maps backend node types to React Flow custom node type identifiers
 * and backend edges to animated React Flow edges.
 */
import type { Node, Edge } from "@xyflow/react";
import type { LineageGraphResponse, ImpactResult, RiskLevel } from "@/lib/lineage-api";

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

// -- Impact styling -----------------------------------------------------------

/**
 * Border color classes by risk level for impact visualization.
 */
const RISK_BORDER_COLOR: Record<RiskLevel, string> = {
  critical: "#ef4444", // red-500
  high: "#f97316",     // orange-500
  medium: "#eab308",   // yellow-500
  low: "#60a5fa",      // blue-400
};

/**
 * Apply impact analysis styling to React Flow nodes.
 *
 * Impacted nodes get a colored border based on their risk level.
 * Non-impacted nodes get reduced opacity when focus mode is active.
 *
 * @param nodes - Current React Flow nodes.
 * @param impactResult - Impact analysis result from backend.
 * @param dimUnaffected - Whether to dim non-impacted nodes (opacity 0.3).
 * @param hideUnaffected - Whether to hide non-impacted nodes entirely.
 */
export function applyImpactStyling(
  nodes: Node<LineageNodePayload>[],
  impactResult: ImpactResult | null,
  dimUnaffected: boolean = true,
  hideUnaffected: boolean = false,
): Node<LineageNodePayload>[] {
  if (!impactResult) {
    // Clear all impact styling
    return nodes.map((node) => ({
      ...node,
      hidden: false,
      style: { ...node.style, opacity: 1, borderColor: undefined, borderWidth: undefined },
      data: { ...node.data, impactRiskLevel: undefined },
    }));
  }

  const impactedIds = new Set(impactResult.impacted_nodes.map((n) => n.node_id));
  const riskByNodeId = new Map(
    impactResult.impacted_nodes.map((n) => [n.node_id, n.risk_level]),
  );

  // Root node is always visible
  impactedIds.add(impactResult.root_node_id);

  return nodes.map((node) => {
    const isImpacted = impactedIds.has(node.id);
    const riskLevel = riskByNodeId.get(node.id);
    const isRoot = node.id === impactResult.root_node_id;

    if (isRoot) {
      return {
        ...node,
        hidden: false,
        style: {
          ...node.style,
          opacity: 1,
          borderColor: "#ef4444",
          borderWidth: 3,
          borderStyle: "solid" as const,
          borderRadius: 8,
        },
        data: { ...node.data, impactRiskLevel: "root" as const },
      };
    }

    if (isImpacted && riskLevel) {
      return {
        ...node,
        hidden: false,
        style: {
          ...node.style,
          opacity: 1,
          borderColor: RISK_BORDER_COLOR[riskLevel],
          borderWidth: 2,
          borderStyle: "solid" as const,
          borderRadius: 8,
        },
        data: { ...node.data, impactRiskLevel: riskLevel },
      };
    }

    // Non-impacted node
    return {
      ...node,
      hidden: hideUnaffected,
      style: {
        ...node.style,
        opacity: dimUnaffected ? 0.3 : 1,
        borderColor: undefined,
        borderWidth: undefined,
      },
      data: { ...node.data, impactRiskLevel: undefined },
    };
  });
}
