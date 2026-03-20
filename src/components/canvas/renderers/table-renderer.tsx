"use client";

import React, { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, type ColDef } from "ag-grid-community";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TableRendererProps {
  /**
   * Expected shape: { rows: Record<string, unknown>[]; columns?: string[] }
   * If columns omitted, auto-detect from first row keys.
   */
  data: unknown;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

interface TableData {
  rows: Record<string, unknown>[];
  columns?: string[];
}

function isTableData(v: unknown): v is TableData {
  return (
    v != null &&
    typeof v === "object" &&
    "rows" in v &&
    Array.isArray((v as TableData).rows)
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TableRenderer({ data }: TableRendererProps) {
  if (!isTableData(data) || data.rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        No table data available
      </div>
    );
  }

  const columnDefs: ColDef[] = useMemo(() => {
    const cols = data.columns ?? Object.keys(data.rows[0] ?? {});
    return cols.map((col) => ({
      field: col,
      headerName: col,
      sortable: true,
      filter: true,
      resizable: true,
    }));
  }, [data.columns, data.rows]);

  return (
    <div className="h-full w-full" data-testid="table-renderer">
      <AgGridReact
        modules={[AllCommunityModule]}
        rowData={data.rows}
        columnDefs={columnDefs}
        domLayout="normal"
        theme="legacy"
        defaultColDef={{
          flex: 1,
          minWidth: 100,
        }}
      />
    </div>
  );
}
