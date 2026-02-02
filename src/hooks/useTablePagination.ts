"use client";

import { useState, useMemo, useCallback } from "react";
import {
  PAGE_SIZE,
  calculateTotalPages,
  clampPage,
  getPageRange,
  type PageRange,
} from "@/lib/pagination";

export interface UseTablePaginationReturn {
  /** Current 1-based page number */
  page: number;
  /** Set page number (will be clamped to valid range) */
  setPage: (page: number) => void;
  /** Number of items per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Range of items currently displayed (for "Showing X to Y of Z") */
  sliceRange: PageRange;
  /** Navigate to first page */
  goToFirst: () => void;
  /** Navigate to previous page */
  goToPrev: () => void;
  /** Navigate to next page */
  goToNext: () => void;
  /** Navigate to last page */
  goToLast: () => void;
  /** Whether there's a next page */
  hasNext: boolean;
  /** Whether there's a previous page */
  hasPrev: boolean;
}

/**
 * React hook for table pagination state and navigation
 * @param totalItems - Total number of items across all pages
 * @param initialPage - Initial page number (1-based, defaults to 1)
 * @param pageSize - Number of items per page (defaults to PAGE_SIZE)
 * @returns Pagination state and navigation functions
 */
export function useTablePagination(
  totalItems: number,
  initialPage: number = 1,
  pageSize: number = PAGE_SIZE
): UseTablePaginationReturn {
  const totalPages = useMemo(
    () => calculateTotalPages(totalItems, pageSize),
    [totalItems, pageSize]
  );

  const [page, setPageState] = useState(() =>
    clampPage(initialPage, totalPages)
  );

  // Update page if totalPages changes and current page is out of bounds
  const setPage = useCallback(
    (newPage: number) => {
      setPageState(clampPage(newPage, totalPages));
    },
    [totalPages]
  );

  // Memoized slice range for current page
  const sliceRange = useMemo(
    () => getPageRange(totalItems, page, pageSize),
    [totalItems, page, pageSize]
  );

  // Navigation helpers
  const goToFirst = useCallback(() => setPage(1), [setPage]);
  const goToPrev = useCallback(() => setPage(page - 1), [setPage, page]);
  const goToNext = useCallback(() => setPage(page + 1), [setPage, page]);
  const goToLast = useCallback(() => setPage(totalPages), [setPage, totalPages]);

  // Derived state
  const hasNext = page < totalPages && totalPages > 0;
  const hasPrev = page > 1 && totalPages > 0;

  return {
    page,
    setPage,
    pageSize,
    totalPages,
    sliceRange,
    goToFirst,
    goToPrev,
    goToNext,
    goToLast,
    hasNext,
    hasPrev,
  };
}

export { PAGE_SIZE };
export default useTablePagination;
