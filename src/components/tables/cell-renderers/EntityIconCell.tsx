"use client";

import React from "react";
import type { ICellRendererParams } from "ag-grid-community";
import {
  Database,
  FileCode,
  GitBranch,
  LayoutDashboard,
  BarChart3,
  Table,
  Columns,
  FileText,
  Folder,
  Server,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface EntityIconCellProps {
  entityType: string;
  showLabel?: boolean;
  className?: string;
}

/**
 * Map entity types to their corresponding Lucide icons and colors
 */
const entityIconMap: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  table: { icon: Table, color: "text-blue-600" },
  column: { icon: Columns, color: "text-purple-600" },
  report: { icon: BarChart3, color: "text-green-600" },
  card: { icon: BarChart3, color: "text-green-600" },
  dashboard: { icon: LayoutDashboard, color: "text-orange-600" },
  dbt_model: { icon: FileCode, color: "text-indigo-600" },
  model: { icon: FileCode, color: "text-indigo-600" },
  dbt_source: { icon: Database, color: "text-cyan-600" },
  source: { icon: Database, color: "text-cyan-600" },
  dbt_test: { icon: FileText, color: "text-yellow-600" },
  test: { icon: FileText, color: "text-yellow-600" },
  git_commit: { icon: GitBranch, color: "text-red-600" },
  commit: { icon: GitBranch, color: "text-red-600" },
  git_file: { icon: FileText, color: "text-gray-600" },
  file: { icon: FileText, color: "text-gray-600" },
  database: { icon: Database, color: "text-blue-600" },
  schema: { icon: Folder, color: "text-amber-600" },
  server: { icon: Server, color: "text-slate-600" },
  key: { icon: Key, color: "text-yellow-600" },
  collection: { icon: Folder, color: "text-amber-600" },
};

/**
 * Default icon for unknown entity types
 */
const defaultIcon = { icon: Database, color: "text-gray-600" };

/**
 * Format entity type for display (capitalize, replace underscores with spaces)
 */
function formatEntityType(entityType: string): string {
  return entityType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * EntityIconCell - Renders an entity type with its corresponding icon.
 *
 * Works with AG Grid ICellRendererParams or direct props.
 * - Maps entity types to semantically appropriate icons
 * - Applies consistent coloring per entity type
 * - Optionally shows label alongside icon
 */
export function EntityIconCell(
  params: ICellRendererParams | EntityIconCellProps,
): React.ReactElement | null {
  // Extract entityType from params
  let entityType: string | null | undefined;
  let showLabel: boolean = true;
  let className: string | undefined;

  if ("entityType" in params) {
    // Direct props mode
    entityType = params.entityType;
    showLabel = params.showLabel !== false;
    className = params.className;
  } else if ("value" in params) {
    // AG Grid mode - value is the entity type
    entityType = params.value;

    // Check colDef for showLabel configuration
    const colDef = params.colDef as { cellRendererParams?: { showLabel?: boolean } };
    showLabel = colDef?.cellRendererParams?.showLabel !== false;
  }

  if (!entityType) {
    return null;
  }

  const normalizedType = entityType.toLowerCase();
  const { icon: Icon, color } = entityIconMap[normalizedType] || defaultIcon;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Icon className={cn("h-4 w-4", color)} />
      {showLabel && (
        <span className="capitalize">{formatEntityType(normalizedType)}</span>
      )}
    </div>
  );
}

export default EntityIconCell;
