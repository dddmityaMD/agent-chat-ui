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
  MatchReasonCell,
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

/**
 * @deprecated Use MatchReasonCell from cell-renderers instead
 */
export const MatchReasonCellRenderer = MatchReasonCell;

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

/**
 * Column definition for match reason/relevance score display.
 * Uses MatchReasonCell component with tooltip support.
 *
 * Expected row data fields:
 * - [field]: The primary display value (e.g., relevance score)
 * - match_reason: MatchReason object with matchedFields, matchedTerms, confidence
 * - is_duplicate: boolean for deduplication indicator
 * - content_hash: string for debug mode hash display
 */
export const MatchReasonColumn = (
  field: string,
  headerName: string,
  width = 150,
  expandable = false,
): ColDef => ({
  field,
  headerName,
  width,
  cellRenderer: MatchReasonCell,
  cellRendererParams: {
    expandable,
  },
  tooltipField: "match_reason_detailed",
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
      width: 90,
      cellRenderer: EntityIconCell,
      filter: "agTextColumnFilter",
      floatingFilter: true,
    },
    TextColumn("schema_name", "Schema", 100),
    TextColumn("table_name", "Table", 160),
    {
      ...TextColumn("description", "Description", 200),
      flex: 1,
    },
    BadgeColumn("status", "Status", 100),
    { ...TimestampColumn("last_updated", "Last Updated", 150), hide: true },
    { ...MatchReasonColumn("relevance_score", "Relevance", 120), hide: true },
    { ...LinkColumn("source_link", "Source", 150), hide: true },
  ];
}

export function createColumnColumnDefs(): ColDef[] {
  return [
    {
      field: "entity_type",
      headerName: "Type",
      width: 90,
      cellRenderer: EntityIconCell,
      filter: "agTextColumnFilter",
      floatingFilter: true,
    },
    TextColumn("schema_name", "Schema", 100),
    TextColumn("table_name", "Table", 130),
    TextColumn("column_name", "Column", 150),
    TextColumn("data_type", "Data Type", 100),
    {
      ...TextColumn("description", "Description", 200),
      flex: 1,
    },
    { ...BadgeColumn("is_nullable", "Nullable", 100), hide: true },
    { ...MatchReasonColumn("relevance_score", "Relevance", 120), hide: true },
    { ...LinkColumn("source_link", "Source", 150), hide: true },
  ];
}

export function createReportColumnDefs(): ColDef[] {
  return [
    {
      field: "entity_type",
      headerName: "Type",
      width: 90,
      cellRenderer: EntityIconCell,
      filter: "agTextColumnFilter",
      floatingFilter: true,
    },
    TextColumn("name", "Report Name", 200),
    {
      ...TextColumn("description", "Description", 200),
      flex: 1,
    },
    TextColumn("collection", "Collection", 130),
    BadgeColumn("status", "Status", 100),
    {
      field: "parent_dashboards",
      headerName: "Dashboards",
      width: 200,
      cellRenderer: DashboardCardBadgeCell,
      sortable: false,
      filter: false,
      hide: true,
    },
    { ...TimestampColumn("created_at", "Created", 160), hide: true },
    { ...TimestampColumn("updated_at", "Updated", 160), hide: true },
    { ...MatchReasonColumn("relevance_score", "Relevance", 120), hide: true },
    {
      field: "card_id",
      headerName: "Metabase Link",
      width: 150,
      cellRenderer: MetabaseCardRenderer,
      hide: true,
    },
  ];
}

export function createDashboardColumnDefs(): ColDef[] {
  return [
    {
      field: "entity_type",
      headerName: "Type",
      width: 90,
      cellRenderer: EntityIconCell,
      filter: "agTextColumnFilter",
      floatingFilter: true,
    },
    TextColumn("name", "Dashboard Name", 200),
    {
      ...TextColumn("description", "Description", 200),
      flex: 1,
    },
    BadgeColumn("status", "Status", 100),
    {
      field: "dashboard_cards",
      headerName: "Cards",
      width: 250,
      cellRenderer: DashboardCardBadgeCell,
      sortable: false,
      filter: false,
      hide: true,
    },
    { ...TimestampColumn("created_at", "Created", 160), hide: true },
    { ...TimestampColumn("updated_at", "Updated", 160), hide: true },
    { ...MatchReasonColumn("relevance_score", "Relevance", 120), hide: true },
    {
      field: "dashboard_id",
      headerName: "Metabase Link",
      width: 150,
      cellRenderer: MetabaseDashboardRenderer,
      hide: true,
    },
  ];
}

export function createDbtModelColumnDefs(): ColDef[] {
  return [
    {
      field: "entity_type",
      headerName: "Type",
      width: 90,
      cellRenderer: EntityIconCell,
      filter: "agTextColumnFilter",
      floatingFilter: true,
    },
    TextColumn("name", "Model Name", 180),
    {
      ...TextColumn("description", "Description", 200),
      flex: 1,
    },
    BadgeColumn("materialized", "Materialized", 110),
    TextColumn("schema", "Schema", 100),
    { ...TextColumn("package", "Package", 120), hide: true },
    { ...TimestampColumn("last_run", "Last Run", 150), hide: true },
    { ...MatchReasonColumn("relevance_score", "Relevance", 120), hide: true },
    {
      field: "documentation_url",
      headerName: "Documentation",
      width: 150,
      cellRenderer: DbtModelDocsRenderer,
      hide: true,
    },
  ];
}

export function createGitCommitColumnDefs(): ColDef[] {
  return [
    {
      field: "entity_type",
      headerName: "Type",
      width: 90,
      cellRenderer: EntityIconCell,
      filter: "agTextColumnFilter",
      floatingFilter: true,
    },
    {
      field: "commit_hash",
      headerName: "Commit",
      width: 100,
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
    {
      ...TextColumn("message", "Message", 200),
      flex: 1,
    },
    TextColumn("author", "Author", 120),
    TimestampColumn("timestamp", "Date", 140),
    { ...TextColumn("file_path", "File", 200), hide: true },
    { ...MatchReasonColumn("relevance_score", "Relevance", 120), hide: true },
    {
      field: "commit_url",
      headerName: "Git Link",
      width: 120,
      cellRenderer: GitCommitRenderer,
      hide: true,
    },
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
