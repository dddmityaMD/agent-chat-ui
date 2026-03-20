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
  postgres_query: { blockId: "evidence-collection", level: "l2" },
  metabase_query: { blockId: "evidence-collection", level: "l2" },
  dbt_query: { blockId: "evidence-collection", level: "l2" },
  trace_lineage: { blockId: "evidence-collection", level: "l2" },
  submit_plan: { blockId: "plan-approval", level: "action" },
  write_file: { blockId: "artifact-list", level: "l3" },
  submit_findings: { blockId: "findings", level: "l3" },
  build_dashboard: { blockId: "bi-dashboard-metadata", level: "l3" },
} as const satisfies Record<string, { blockId: string; level: SALevel }>;

// ---------------------------------------------------------------------------
// Chat one-liner templates (D-13)
// ---------------------------------------------------------------------------

/**
 * Maps tool names to human-readable one-liner templates for chat display.
 * Placeholders in {braces} are filled from tool result data.
 */
export const TOOL_CHAT_TEMPLATE = {
  resolve_entity: "Found {name} ({type}), confidence {score}",
  describe_columns: "{table}: {col_count} columns, {null_pct}% avg nulls",
  postgres_query: "Query returned {row_count} rows",
  metabase_query: "Fetched {item_count} items from Metabase",
  dbt_query: "Found {model_count} dbt models",
  trace_lineage: "Traced lineage: {hop_count} hops",
  submit_plan: "Plan proposed: {step_count} steps -> see panel",
  write_file: "Created {path} ({line_count} lines)",
  submit_findings: "Findings ready -> see panel",
  build_dashboard: "Dashboard created: {dashboard_name}",
} as const;
