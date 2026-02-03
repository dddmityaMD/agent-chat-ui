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

// -- Helpers --------------------------------------------------------------

function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_CASES_API_URL;
  return (envUrl || "http://localhost:8000").replace(/\/$/, "");
}

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
