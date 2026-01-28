/**
 * usePagination.ts
 *
 * PURPOSE: Reusable pagination hook for client-side data pagination
 *
 * WHY THIS EXISTS (Task 3.5 from MASTER_IMPLEMENTATION_PLAN_V2.md):
 * - Admin pages load all users which can be slow for large organizations
 * - Pagination improves performance and UX for large datasets
 *
 * USAGE:
 * ```tsx
 * const { paginatedData, page, setPage, totalPages, hasNext, hasPrev } = usePagination(data, 20);
 *
 * // Render paginatedData
 * {paginatedData.map(item => ...)}
 *
 * // Render pagination controls
 * <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
 * ```
 */
import { useMemo, useState, useCallback } from 'react';

interface UsePaginationOptions {
  initialPage?: number;
  pageSize?: number;
}

interface UsePaginationResult<T> {
  /** Current page of data */
  paginatedData: T[];
  /** Current page number (1-indexed) */
  page: number;
  /** Set the current page */
  setPage: (page: number) => void;
  /** Go to next page */
  nextPage: () => void;
  /** Go to previous page */
  prevPage: () => void;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items */
  totalItems: number;
  /** Whether there's a next page */
  hasNext: boolean;
  /** Whether there's a previous page */
  hasPrev: boolean;
  /** Current page size */
  pageSize: number;
  /** Start index of current page (0-indexed) */
  startIndex: number;
  /** End index of current page (exclusive) */
  endIndex: number;
}

export function usePagination<T>(
  data: T[] | undefined,
  options: UsePaginationOptions | number = {}
): UsePaginationResult<T> {
  // Handle legacy signature where second arg is pageSize number
  const { initialPage = 1, pageSize = 20 } =
    typeof options === 'number' ? { pageSize: options } : options;

  const [page, setPageInternal] = useState(initialPage);

  const totalItems = data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp page to valid range when data changes
  const validPage = useMemo(() => {
    return Math.min(Math.max(1, page), totalPages);
  }, [page, totalPages]);

  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedData = useMemo(() => {
    if (!data) return [];
    return data.slice(startIndex, endIndex);
  }, [data, startIndex, endIndex]);

  const setPage = useCallback(
    (newPage: number) => {
      const clamped = Math.min(Math.max(1, newPage), totalPages);
      setPageInternal(clamped);
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    setPage(validPage + 1);
  }, [validPage, setPage]);

  const prevPage = useCallback(() => {
    setPage(validPage - 1);
  }, [validPage, setPage]);

  return {
    paginatedData,
    page: validPage,
    setPage,
    nextPage,
    prevPage,
    totalPages,
    totalItems,
    hasNext: validPage < totalPages,
    hasPrev: validPage > 1,
    pageSize,
    startIndex,
    endIndex,
  };
}
