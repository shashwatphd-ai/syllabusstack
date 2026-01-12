/**
 * Price utilities for consistent pricing logic across the application.
 * 
 * IMPORTANT: This is the single source of truth for determining 
 * whether a recommendation is free, paid, or has unknown pricing.
 */

export interface PriceableItem {
  cost_usd?: number | null;
  price_known?: boolean;
}

/**
 * Returns true if the item is confirmed to be free.
 * An item is free only when cost_usd === 0 AND price_known is true.
 * 
 * @param item - The item to check
 * @returns true if confirmed free, false otherwise
 */
export function isPriceFree(item: PriceableItem): boolean {
  return item.cost_usd === 0 && item.price_known === true;
}

/**
 * Returns true if the item has a known paid price.
 * An item is paid when cost_usd > 0 (regardless of price_known).
 * 
 * @param item - The item to check
 * @returns true if paid, false otherwise
 */
export function isPricePaid(item: PriceableItem): boolean {
  return item.cost_usd !== null && item.cost_usd !== undefined && item.cost_usd > 0;
}

/**
 * Returns true if the item's pricing is unknown.
 * Pricing is unknown when:
 * - cost_usd is null/undefined
 * - OR cost_usd is 0 but price_known is not true (meaning we don't know if it's actually free)
 * 
 * @param item - The item to check
 * @returns true if price is unknown, false otherwise
 */
export function isPriceUnknown(item: PriceableItem): boolean {
  // If we have a positive price, we know it's paid (not unknown)
  if (isPricePaid(item)) return false;
  
  // If cost is 0 but price_known is true, it's confirmed free (not unknown)
  if (item.cost_usd === 0 && item.price_known === true) return false;
  
  // Otherwise, we don't know the price
  return true;
}

/**
 * Returns the price category for an item.
 * 
 * @param item - The item to check
 * @returns 'free' | 'paid' | 'unknown'
 */
export function getPriceCategory(item: PriceableItem): 'free' | 'paid' | 'unknown' {
  if (isPriceFree(item)) return 'free';
  if (isPricePaid(item)) return 'paid';
  return 'unknown';
}

/**
 * Formats a price for display.
 * 
 * @param item - The item to format
 * @returns A human-readable price string
 */
export function formatPrice(item: PriceableItem): string {
  if (isPriceFree(item)) return 'Free';
  if (isPricePaid(item)) return `$${item.cost_usd}`;
  return 'Check pricing';
}

/**
 * Counts items by price category.
 * 
 * @param items - Array of priceable items
 * @returns Object with counts for each category
 */
export function countByPriceCategory(items: PriceableItem[]): {
  free: number;
  paid: number;
  unknown: number;
  total: number;
} {
  return items.reduce(
    (acc, item) => {
      const category = getPriceCategory(item);
      acc[category] += 1;
      acc.total += 1;
      return acc;
    },
    { free: 0, paid: 0, unknown: 0, total: 0 }
  );
}
