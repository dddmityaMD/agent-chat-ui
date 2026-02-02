"use client";

import React from "react";
import type { ICellRendererParams } from "ag-grid-community";
import {
  ExternalLink,
  BarChart3,
  LayoutDashboard,
  FileCode,
  GitBranch,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DeepLinkType,
  generateDeepLinkUrl,
  DeepLinkConfig,
} from "@/lib/deep-links";

export interface DeepLinkCellProps {
  type: DeepLinkType;
  targetId: string;
  baseUrl?: string;
  label?: string;
  config?: Partial<DeepLinkConfig>;
}

/**
 * Map deep link types to their corresponding Lucide icons
 */
const iconMap: Record<DeepLinkType | "default", React.ComponentType<{ className?: string }>> = {
  metabase_card: BarChart3,
  metabase_dashboard: LayoutDashboard,
  dbt_model: FileCode,
  dbt_source: FileCode,
  dbt_test: FileCode,
  dbt_docs: FileCode,
  git_commit: GitBranch,
  git_file: GitBranch,
  default: ExternalLink,
};

/**
 * Get display label for a deep link type
 */
function getDefaultLabel(type: DeepLinkType): string {
  switch (type) {
    case "metabase_card":
      return "View Card";
    case "metabase_dashboard":
      return "View Dashboard";
    case "dbt_model":
      return "View Model";
    case "dbt_source":
      return "View Source";
    case "dbt_test":
      return "View Test";
    case "dbt_docs":
      return "Docs";
    case "git_commit":
      return "View Commit";
    case "git_file":
      return "View File";
    default:
      return "Open";
  }
}

/**
 * DeepLinkCell - Renders a deep link as an icon button with tooltip.
 *
 * Works with AG Grid ICellRendererParams or direct props.
 * - Icon varies by link type (Metabase, dbt, Git)
 * - Tooltip shows full destination URL
 * - Click opens link in new tab
 */
export function DeepLinkCell(
  params: ICellRendererParams | DeepLinkCellProps,
): React.ReactElement | null {
  // Handle AG Grid params with data containing deep link info
  let type: DeepLinkType;
  let targetId: string;
  let label: string | undefined;
  let config: Partial<DeepLinkConfig> | undefined;

  // Check if this is AG Grid params or direct props
  if ("data" in params && params.data) {
    // AG Grid mode - extract from cell data
    const data = params.data as Record<string, unknown>;

    // If value is provided directly, use it as targetId
    if (params.value) {
      targetId = String(params.value);
    } else {
      return null;
    }

    // Get type from colDef context or data
    const colDef = params.colDef as { cellRendererParams?: Partial<DeepLinkCellProps> };
    type = colDef?.cellRendererParams?.type || (data.deep_link_type as DeepLinkType) || "metabase_card";
    label = colDef?.cellRendererParams?.label || (data.deep_link_label as string);
    config = colDef?.cellRendererParams?.config;
  } else if ("type" in params && "targetId" in params) {
    // Direct props mode
    type = params.type;
    targetId = params.targetId;
    label = params.label;
    config = params.config;
  } else {
    return null;
  }

  if (!targetId) {
    return null;
  }

  const url = generateDeepLinkUrl(type, targetId, config);
  const displayLabel = label || getDefaultLabel(type);
  const Icon = iconMap[type] || iconMap.default;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary inline-flex items-center gap-1 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon className="h-3 w-3" />
          <span>{displayLabel}</span>
        </a>
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-mono text-xs break-all max-w-xs">{url}</span>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Create a cell renderer for a specific deep link type.
 * Use this to configure AG Grid columns.
 *
 * @example
 * const columnDef = {
 *   field: 'card_id',
 *   headerName: 'Metabase Link',
 *   cellRenderer: createDeepLinkCellRenderer('metabase_card', 'View Card'),
 * };
 */
export function createDeepLinkCellRenderer(
  type: DeepLinkType,
  label?: string,
  config?: Partial<DeepLinkConfig>,
) {
  return function DeepLinkCellRenderer(params: ICellRendererParams) {
    if (!params.value) return null;

    return (
      <DeepLinkCell
        type={type}
        targetId={String(params.value)}
        label={label}
        config={config}
      />
    );
  };
}

export default DeepLinkCell;
