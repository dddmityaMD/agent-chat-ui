"use client";

import { useState, useCallback } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface SortState {
  /** Column ID being sorted, or null if no sort */
  colId: string | null;
  /** Sort direction: 'asc', 'desc', or null */
  sort: SortDirection;
}

export interface UseTableSortingReturn<T> {
  /** Current sort state */
  sortState: SortState;
  /** Set sort to a specific column and direction */
  setSortColumn: (colId: string, sort: SortDirection) => void;
  /** Toggle sort for a column (asc -> desc -> null cycle) */
  toggleSort: (colId: string) => void;
  /** Clear all sorting */
  clearSort: () => void;
  /** Compare function for sorting arrays */
  comparator: (a: T, b: T) => number;
  /** Sorted data (if using client-side sorting) */
  sortData: (data: T[]) => T[];
}

/**
 * Default comparison function that handles strings, numbers, dates, and nulls
 * @param a - First value
 * @param b - Second value
 * @returns Comparison result (-1, 0, 1)
 */
function defaultCompare(a: unknown, b: unknown): number {
  // Handle null/undefined cases
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls last
  if (b == null) return -1;

  // Handle dates (ISO strings or Date objects)
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
  const strA = String(a);
  const strB = String(b);
  if (a instanceof Date || b instanceof Date || (ISO_DATE_RE.test(strA) && ISO_DATE_RE.test(strB))) {
    const aDate = a instanceof Date ? a.getTime() : Date.parse(strA);
    const bDate = b instanceof Date ? b.getTime() : Date.parse(strB);
    if (!isNaN(aDate) && !isNaN(bDate)) {
      return aDate - bDate;
    }
  }

  // Handle numbers
  const aNum = Number(a);
  const bNum = Number(b);
  if (!isNaN(aNum) && !isNaN(bNum) && String(a) === String(aNum)) {
    return aNum - bNum;
  }

  // Handle strings (case-insensitive)
  const aStr = String(a).toLowerCase();
  const bStr = String(b).toLowerCase();
  return aStr.localeCompare(bStr);
}

/**
 * React hook for single-column table sorting with AG Grid integration
 * @param initialSort - Initial sort state (defaults to no sort)
 * @param customCompare - Optional custom comparison function
 * @returns Sort state and control functions
 */
export function useTableSorting<T extends Record<string, unknown>>(
  initialSort: SortState = { colId: null, sort: null },
  customCompare?: (a: unknown, b: unknown) => number
): UseTableSortingReturn<T> {
  const [sortState, setSortState] = useState<SortState>(initialSort);
  const compare = customCompare || defaultCompare;

  /**
   * Set sort to a specific column and direction
   * Single-column sort: clears any previous sort
   */
  const setSortColumn = useCallback((colId: string, sort: SortDirection) => {
    setSortState({ colId, sort });
  }, []);

  /**
   * Toggle sort for a column following AG Grid conventions:
   * - First click: ascending
   * - Second click: descending
   * - Third click: no sort (clear)
   */
  const toggleSort = useCallback(
    (colId: string) => {
      setSortState((current) => {
        // If clicking a different column, start with asc
        if (current.colId !== colId) {
          return { colId, sort: "asc" };
        }

        // Cycle: asc -> desc -> null
        switch (current.sort) {
          case "asc":
            return { colId, sort: "desc" };
          case "desc":
            return { colId: null, sort: null };
          default:
            return { colId, sort: "asc" };
        }
      });
    },
    []
  );

  /**
   * Clear all sorting
   */
  const clearSort = useCallback(() => {
    setSortState({ colId: null, sort: null });
  }, []);

  /**
   * Comparison function for use with Array.sort()
   */
  const comparator = useCallback(
    (a: T, b: T): number => {
      if (!sortState.colId || !sortState.sort) return 0;

      const aVal = a[sortState.colId];
      const bVal = b[sortState.colId];

      const result = compare(aVal, bVal);
      return sortState.sort === "asc" ? result : -result;
    },
    [sortState, compare]
  );

  /**
   * Sort an array of data based on current sort state
   */
  const sortData = useCallback(
    (data: T[]): T[] => {
      if (!sortState.colId || !sortState.sort) return data;
      return [...data].sort(comparator);
    },
    [comparator, sortState]
  );

  return {
    sortState,
    setSortColumn,
    toggleSort,
    clearSort,
    comparator,
    sortData,
  };
}

export default useTableSorting;
