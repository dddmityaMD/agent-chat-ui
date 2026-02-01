"use client";

import React from "react";
import type { ColDef, ICellRendererParams, GridApi } from "ag-grid-community";
import { cn } from "@/lib/utils";
import {
  ExternalLink,
  Database,
  FileCode,
  GitBranch,
  LayoutDashboard,
  BarChart3,
  Table,
  Columns,
} from "lucide-react";

// ============================================================================
// Cell Renderers
// ============================================================================

export const LinkCellRenderer = (params: ICellRendererParams) => {
  if (!params.value) return null;

  const { url, text, icon } =
    typeof params.value === "object"
      ? params.value
      : { url: params.value, text: params.value, icon: false };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {icon && <ExternalLink className="h-3 w-3" />}
      <span className="truncate">{text}</span>
    </a>
  );
};

export const BadgeCellRenderer = (params: ICellRendererParams) => {
  if (!params.value) return null;

  const status = String(params.value).toLowerCase();

  const variantClasses: Record<string, string> = {
    active: "bg-green-100 text-green-800 border-green-200",
    deprecated: "bg-yellow-100 text-yellow-800 border-yellow-200",
    error: "bg-red-100 text-red-800 border-red-200",
    draft: "bg-gray-100 text-gray-800 border-gray-200",
    published: "bg-blue-100 text-blue-800 border-blue-200",
    archived: "bg-slate-100 text-slate-800 border-slate-200",
    success: "bg-green-100 text-green-800 border-green-200",
    failed: "bg-red-100 text-red-800 border-red-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  };

  const classes =
    variantClasses[status] ||
    "bg-gray-100 text-gray-800 border-gray-200";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        classes
      )}
    >
      {params.value}
    </span>
  );
};

export const MatchReasonCellRenderer = (params: ICellRendererParams) => {
  const matchReason = params.data?.match_reason;
  const displayValue = params.value || "N/A";

  return (
    <span
      title={matchReason || "No match reason provided"}
      className="truncate cursor-help border-b border-dotted border-muted-foreground"
    >
      {displayValue}
    </span>
  );
};

export const TimestampCellRenderer = (params: ICellRendererParams) => {
  if (!params.value) return null;

  const date = new Date(params.value);
  if (isNaN(date.getTime())) return <span>{params.value}</span>;

  const formatted = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <span title={date.toISOString()} className="text-muted-foreground">
      {formatted}
    </span>
  );
};

export const EntityIconRenderer = (params: ICellRendererParams) => {
  const entityType = params.value;

  const iconMap: Record<string, React.ReactNode> = {
    table: <Table className="h-4 w-4 text-blue-600" />,
    column: <Columns className="h-4 w-4 text-purple-600" />,
    report: <BarChart3 className="h-4 w-4 text-green-600" />,
    dashboard: <LayoutDashboard className="h-4 w-4 text-orange-600" />,
    dbt_model: <FileCode className="h-4 w-4 text-indigo-600" />,
    git_commit: <GitBranch className="h-4 w-4 text-red-600" />,
    database: <Database className="h-4 w-4 text-blue-600" />,
  };

  return (
    <div className="flex items-center gap-2">
      {iconMap[entityType] || <Database className="h-4 w-4 text-gray-600" />}
      <span className="capitalize">{entityType?.replace(/_/g, " ")}</span>
    </div>
  );
};

