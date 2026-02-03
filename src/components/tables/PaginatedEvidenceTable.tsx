"use client";

import React, { useMemo, useCallback, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  EvidenceTable,
  type EvidenceTableProps,
} from "./EvidenceTable";
import { useTablePagination, PAGE_SIZE } from "@/hooks/useTablePagination";
import type { SortChangedEvent, ColDef, ColumnState } from "ag-grid-community";

export interface PaginatedEvidenceTableProps extends EvidenceTableProps {
  /** Initial page number (1-based) */
  initialPage?: number;
  /** Total count for pagination display */
  totalCount?: number;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
}

/**
 * Evidence table with traditional pagination controls and sorting
 * Displays 10 rows per page with page navigation at the bottom
 */
export function PaginatedEvidenceTable({
  rowData,
  columnDefs,
  loading = false,
  initialPage = 1,
  totalCount: propTotalCount,
  onRowClicked,
  onSortChanged,
  onFilterChanged,
  height = 400,
  className,
  emptyMessage = "No results found",
  onPageChange,
}: PaginatedEvidenceTableProps) {
  // Use provided totalCount or derive from rowData length
  const totalItems = propTotalCount ?? rowData.length;

  // Pagination hook
  const {
    page,
    setPage,
    totalPages,
    sliceRange,
    goToFirst,
    goToPrev,
    goToNext,
    goToLast,
    hasNext,
    hasPrev,
  } = useTablePagination(totalItems, initialPage, PAGE_SIZE);

  // Sort state - synced with AG Grid
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);

  // Apply sorting and pagination to data (client-side)
  const displayData = useMemo(() => {
    const sorted = [...rowData];

    // Apply sort if active
    if (sortColumn && sortDirection) {
      sorted.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        // Handle nulls
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // Compare values
        let comparison = 0;
        if (typeof aVal === "number" && typeof bVal === "number") {
          comparison = aVal - bVal;
        } else {
          const aStr = String(aVal).toLowerCase();
          const bStr = String(bVal).toLowerCase();
          comparison = aStr.localeCompare(bStr);
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    // Then paginate
    const startIndex = (page - 1) * PAGE_SIZE;
    return sorted.slice(startIndex, startIndex + PAGE_SIZE);
  }, [rowData, sortColumn, sortDirection, page]);

  // Handle sort changes from AG Grid
  const handleSortChanged = useCallback(
    (event: SortChangedEvent) => {
      // Get column state to determine sort
      const columnState = event.api.getColumnState();
      const sortedCol = columnState.find((col: ColumnState) => col.sort);

      if (sortedCol) {
        setSortColumn(sortedCol.colId || null);
        setSortDirection(sortedCol.sort as "asc" | "desc" | null);
      } else {
        setSortColumn(null);
        setSortDirection(null);
      }

      // Call parent handler if provided
      onSortChanged?.(event);
    },
    [onSortChanged]
  );

  // Transform columnDefs to include sort state
  const sortedColumnDefs = useMemo(() => {
    return columnDefs.map((col: ColDef) => ({
      ...col,
      sort:
        sortColumn === col.field ? sortDirection || undefined : undefined,
    }));
  }, [columnDefs, sortColumn, sortDirection]);

  // Handle page change with callback
  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      onPageChange?.(newPage);
    },
    [setPage, onPageChange]
  );

  // Generate page numbers to display
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first, last, current, and neighbors
      if (page <= 3) {
        // Near start: show 1, 2, 3, 4, ..., last
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        // Near end: show 1, ..., last-3, last-2, last-1, last
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Middle: show 1, ..., current-1, current, current+1, ..., last
        pages.push(1);
        pages.push("...");
        pages.push(page - 1);
        pages.push(page);
        pages.push(page + 1);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  }, [page, totalPages]);

  // Don't show pagination if there's no data or only one page
  const showPagination = totalItems > 0 && totalPages > 1;

  return (
    <div className={cn("flex flex-col gap-4", className)} data-testid="paginated-table">
      {/* Results count */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground" data-testid="results-count">
          {totalItems > 0 ? (
            <>
              Showing{" "}
              <span className="font-medium text-foreground">
                {sliceRange.start}
              </span>{" "}
              to{" "}
              <span className="font-medium text-foreground">
                {sliceRange.end}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">
                {totalItems}
              </span>{" "}
              results
            </>
          ) : (
            <span>No results</span>
          )}
        </div>
      </div>

      {/* Evidence Table */}
      <EvidenceTable
        rowData={displayData}
        columnDefs={sortedColumnDefs}
        loading={loading}
        onRowClicked={onRowClicked}
        onSortChanged={handleSortChanged}
        onFilterChanged={onFilterChanged}
        height={height}
        emptyMessage={emptyMessage}
      />

      {/* Pagination Controls */}
      {showPagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t">
          {/* Page info - mobile only */}
          <div className="text-sm text-muted-foreground sm:hidden">
            Page {page} of {totalPages}
          </div>

          {/* Pagination buttons */}
          <div className="flex items-center gap-1">
            {/* First page */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 hidden sm:flex"
              onClick={goToFirst}
              disabled={!hasPrev}
              aria-label="Go to first page"
              data-testid="btn-first-page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>

            {/* Previous page */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={goToPrev}
              disabled={!hasPrev}
              aria-label="Go to previous page"
              data-testid="btn-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page numbers - hidden on small screens */}
            <div className="hidden sm:flex items-center gap-1">
              {pageNumbers.map((pageNum, index) =>
                pageNum === "..." ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-2 text-muted-foreground"
                  >
                    ...
                  </span>
                ) : (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handlePageChange(pageNum as number)}
                    aria-label={`Go to page ${pageNum}`}
                    aria-current={page === pageNum ? "page" : undefined}
                  >
                    {pageNum}
                  </Button>
                )
              )}
            </div>

            {/* Next page */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={goToNext}
              disabled={!hasNext}
              aria-label="Go to next page"
              data-testid="btn-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Last page */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 hidden sm:flex"
              onClick={goToLast}
              disabled={!hasNext}
              aria-label="Go to last page"
              data-testid="btn-last-page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Page info - desktop only */}
          <div className="hidden sm:block text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </div>
        </div>
      )}
    </div>
  );
}

export default PaginatedEvidenceTable;
