import { useState, useCallback, useMemo } from 'react';

export interface UseBulkSelectionReturn<T extends string = string> {
  /** Set of currently selected item IDs */
  selectedItems: Set<T>;
  /** Whether selection mode is active */
  isSelectionMode: boolean;
  /** Number of selected items */
  selectedCount: number;
  /** Toggle selection for a single item */
  toggleSelection: (id: T) => void;
  /** Select all provided items */
  selectAll: (ids: T[]) => void;
  /** Clear all selections and exit selection mode */
  clearSelection: () => void;
  /** Enter selection mode (without selecting anything) */
  enterSelectionMode: () => void;
  /** Exit selection mode (clears selections) */
  exitSelectionMode: () => void;
  /** Check if an item is selected */
  isSelected: (id: T) => boolean;
  /** Check if all provided items are selected */
  isAllSelected: (ids: T[]) => boolean;
  /** Get selected items as an array */
  selectedArray: T[];
}

/**
 * Reusable hook for bulk selection functionality
 * Consolidates duplicate selection logic from multiple pages
 *
 * @example
 * const {
 *   selectedItems,
 *   isSelectionMode,
 *   toggleSelection,
 *   selectAll,
 *   clearSelection,
 *   isAllSelected
 * } = useBulkSelection<string>();
 *
 * // In your component:
 * <Button onClick={() => toggleSelection(item.id)}>
 *   {isSelected(item.id) ? 'Deselect' : 'Select'}
 * </Button>
 */
export function useBulkSelection<T extends string = string>(): UseBulkSelectionReturn<T> {
  const [selectedItems, setSelectedItems] = useState<Set<T>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleSelection = useCallback((id: T) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: T[]) => {
    setSelectedItems(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
    setIsSelectionMode(false);
  }, []);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectedItems(new Set());
    setIsSelectionMode(false);
  }, []);

  const isSelected = useCallback((id: T) => {
    return selectedItems.has(id);
  }, [selectedItems]);

  const isAllSelected = useCallback((ids: T[]) => {
    if (ids.length === 0) return false;
    return ids.every(id => selectedItems.has(id));
  }, [selectedItems]);

  const selectedCount = useMemo(() => selectedItems.size, [selectedItems]);

  const selectedArray = useMemo(() => Array.from(selectedItems), [selectedItems]);

  return {
    selectedItems,
    isSelectionMode,
    selectedCount,
    toggleSelection,
    selectAll,
    clearSelection,
    enterSelectionMode,
    exitSelectionMode,
    isSelected,
    isAllSelected,
    selectedArray,
  };
}
