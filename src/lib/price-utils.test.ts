import { describe, it, expect } from 'vitest';
import {
  isPriceFree,
  isPricePaid,
  isPriceUnknown,
  getPriceCategory,
  formatPrice,
  countByPriceCategory,
} from '@/lib/price-utils';

describe('price-utils', () => {
  describe('isPriceFree', () => {
    it('returns true when cost_usd is 0 AND price_known is true', () => {
      expect(isPriceFree({ cost_usd: 0, price_known: true })).toBe(true);
    });

    it('returns false when cost_usd is 0 but price_known is false', () => {
      expect(isPriceFree({ cost_usd: 0, price_known: false })).toBe(false);
    });

    it('returns false when cost_usd is 0 but price_known is undefined', () => {
      expect(isPriceFree({ cost_usd: 0 })).toBe(false);
    });

    it('returns false when cost_usd is null', () => {
      expect(isPriceFree({ cost_usd: null, price_known: true })).toBe(false);
    });

    it('returns false when cost_usd is positive', () => {
      expect(isPriceFree({ cost_usd: 199, price_known: true })).toBe(false);
    });
  });

  describe('isPricePaid', () => {
    it('returns true when cost_usd is positive', () => {
      expect(isPricePaid({ cost_usd: 199 })).toBe(true);
      expect(isPricePaid({ cost_usd: 1 })).toBe(true);
      expect(isPricePaid({ cost_usd: 9999 })).toBe(true);
    });

    it('returns false when cost_usd is 0', () => {
      expect(isPricePaid({ cost_usd: 0 })).toBe(false);
    });

    it('returns false when cost_usd is null', () => {
      expect(isPricePaid({ cost_usd: null })).toBe(false);
    });

    it('returns false when cost_usd is undefined', () => {
      expect(isPricePaid({})).toBe(false);
    });
  });

  describe('isPriceUnknown', () => {
    it('returns true when cost_usd is null', () => {
      expect(isPriceUnknown({ cost_usd: null })).toBe(true);
    });

    it('returns true when cost_usd is undefined', () => {
      expect(isPriceUnknown({})).toBe(true);
    });

    it('returns true when cost_usd is 0 but price_known is false', () => {
      expect(isPriceUnknown({ cost_usd: 0, price_known: false })).toBe(true);
    });

    it('returns true when cost_usd is 0 but price_known is undefined', () => {
      expect(isPriceUnknown({ cost_usd: 0 })).toBe(true);
    });

    it('returns false when cost_usd is 0 AND price_known is true', () => {
      expect(isPriceUnknown({ cost_usd: 0, price_known: true })).toBe(false);
    });

    it('returns false when cost_usd is positive', () => {
      expect(isPriceUnknown({ cost_usd: 199 })).toBe(false);
    });
  });

  describe('getPriceCategory', () => {
    it('returns "free" for confirmed free items', () => {
      expect(getPriceCategory({ cost_usd: 0, price_known: true })).toBe('free');
    });

    it('returns "paid" for items with positive cost', () => {
      expect(getPriceCategory({ cost_usd: 199 })).toBe('paid');
    });

    it('returns "unknown" for null cost', () => {
      expect(getPriceCategory({ cost_usd: null })).toBe('unknown');
    });

    it('returns "unknown" for cost 0 without price_known', () => {
      expect(getPriceCategory({ cost_usd: 0 })).toBe('unknown');
    });
  });

  describe('formatPrice', () => {
    it('returns "Free" for confirmed free items', () => {
      expect(formatPrice({ cost_usd: 0, price_known: true })).toBe('Free');
    });

    it('returns formatted price for paid items', () => {
      expect(formatPrice({ cost_usd: 199 })).toBe('$199');
    });

    it('returns "Check pricing" for unknown pricing', () => {
      expect(formatPrice({ cost_usd: null })).toBe('Check pricing');
      expect(formatPrice({ cost_usd: 0 })).toBe('Check pricing');
    });
  });

  describe('countByPriceCategory', () => {
    it('correctly counts items by price category', () => {
      const items = [
        { cost_usd: 0, price_known: true }, // free
        { cost_usd: 0, price_known: true }, // free
        { cost_usd: 199 },                   // paid
        { cost_usd: null },                  // unknown
        { cost_usd: 0 },                     // unknown (no price_known)
      ];

      const result = countByPriceCategory(items);
      expect(result).toEqual({
        free: 2,
        paid: 1,
        unknown: 2,
        total: 5,
      });
    });

    it('handles empty array', () => {
      expect(countByPriceCategory([])).toEqual({
        free: 0,
        paid: 0,
        unknown: 0,
        total: 0,
      });
    });
  });
});
