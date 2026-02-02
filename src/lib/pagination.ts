/**
 * Pure pagination utilities for table data
 */

export const PAGE_SIZE = 10;

export interface PaginationResult<T> {
  items: T[];
  totalPages: number;
  currentPage: number;
  hasNext: boolean;
  hasPrev: boolean;
  totalItems: number;
  startIndex: number;
  endIndex: number;
}

export interface PageRange {
  start: number;
  end: number;
}

/**
 * Paginate an array of items
 * @param items - Array to paginate
 * @param page - 1-based page number
 * @param pageSize - Number of items per page
 * @returns Sliced array for the specified page
 */
export function paginateArray<T>(
  items: T[],
  page: number,
  pageSize: number = PAGE_SIZE
): T[] {
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  return items.slice(startIndex, endIndex);
}

/**
 * Get the page range (start and end indices) for display
 * @param totalItems - Total number of items
 * @param page - Current 1-based page number
 * @param pageSize - Number of items per page
 * @returns Object with start and end indices (1-based for display)
 */
export function getPageRange(
  totalItems: number,
  page: number,
  pageSize: number = PAGE_SIZE
): PageRange {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return { start, end };
}

/**
 * Calculate total pages from total items and page size
 * @param totalItems - Total number of items
 * @param pageSize - Number of items per page
 * @returns Total number of pages
 */
export function calculateTotalPages(
  totalItems: number,
  pageSize: number = PAGE_SIZE
): number {
  return Math.ceil(totalItems / pageSize);
}

/**
 * Clamp page number to valid range
 * @param page - Requested page number
 * @param totalPages - Total available pages
 * @returns Clamped page number (1 to totalPages, or 1 if totalPages is 0)
 */
export function clampPage(page: number, totalPages: number): number {
  if (totalPages === 0) return 1;
  return Math.max(1, Math.min(page, totalPages));
}

/**
 * Get full pagination result for an array
 * @param items - Full array of items
 * @param page - Current 1-based page number
 * @param pageSize - Number of items per page
 * @returns Complete pagination result with items and metadata
 */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number = PAGE_SIZE
): PaginationResult<T> {
  const totalItems = items.length;
  const totalPages = calculateTotalPages(totalItems, pageSize);
  const currentPage = clampPage(page, totalPages);
  const paginatedItems = paginateArray(items, currentPage, pageSize);
  const { start, end } = getPageRange(totalItems, currentPage, pageSize);

  return {
    items: paginatedItems,
    totalPages,
    currentPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
    totalItems,
    startIndex: start,
    endIndex: end,
  };
}
