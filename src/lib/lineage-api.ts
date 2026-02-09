/**
 * Lineage API client for fetching graph data from the backend.
 *
 * Uses the same base URL pattern as dashboard-card-links.ts
 * (NEXT_PUBLIC_CASES_API_URL or http://localhost:8000).
 */

// -- Types ----------------------------------------------------------------

export interface LineageNodeData {
  id: string;
  type: string;
  label: string;
  props: Record<string, unknown>;
  canonical_key: string | null;
}

export interface LineageEdgeData {
  id: string;
  source: string;
  target: string;
  type: string;
  props: Record<string, unknown>;
}

export interface LineageGraphResponse {
  nodes: LineageNodeData[];
  edges: LineageEdgeData[];
  total_nodes: number;
  total_edges: number;
}

export interface LineageNodeListItem {
  id: string;
  type: string;
  label: string;
  canonical_key: string | null;
}

export interface LineageNodeListResponse {
  nodes: LineageNodeListItem[];
  total: number;
}

// -- Impact analysis types ---------------------------------------------------

export type RiskLevel = "critical" | "high" | "medium" | "low";

export interface ImpactedNode {
  node_id: string;
  type: string;
  label: string;
  canonical_key: string | null;
  depth: number;
  risk_level: RiskLevel;
  risk_reason: string;
  path: string[];
}

export interface ImpactResult {
  root_node_id: string;
  root_label: string;
  impacted_nodes: ImpactedNode[];
  total_affected: number;
  by_risk: Record<string, number>;
  max_depth: number;
}

// -- Helpers --------------------------------------------------------------

import { getApiBaseUrl } from "@/lib/api-url";

const getBaseUrl = getApiBaseUrl;

// -- API calls ------------------------------------------------------------

/**
 * Fetch the lineage graph, optionally centered on a specific node.
 *
 * @param nodeId  - Root node UUID for subgraph traversal. Omit for full graph.
 * @param direction - "upstream", "downstream", or "both" (default "both").
 * @param maxDepth  - Maximum traversal depth (default 5).
 */
export async function fetchLineageGraph(
  nodeId?: string,
  direction?: string,
  maxDepth?: number,
): Promise<LineageGraphResponse> {
  const baseUrl = getBaseUrl();

  let url: string;
  if (nodeId) {
    const params = new URLSearchParams();
    if (direction) params.set("direction", direction);
    if (maxDepth != null) params.set("max_depth", String(maxDepth));
    const qs = params.toString();
    url = `${baseUrl}/api/lineage/graph/${nodeId}${qs ? `?${qs}` : ""}`;
  } else {
    url = `${baseUrl}/api/lineage/graph`;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Lineage API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<LineageGraphResponse>;
}

/**
 * Fetch a list of lineage nodes with optional type filtering.
 */
export async function fetchLineageNodes(
  type?: string,
  limit?: number,
): Promise<LineageNodeListResponse> {
  const baseUrl = getBaseUrl();
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (limit != null) params.set("limit", String(limit));
  const qs = params.toString();

  const url = `${baseUrl}/api/lineage/nodes${qs ? `?${qs}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Lineage nodes API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<LineageNodeListResponse>;
}

/**
 * Run impact analysis for a node — trace downstream dependencies with risk scoring.
 *
 * @param nodeId   - UUID of the root node to analyze.
 * @param maxDepth - Maximum traversal depth (default 10).
 */
export async function fetchImpactAnalysis(
  nodeId: string,
  maxDepth?: number,
): Promise<ImpactResult> {
  const baseUrl = getBaseUrl();
  const params = new URLSearchParams();
  if (maxDepth != null) params.set("max_depth", String(maxDepth));
  const qs = params.toString();

  const url = `${baseUrl}/api/lineage/impact/${nodeId}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Impact analysis API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<ImpactResult>;
}
