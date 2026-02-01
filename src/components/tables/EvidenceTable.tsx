"use client";

import React, { useCallback, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ClientSideRowModelModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  ValidationModule,
  type ColDef,
  type RowClickedEvent,
  type SortChangedEvent,
  type FilterChangedEvent,
  type GridReadyEvent,
  type GridApi,
} from "ag-grid-community";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// Register AG Grid modules
const modules = [
  ClientSideRowModelModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  ValidationModule,
];

export interface EvidenceRow {
  id: string;
  [key: string]: unknown;
}

export interface EvidenceTableProps {
  rowData: EvidenceRow[];
  columnDefs: ColDef[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRowClicked?: (row: EvidenceRow) => void;
  onSortChanged?: (event: SortChangedEvent) => void;
  onFilterChanged?: (event: FilterChangedEvent) => void;
  height?: number | string;
  className?: string;
  emptyMessage?: string;
}

export function EvidenceTable({
  rowData,
  columnDefs,
  loading = false,
  hasMore = false,
  onLoadMore,
  onRowClicked,
  onSortChanged,
  onFilterChanged,
  height = 400,
  className,
  emptyMessage = "No results found",
}: EvidenceTableProps) {
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1,
      minWidth: 100,
    }),
    []
  );

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
  }, []);

  const handleRowClicked = useCallback(
    (event: RowClickedEvent) => {
      if (onRowClicked && event.data) {
        onRowClicked(event.data as EvidenceRow);
      }
    },
    [onRowClicked]
  );

  const handleSortChanged = useCallback(
    (event: SortChangedEvent) => {
      if (onSortChanged) {
        onSortChanged(event);
      }
    },
    [onSortChanged]
  );

  const handleFilterChanged = useCallback(
    (event: FilterChangedEvent) => {
      if (onFilterChanged) {
        onFilterChanged(event);
      }
    },
    [onFilterChanged]
  );

  // Show empty state when no data and not loading
  const showEmptyState = !loading && rowData.length === 0;

  // Show loading overlay
  const showLoadingOverlay = loading && rowData.length === 0;

  return (
    <div
      className={cn(
        "w-full rounded-md border border-border bg-card overflow-hidden",
        className
      )}
    >
      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span>Loading evidence...</span>
        </div>
      )}

      {/* Empty State */}
      {showEmptyState && (
        <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
          <svg
            className="mb-4 h-12 w-12 text-muted-foreground/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm font-medium">{emptyMessage}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Try adjusting your filters or query
          </p>
        </div>
      )}

      {/* AG Grid */}
      {!showEmptyState && !showLoadingOverlay && (
        <div
          className="ag-theme-quartz w-full"
          style={{
            height: typeof height === "number" ? `${height}px` : height,
          }}
        >
          <AgGridReact
            modules={modules}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            onRowClicked={handleRowClicked}
            onSortChanged={handleSortChanged}
            onFilterChanged={handleFilterChanged}
            pagination={false}
            rowSelection={{
              mode: "singleRow",
              checkboxes: false,
              enableClickSelection: true,
            }}
            animateRows={true}
            suppressRowClickSelection={false}
            enableCellTextSelection={true}
            ensureDomOrder={true}
            loadingOverlayComponent={() => (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            overlayLoadingTemplate={
              '<div class="ag-overlay-loading-center">Loading...</div>'
            }
            overlayNoRowsTemplate={`<div class="ag-overlay-no-rows-center">${emptyMessage}</div>`}
          />
        </div>
      )}

      {/* Loading indicator for additional data */}
      {loading && rowData.length > 0 && (
        <div className="flex items-center justify-center p-3 border-t bg-muted/50">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            Loading more results...
          </span>
        </div>
      )}
    </div>
  );
}

export default EvidenceTable;
