/**
 * lineage-helpers.ts — Pure utility functions for the lineage graph.
 * No JSX, no React — just data transformation and URL building.
 */

import type { Node } from "@xyflow/react";
import type { LineageNodeData } from "@/lib/lineage-api";
import type { LineageNodePayload } from "./utils/graph-transform";
import {
  LAYER_COLORS,
  LAYER_ORDER,
  type ArchitectureLayer,
} from "./utils/layer-classifier";

/** Slugify a name for Metabase URL (e.g. "E-Commerce Insights" -> "e-commerce-insights"). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Extract the numeric Metabase ID from a canonical key like "metabase:card:5". */
function extractMetabaseId(
  canonicalKey: string | null | undefined,
): string | null {
  if (!canonicalKey) return null;
  const parts = canonicalKey.split(":");
  if (parts.length >= 3 && parts[0] === "metabase") return parts[2];
  return null;
}

/**
 * Build a source system URL for double-click navigation.
 * Returns null if no external system is available for this node type.
 */
export function buildSourceUrl(node: LineageNodeData): string | null {
  const metabaseBase =
    process.env.NEXT_PUBLIC_METABASE_URL || "http://localhost:3001";

  switch (node.type) {
    case "metabase.card": {
      const numId = extractMetabaseId(node.canonical_key);
      if (!numId) return null;
      const name = node.props?.name as string | undefined;
      const slug = name ? `${numId}-${slugify(name)}` : numId;
      return `${metabaseBase}/question/${slug}`;
    }
    case "metabase.dashboard": {
      const numId = extractMetabaseId(node.canonical_key);
      if (!numId) return null;
      const name = node.props?.name as string | undefined;
      const slug = name ? `${numId}-${slugify(name)}` : numId;
      return `${metabaseBase}/dashboard/${slug}`;
    }
    case "dbt.model":
    case "dbt.source": {
      const dbtBase = process.env.NEXT_PUBLIC_DBT_DOCS_URL;
      if (!dbtBase) return null;
      const uniqueId = (node.props?.unique_id as string) ?? node.id;
      return `${dbtBase}/#!/model/${uniqueId}`;
    }
    default:
      return null;
  }
}

/**
 * Convert a React Flow node to LineageNodeData for the detail panel.
 * Passes embedded columns through via a _columns prop key.
 */
export function toLineageNodeData(rfNode: Node): LineageNodeData {
  const payload = rfNode.data as unknown as LineageNodePayload;
  return {
    id: rfNode.id,
    type: payload.backendType,
    label: payload.label,
    props: {
      ...payload.props,
      ...(payload.columns ? { _columns: payload.columns } : {}),
    },
    canonical_key: payload.canonicalKey,
  };
}

/**
 * Build non-overlapping vertical stripe overlays for architecture layers.
 *
 * Computes full-height vertical stripes based on actual node bounds (min/max x)
 * so that every node sits comfortably inside its layer stripe with padding.
 * Boundaries between adjacent stripes are placed at the midpoint of the gap
 * between the two layers' node extents.
 */
export function buildLayerOverlayNodes(
  nodes: Node[],
  nodeLayerMap: Map<string, ArchitectureLayer>,
): Node[] {
  // Group nodes by layer
  const layerNodesMap = new Map<ArchitectureLayer, Node[]>();
  let globalMinY = Infinity;
  let globalMaxY = -Infinity;

  for (const node of nodes) {
    if (node.type === "groupNode") continue;
    const layer = nodeLayerMap.get(node.id);
    if (!layer) continue;

    const h = node.measured?.height ?? 60;
    globalMinY = Math.min(globalMinY, node.position.y);
    globalMaxY = Math.max(globalMaxY, node.position.y + h);

    const arr = layerNodesMap.get(layer) ?? [];
    arr.push(node);
    layerNodesMap.set(layer, arr);
  }

  if (globalMinY === Infinity) return [];

  const padding = 40;

  interface LayerInfo {
    layer: ArchitectureLayer;
    minX: number;
    maxX: number;
    medianX: number;
  }

  const layerInfos: LayerInfo[] = [];
  for (const layer of LAYER_ORDER) {
    const lNodes = layerNodesMap.get(layer);
    if (!lNodes || lNodes.length === 0) continue;

    let minX = Infinity;
    let maxX = -Infinity;
    const centers: number[] = [];
    for (const n of lNodes) {
      const w = n.measured?.width ?? 180;
      minX = Math.min(minX, n.position.x);
      maxX = Math.max(maxX, n.position.x + w);
      centers.push(n.position.x + w / 2);
    }
    centers.sort((a, b) => a - b);
    layerInfos.push({
      layer,
      minX,
      maxX,
      medianX: centers[Math.floor(centers.length / 2)],
    });
  }

  layerInfos.sort((a, b) => a.medianX - b.medianX);

  const overlayNodes: Node[] = [];
  const gap = 10;

  for (let i = 0; i < layerInfos.length; i++) {
    const info = layerInfos[i];
    const colors = LAYER_COLORS[info.layer];

    let left: number;
    let right: number;

    if (i === 0) {
      left = info.minX - padding;
    } else {
      const prevMax = layerInfos[i - 1].maxX;
      const currMin = info.minX;
      left = (prevMax + currMin) / 2 + gap / 2;
    }

    if (i === layerInfos.length - 1) {
      right = info.maxX + padding;
    } else {
      const currMax = info.maxX;
      const nextMin = layerInfos[i + 1].minX;
      right = (currMax + nextMin) / 2 - gap / 2;
    }

    left = Math.min(left, info.minX - 20);
    right = Math.max(right, info.maxX + 20);

    overlayNodes.push({
      id: `group-${info.layer}`,
      type: "groupNode",
      position: { x: left, y: globalMinY - padding - 24 },
      zIndex: -1,
      selectable: false,
      draggable: false,
      data: {
        label: colors.label,
        layer: info.layer,
        bg: colors.bg,
        border: colors.border,
      },
      style: {
        width: Math.max(right - left, 120),
        height: globalMaxY - globalMinY + padding * 2 + 24,
      },
    });
  }

  return overlayNodes;
}
