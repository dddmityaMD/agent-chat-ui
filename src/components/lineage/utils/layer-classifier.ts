/**
 * Layer classifier - Classifies lineage nodes into architecture layers.
 *
 * Layers: sources -> staging -> marts -> consumption
 * Used for visual grouping in the lineage graph.
 */
import type { LineageNodeData } from "@/lib/lineage-api";

// -- Types ------------------------------------------------------------------

export type ArchitectureLayer = "sources" | "staging" | "marts" | "consumption";

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
 *   - dbt.source, warehouse.table -> "sources"
 *   - dbt.model with "staging" or "stg_" in name/schema -> "staging"
 *   - dbt.model with "marts" or "int_" in name/schema -> "marts"
 *   - metabase.card, metric.kpi -> "consumption"
 *   - Default: "marts" for unclassified dbt.model, "sources" for warehouse.table
 */
export function classifyLayer(node: LineageNodeData): ArchitectureLayer {
  const { type, label, props } = node;
  const schema = (props?.schema as string) ?? "";
  const combined = `${label} ${schema}`.toLowerCase();

  switch (type) {
    case "dbt.source":
      return "sources";

    case "warehouse.table":
    case "warehouse.column":
      return "sources";

    case "dbt.model": {
      if (combined.includes("staging") || combined.includes("stg_")) {
        return "staging";
      }
      if (combined.includes("marts") || combined.includes("int_")) {
        return "marts";
      }
      // Default for unclassified dbt models
      return "marts";
    }

    case "metabase.card":
    case "metric.kpi":
      return "consumption";

    default:
      return "sources";
  }
}
