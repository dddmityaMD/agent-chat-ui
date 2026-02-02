"use client";

import React from "react";
import type { ColDef, ICellRendererParams, GridApi } from "ag-grid-community";
import { ExternalLink } from "lucide-react";

// Import extracted cell renderers
import {
  BadgeCell,
  TimestampCell,
  LinkCell,
  EntityIconCell,
  DashboardCardBadgeCell,
  createDeepLinkCellRenderer,
} from "./cell-renderers";

// ============================================================================
// Legacy Cell Renderers (re-exported for backward compatibility)
// ============================================================================

/**
 * @deprecated Use BadgeCell from cell-renderers instead
 */
export const BadgeCellRenderer = BadgeCell;

/**
 * @deprecated Use TimestampCell from cell-renderers instead
 */
export const TimestampCellRenderer = TimestampCell;

/**
 * @deprecated Use LinkCell from cell-renderers instead
 */
export const LinkCellRenderer = LinkCell;

/**
 * @deprecated Use EntityIconCell from cell-renderers instead
 */
export const EntityIconRenderer = EntityIconCell;

export const MatchReasonCellRenderer = (params: ICellRendererParams) => {
  const matchReason = params.data?.match_reason;
  const displayValue = params.value || "N/A";

  return (
    <span
      title={matchReason || "No match reason provided"}
      className="border-muted-foreground cursor-help truncate border-b border-dotted"
    >
      {displayValue}
    </span>
  );
};

export const ActionsCellRenderer = (params: ICellRendererParams) => {
  const { onView } = params.data?.actions || {};

  return (
    <div className="flex items-center gap-1">
      {onView && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onView(params.data);
          }}
          className="hover:bg-muted rounded p-1"
          title="View details"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

// ============================================================================
// Deep Link Cell Renderers (using new system)
// ============================================================================

const MetabaseCardRenderer = createDeepLinkCellRenderer(
  "metabase_card",
  "View Card",
);

const MetabaseDashboardRenderer = createDeepLinkCellRenderer(
  "metabase_dashboard",
  "View Dashboard",
);

const DbtModelDocsRenderer = createDeepLinkCellRenderer("dbt_model", "Docs");

const GitCommitRenderer = createDeepLinkCellRenderer("git_commit", "View");

// ============================================================================
// Common Column Types
// ============================================================================

export const TextColumn = (
  field: string,
  headerName: string,
  width = 150,
): ColDef => ({
  field,
  headerName,
  width,
  filter: "agTextColumnFilter",
  floatingFilter: true,
});

export const LinkColumn = (
  field: string,
  headerName: string,
  width = 200,
): ColDef => ({
  field,
  headerName,
  width,
  cellRenderer: LinkCell,
  filter: "agTextColumnFilter",
});

export const BadgeColumn = (
  field: string,
  headerName: string,
  width = 120,
): ColDef => ({
  field,
  headerName,
  width,
  cellRenderer: BadgeCell,
  filter: "agTextColumnFilter",
  cellClass: "flex items-center",
});

export const TimestampColumn = (
  field: string,
  headerName: string,
  width = 180,
): ColDef => ({
  field,
  headerName,
  width,
  cellRenderer: TimestampCell,
  filter: "agDateColumnFilter",
  sort: "desc",
});

export const MatchReasonColumn = (
  field: string,
  headerName: string,
  width = 150,
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
      cellRenderer: EntityIconCell,
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
      cellRenderer: EntityIconCell,
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
      cellRenderer: EntityIconCell,
      filter: "agTextColumnFilter",
    },
    TextColumn("name", "Report Name", 250),
    TextColumn("description", "Description", 300),
    TextColumn("collection", "Collection", 150),
    {
      field: "parent_dashboards",
      headerName: "Dashboards",
      width: 200,
      cellRenderer: DashboardCardBadgeCell,
      sortable: false,
      filter: false,
    },
    BadgeColumn("status", "Status", 100),
    TimestampColumn("created_at", "Created", 160),
    TimestampColumn("updated_at", "Updated", 160),
    MatchReasonColumn("relevance_score", "Relevance", 120),
    {
      field: "card_id",
      headerName: "Metabase Link",
      width: 150,
      cellRenderer: MetabaseCardRenderer,
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
      cellRenderer: EntityIconCell,
      filter: "agTextColumnFilter",
    },
    TextColumn("name", "Dashboard Name", 250),
    TextColumn("description", "Description", 300),
    {
      field: "dashboard_cards",
      headerName: "Cards",
      width: 250,
      cellRenderer: DashboardCardBadgeCell,
      sortable: false,
      filter: false,
    },
    BadgeColumn("status", "Status", 100),
    TimestampColumn("created_at", "Created", 160),
    TimestampColumn("updated_at", "Updated", 160),
    MatchReasonColumn("relevance_score", "Relevance", 120),
    {
      field: "dashboard_id",
      headerName: "Metabase Link",
      width: 150,
      cellRenderer: MetabaseDashboardRenderer,
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
      cellRenderer: EntityIconCell,
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
      cellRenderer: DbtModelDocsRenderer,
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
      cellRenderer: EntityIconCell,
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
          <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
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
      cellRenderer: GitCommitRenderer,
    },
    ActionsColumn(),
  ];
}

// ============================================================================
// Export Utilities
// ============================================================================

export function exportToCSV(
  gridApi: GridApi,
  filename = "evidence-export.csv",
) {
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
