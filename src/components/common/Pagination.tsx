/**
 * Pagination.tsx
 *
 * PURPOSE: Reusable pagination controls component
 *
 * USAGE:
 * ```tsx
 * <Pagination
 *   page={page}
 *   totalPages={totalPages}
 *   onPageChange={setPage}
 *   hasNext={hasNext}
 *   hasPrev={hasPrev}
 * />
 * ```
 */
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PaginationProps {
  /** Current page (1-indexed) */
  page: number;
  /** Total number of pages */
  totalPages: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Whether there's a next page */
  hasNext?: boolean;
  /** Whether there's a previous page */
  hasPrev?: boolean;
  /** Show page size selector */
  showPageSizeSelector?: boolean;
  /** Current page size */
  pageSize?: number;
  /** Callback when page size changes */
  onPageSizeChange?: (size: number) => void;
  /** Available page sizes */
  pageSizeOptions?: number[];
  /** Total items count for display */
  totalItems?: number;
  /** Start index of current page */
  startIndex?: number;
  /** End index of current page */
  endIndex?: number;
  /** Additional class name */
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  hasNext = page < totalPages,
  hasPrev = page > 1,
  showPageSizeSelector = false,
  pageSize = 20,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  totalItems,
  startIndex,
  endIndex,
  className = '',
}: PaginationProps) {
  // Don't render if only one page
  if (totalPages <= 1 && !showPageSizeSelector) {
    return null;
  }

  const goToFirst = () => onPageChange(1);
  const goToLast = () => onPageChange(totalPages);
  const goToPrev = () => onPageChange(page - 1);
  const goToNext = () => onPageChange(page + 1);

  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      {/* Item count display */}
      <div className="text-sm text-muted-foreground">
        {totalItems !== undefined && startIndex !== undefined && endIndex !== undefined ? (
          <span>
            Showing {startIndex + 1}-{endIndex} of {totalItems}
          </span>
        ) : (
          <span>
            Page {page} of {totalPages}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Page size selector */}
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="w-[70px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={goToFirst}
            disabled={!hasPrev}
            title="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={goToPrev}
            disabled={!hasPrev}
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Page indicator */}
          <span className="px-2 text-sm font-medium min-w-[80px] text-center">
            {page} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={goToNext}
            disabled={!hasNext}
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={goToLast}
            disabled={!hasNext}
            title="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
