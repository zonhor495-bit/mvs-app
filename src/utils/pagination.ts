/**
 * Pagination utilities for large lists
 */

export interface PaginationState {
  pageSize: number;
  currentPage: number;
  totalItems: number;
}

export function calculatePagination<T>(items: T[], pageSize: number, currentPage: number) {
  const totalPages = Math.ceil(items.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedItems = items.slice(startIndex, endIndex);

  return {
    items: paginatedItems,
    totalPages,
    currentPage,
    pageSize,
    totalItems: items.length,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}

export const DEFAULT_PAGE_SIZES = {
  small: 10,
  medium: 25,
  large: 50,
  xl: 100,
} as const;
