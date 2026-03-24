/**
 * Panel Block Constants (Phase 49-01)
 *
 * Static mappings for tool-to-block routing and chat one-liner templates.
 * These are the two per-tool mappings from D-13 and D-18.
 */

import type { SALevel } from "./types";

// ---------------------------------------------------------------------------
// SA level rendering order
// ---------------------------------------------------------------------------

/** Panel renders blocks in this order: action first, then l1, l2, l3 */
export const SA_LEVEL_ORDER: SALevel[] = ["action", "l1", "l2", "l3"];

// ---------------------------------------------------------------------------
// Tool -> Block routing (D-18)
// ---------------------------------------------------------------------------

/**
 * Maps tool names to which panel block they update.
 * Used by the frontend to route tool_result SSE events to the correct block.
 * Explicit block_update in tool return takes priority over this map.
 */
export const TOOL_BLOCK_MAP = {
  resolve_entity: { blockId: "entity-map", level: "l2" },
  confirm_entity: { blockId: "entity-map", level: "l2" },
  describe_columns: { blockId: "data-profile", level: "l2" },
  profile_columns: { blockId: "data-profile", level: "l2" },
  detect_relationships: { blockId: "relationships", level: "l2" },
  detect_temporal_grain: { blockId: "data-profile", level: "l2" },
  postgres_query: { blockId: "evidence-collection", level: "l2" },
  metabase_query: { blockId: "evidence-collection", level: "l2" },
  dbt_query: { blockId: "evidence-collection", level: "l2" },
  trace_lineage: { blockId: "evidence-collection", level: "l2" },
  query_metadata: { blockId: "evidence-collection", level: "l2" },
  inspect_data_quality: { blockId: "evidence-collection", level: "l2" },
  submit_plan: { blockId: "plan-approval", level: "action" },
  write_file: { blockId: "artifact-list", level: "l3" },
  submit_findings: { blockId: "findings", level: "l3" },
  build_dashboard: { blockId: "bi-dashboard-metadata", level: "l3" },
} as const satisfies Record<string, { blockId: string; level: SALevel }>;

// ---------------------------------------------------------------------------
// Chat one-liner derivation
// ---------------------------------------------------------------------------

/**
 * Derive a one-liner summary from tool result content.
 * Extracts the first meaningful line, truncated to maxLen chars.
 */
export function deriveOneLiner(
  content: string | unknown,
  maxLen = 120,
): string | null {
  const str = typeof content === "string" ? content : null;
  if (!str || str.trim().length === 0) return null;

  // Try to parse as JSON and extract a meaningful field
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      // Look for common summary fields
      const summaryField = parsed.summary ?? parsed.message ?? parsed.result ?? parsed.status;
      if (typeof summaryField === "string" && summaryField.length > 0) {
        return summaryField.length > maxLen
          ? summaryField.slice(0, maxLen) + "..."
          : summaryField;
      }
    }
  } catch {
    // Not JSON — use first line
  }

  const firstLine = str.split("\n")[0].trim();
  if (firstLine.length === 0) return null;
  return firstLine.length > maxLen
    ? firstLine.slice(0, maxLen) + "..."
    : firstLine;
}
