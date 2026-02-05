/**
 * Layer classifier - Classifies lineage nodes into architecture layers.
 *
 * Layers: sources -> staging -> marts -> consumption
 * Used for visual grouping in the lineage graph.
 */
import type { Node, Edge } from "@xyflow/react";
import type { LineageNodeData } from "@/lib/lineage-api";
import type { LineageNodePayload } from "./graph-transform";

// -- Types ------------------------------------------------------------------

export type ArchitectureLayer = "sources" | "staging" | "marts" | "consumption";

/** Ordered list of layers from left to right. */
export const LAYER_ORDER: ArchitectureLayer[] = [
  "sources",
  "staging",
  "marts",
  "consumption",
];

// -- Colors -----------------------------------------------------------------

export const LAYER_COLORS: Record<
  ArchitectureLayer,
  { bg: string; border: string; label: string }
> = {
  sources: { bg: "#eff6ff", border: "#bfdbfe", label: "Sources" },
  staging: { bg: "#fffbeb", border: "#fde68a", label: "Staging" },
  marts: { bg: "#f0fdf4", border: "#bbf7d0", label: "Marts" },
  consumption: { bg: "#faf5ff", border: "#e9d5ff", label: "Consumption" },
};

// -- Classifier -------------------------------------------------------------

/**
 * Classify a lineage node into one of four architecture layers.
 *
 * Rules:
 *   - dbt.source -> "sources"
 *   - warehouse.table/column with stg_ prefix -> "staging"
 *   - warehouse.table/column with int_ prefix -> "marts"
 *   - warehouse.table/column (default) -> "sources"
 *   - dbt.model with "staging" or "stg_" in name/schema -> "staging"
 *   - dbt.model with "marts" or "int_" in name/schema -> "marts"
 *   - metabase.card, metabase.dashboard, metric.kpi -> "consumption"
 *   - Default: "marts" for unclassified dbt.model, "sources" otherwise
 */
export function classifyLayer(node: LineageNodeData): ArchitectureLayer {
  const { type, label, props } = node;
  const schema = (props?.schema as string) ?? "";
  const combined = `${label} ${schema}`.toLowerCase();

  switch (type) {
    case "dbt.source":
      return "sources";

    case "warehouse.table":
    case "warehouse.column": {
      const name = label.toLowerCase();
      if (name.startsWith("stg_") || combined.includes("staging")) {
        return "staging";
      }
      if (name.startsWith("int_") || combined.includes("marts")) {
        return "marts";
      }
      return "sources";
    }

    case "dbt.model": {
      if (combined.includes("staging") || combined.includes("stg_")) {
        return "staging";
      }
      if (combined.includes("marts") || combined.includes("int_")) {
        return "marts";
      }
      return "marts";
    }

    case "metabase.card":
    case "metabase.dashboard":
    case "metric.kpi":
      return "consumption";

    default:
      return "sources";
  }
}

// -- Graph-aware classification -----------------------------------------------

/**
 * Classify all nodes using both type/name heuristics AND edge information.
 *
 * After the initial per-node classification, tables that receive an incoming
 * edge from a dbt model are promoted to the same layer as that model (they
 * are materialised outputs, not raw sources).
 *
 * @returns Map from node id to its architecture layer.
 */
export function computeLayerMap(
  nodes: Node[],
  edges: Edge[],
): Map<string, ArchitectureLayer> {
  const result = new Map<string, ArchitectureLayer>();
  const backendTypeById = new Map<string, string>();

  // First pass: classify by type and name
  for (const node of nodes) {
    if (node.type === "groupNode") continue;
    const payload = node.data as unknown as LineageNodePayload;
    backendTypeById.set(node.id, payload.backendType);

    const data: LineageNodeData = {
      id: node.id,
      type: payload.backendType,
      label: payload.label,
      props: payload.props,
      canonical_key: payload.canonicalKey,
    };
    result.set(node.id, classifyLayer(data));
  }

  // Second pass: promote warehouse tables that receive edges from dbt models.
  // In the visual (already-reversed) graph, dbt_model → output_table means
  // the model materialises into that table.
  for (const edge of edges) {
    const srcType = backendTypeById.get(edge.source);
    const tgtType = backendTypeById.get(edge.target);

    // dbt model → warehouse table  (model materialises table)
    if (
      srcType === "dbt.model" &&
      (tgtType === "warehouse.table" || tgtType === "warehouse.column")
    ) {
      const dbtLayer = result.get(edge.source);
      if (dbtLayer && dbtLayer !== "sources") {
        result.set(edge.target, dbtLayer);
      }
    }
  }

  return result;
}
