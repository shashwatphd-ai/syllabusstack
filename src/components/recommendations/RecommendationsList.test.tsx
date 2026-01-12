import { describe, it, expect } from 'vitest';
import { isPriceFree, isPricePaid, isPriceUnknown, countByPriceCategory } from '@/lib/price-utils';
import {
  createFreeRecommendation,
  createPaidRecommendation,
  createUnknownPriceRecommendation,
} from '@/test/factories/recommendation';

/**
 * Tests for RecommendationsList price filtering logic.
 * These test the core filtering functions used by the component.
 */
describe('RecommendationsList Price Filtering', () => {
  describe('isPriceFree', () => {
    it('returns true for cost_usd=0 and price_known=true', () => {
      const rec = createFreeRecommendation();
      expect(isPriceFree(rec)).toBe(true);
    });

    it('returns false for cost_usd=0 and price_known=false', () => {
      const rec = createFreeRecommendation({ price_known: false });
      expect(isPriceFree(rec)).toBe(false);
    });

    it('returns false for cost_usd=null', () => {
      const rec = createUnknownPriceRecommendation();
      expect(isPriceFree(rec)).toBe(false);
    });

    it('returns false for paid courses', () => {
      const rec = createPaidRecommendation();
      expect(isPriceFree(rec)).toBe(false);
    });
  });

  describe('isPricePaid', () => {
    it('returns true for cost_usd > 0', () => {
      const rec = createPaidRecommendation();
      expect(isPricePaid(rec)).toBe(true);
    });

    it('returns false for free courses', () => {
      const rec = createFreeRecommendation();
      expect(isPricePaid(rec)).toBe(false);
    });

    it('returns false for unknown price', () => {
      const rec = createUnknownPriceRecommendation();
      expect(isPricePaid(rec)).toBe(false);
    });
  });

  describe('isPriceUnknown', () => {
    it('returns true for cost_usd=null and price_known=false', () => {
      const rec = createUnknownPriceRecommendation();
      expect(isPriceUnknown(rec)).toBe(true);
    });

    it('returns true for cost_usd=0 and price_known=false (unconfirmed free)', () => {
      const rec = createFreeRecommendation({ price_known: false });
      expect(isPriceUnknown(rec)).toBe(true);
    });

    it('returns false for confirmed free', () => {
      const rec = createFreeRecommendation();
      expect(isPriceUnknown(rec)).toBe(false);
    });

    it('returns false for paid', () => {
      const rec = createPaidRecommendation();
      expect(isPriceUnknown(rec)).toBe(false);
    });
  });

  describe('countByPriceCategory', () => {
    it('correctly counts mixed items', () => {
      const items = [
        createFreeRecommendation(),
        createFreeRecommendation(),
        createPaidRecommendation(),
        createUnknownPriceRecommendation(),
        createUnknownPriceRecommendation(),
        createUnknownPriceRecommendation(),
      ];

      const counts = countByPriceCategory(items);

      expect(counts.free).toBe(2);
      expect(counts.paid).toBe(1);
      expect(counts.unknown).toBe(3);
      expect(counts.total).toBe(6);
    });

    it('handles empty array', () => {
      const counts = countByPriceCategory([]);
      expect(counts.free).toBe(0);
      expect(counts.paid).toBe(0);
      expect(counts.unknown).toBe(0);
      expect(counts.total).toBe(0);
    });
  });

  describe('Price filter simulation', () => {
    const recommendations = [
      createFreeRecommendation({ title: 'Free Course 1' }),
      createFreeRecommendation({ title: 'Free Course 2' }),
      createPaidRecommendation({ title: 'Paid Course 1' }),
      createUnknownPriceRecommendation({ title: 'Unknown Course 1' }),
    ];

    it('filters to show only free courses', () => {
      const filtered = recommendations.filter(r => r.type === 'course' && isPriceFree(r));
      expect(filtered).toHaveLength(2);
      expect(filtered.every(r => r.title.includes('Free'))).toBe(true);
    });

    it('filters to show only paid courses', () => {
      const filtered = recommendations.filter(r => r.type === 'course' && isPricePaid(r));
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Paid Course 1');
    });

    it('filters to show only unknown price courses', () => {
      const filtered = recommendations.filter(r => r.type === 'course' && isPriceUnknown(r));
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Unknown Course 1');
    });

    it('shows all courses when no filter', () => {
      const filtered = recommendations.filter(r => r.type === 'course');
      expect(filtered).toHaveLength(4);
    });
  });

  describe('Free First sorting', () => {
    it('sorts confirmed free courses first', () => {
      const recommendations = [
        createPaidRecommendation({ title: 'Paid 1' }),
        createFreeRecommendation({ title: 'Free 1' }),
        createUnknownPriceRecommendation({ title: 'Unknown 1' }),
        createFreeRecommendation({ title: 'Free 2' }),
      ];

      const sorted = [...recommendations].sort((a, b) => {
        if (a.type === 'course' && b.type === 'course') {
          const aFree = isPriceFree(a);
          const bFree = isPriceFree(b);
          if (aFree && !bFree) return -1;
          if (!aFree && bFree) return 1;
        }
        return 0;
      });

      // First two should be free
      expect(isPriceFree(sorted[0])).toBe(true);
      expect(isPriceFree(sorted[1])).toBe(true);
      // Unknown price should NOT be treated as free
      expect(sorted[2].title).toBe('Paid 1');
      expect(sorted[3].title).toBe('Unknown 1');
    });
  });
});