export const ActionsCellRenderer = (params: ICellRendererParams) => {
  const { onView, onTrace } = params.data?.actions || {};

  return (
    <div className="flex items-center gap-1">
      {onView && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onView(params.data);
          }}
          className="p-1 hover:bg-muted rounded"
          title="View details"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

// ============================================================================
// Common Column Types
// ============================================================================

export const TextColumn = (field: string, headerName: string, width = 150): ColDef => ({
  field,
  headerName,
  width,
  filter: "agTextColumnFilter",
  floatingFilter: true,
});

export const LinkColumn = (
  field: string,
  headerName: string,
  width = 200
): ColDef => ({
  field,
  headerName,
  width,
  cellRenderer: LinkCellRenderer,
  filter: "agTextColumnFilter",
});

export const BadgeColumn = (
  field: string,
  headerName: string,
  width = 120
): ColDef => ({
  field,
  headerName,
  width,
  cellRenderer: BadgeCellRenderer,
  filter: "agTextColumnFilter",
  cellClass: "flex items-center",
});

export const TimestampColumn = (
  field: string,
  headerName: string,
  width = 180
): ColDef => ({
  field,
  headerName,
  width,
  cellRenderer: TimestampCellRenderer,
  filter: "agDateColumnFilter",
  sort: "desc",
});

export const MatchReasonColumn = (
  field: string,
  headerName: string,
  width = 150
): ColDef => ({
  field,
  headerName,
  width,
  cellRenderer: MatchReasonCellRenderer,
  tooltipField: "match_reason",
});

export const ActionsColumn = (width = 80): ColDef => ({
  headerName: "",
  width,
  cellRenderer: ActionsCellRenderer,
  sortable: false,
  filter: false,
  pinned: "right",
});

// ============================================================================
// Entity Type Column Definitions
// ============================================================================

export function createTableColumnDefs(): ColDef[] {
  return [
    {
      field: "entity_type",
      headerName: "Type",
      width: 120,
      cellRenderer: EntityIconRenderer,
      filter: "agTextColumnFilter",
    },
    TextColumn("schema_name", "Schema", 120),
    TextColumn("table_name", "Table", 200),
    TextColumn("description", "Description", 300),
    BadgeColumn("status", "Status", 100),
    TimestampColumn("last_updated", "Last Updated", 160),
    MatchReasonColumn("relevance_score", "Relevance", 120),
    LinkColumn("source_link", "Source", 150),
    ActionsColumn(),
  ];
}

export function createColumnColumnDefs(): ColDef[] {
  return [
    {
      field: "entity_type",
      headerName: "Type",
      width: 100,
      cellRenderer: EntityIconRenderer,
      filter: "agTextColumnFilter",
    },
    TextColumn("schema_name", "Schema", 120),
    TextColumn("table_name", "Table", 150),
    TextColumn("column_name", "Column", 180),
    TextColumn("data_type", "Data Type", 120),
    TextColumn("description", "Description", 250),
    BadgeColumn("is_nullable", "Nullable", 100),
    MatchReasonColumn("relevance_score", "Relevance", 120),
    LinkColumn("source_link", "Source", 150),
    ActionsColumn(),
  ];
}

export function createReportColumnDefs(): ColDef[] {
  return [
    {
      field: "entity_type",
      headerName: "Type",
      width: 100,
      cellRenderer: EntityIconRenderer,
      filter: "agTextColumnFilter",
    },
    TextColumn("name", "Report Name", 250),
    TextColumn("description", "Description", 300),
    TextColumn("collection", "Collection", 150),
    BadgeColumn("status", "Status", 100),
    TimestampColumn("created_at", "Created", 160),
    TimestampColumn("updated_at", "Updated", 160),
    MatchReasonColumn("relevance_score", "Relevance", 120),
    {
      field: "card_id",
      headerName: "Metabase Link",
      width: 150,
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) return null;
        const url = `/card/${params.value}`;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <BarChart3 className="h-3 w-3" />
            <span>View Card</span>
          </a>
        );
      },
    },
    ActionsColumn(),
  ];
}

export function createDashboardColumnDefs(): ColDef[] {
  return [
    {
      field: "entity_type",
      headerName: "Type",
      width: 100,
      cellRenderer: EntityIconRenderer,
      filter: "agTextColumnFilter",
    },
    TextColumn("name", "Dashboard Name", 250),
    TextColumn("description", "Description", 300),
    BadgeColumn("status", "Status", 100),
    TimestampColumn("created_at", "Created", 160),
    TimestampColumn("updated_at", "Updated", 160),
    MatchReasonColumn("relevance_score", "Relevance", 120),
    {
      field: "dashboard_id",
      headerName: "Metabase Link",
      width: 150,
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) return null;
        const url = `/dashboard/${params.value}`;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <LayoutDashboard className="h-3 w-3" />
            <span>View Dashboard</span>
          </a>
        );
      },
    },
    ActionsColumn(),
  ];
}

export function createDbtModelColumnDefs(): ColDef[] {
  return [
    {
      field: "entity_type",
      headerName: "Type",
      width: 100,
      cellRenderer: EntityIconRenderer,
      filter: "agTextColumnFilter",
    },
    TextColumn("name", "Model Name", 250),
    TextColumn("package", "Package", 150),
    TextColumn("description", "Description", 300),
    BadgeColumn("materialized", "Materialized", 120),
    TextColumn("schema", "Schema", 120),
    TimestampColumn("last_run", "Last Run", 160),
    MatchReasonColumn("relevance_score", "Relevance", 120),
    {
      field: "documentation_url",
      headerName: "Documentation",
      width: 150,
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) return null;
        return (
          <a
            href={params.value}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <FileCode className="h-3 w-3" />
            <span>Docs</span>
          </a>
        );
      },
    },
    ActionsColumn(),
  ];
}

export function createGitCommitColumnDefs(): ColDef[] {
  return [
    {
      field: "entity_type",
      headerName: "Type",
      width: 100,
      cellRenderer: EntityIconRenderer,
      filter: "agTextColumnFilter",
    },
    {
      field: "commit_hash",
      headerName: "Commit",
      width: 120,
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) return null;
        const shortHash = String(params.value).slice(0, 7);
        return (
          <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
            {shortHash}
          </code>
        );
      },
    },
    TextColumn("message", "Message", 400),
    TextColumn("author", "Author", 150),
    TimestampColumn("timestamp", "Date", 160),
    TextColumn("file_path", "File", 250),
    MatchReasonColumn("relevance_score", "Relevance", 120),
    {
      field: "commit_url",
      headerName: "Git Link",
      width: 120,
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) return null;
        return (
          <a
            href={params.value}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <GitBranch className="h-3 w-3" />
            <span>View</span>
          </a>
        );
      },
    },
    ActionsColumn(),
  ];
}

// ============================================================================
// Export Utilities
// ============================================================================

export function exportToCSV(gridApi: GridApi, filename = "evidence-export.csv") {
  const params = {
    fileName: filename,
    columnSeparator: ",",
  };
  gridApi.exportDataAsCsv(params);
}

export function getSelectedRows(gridApi: GridApi) {
  return gridApi.getSelectedRows();
}

export function getColumnFilters(gridApi: GridApi) {
  const filterModel = gridApi.getFilterModel();
  return filterModel;
}
