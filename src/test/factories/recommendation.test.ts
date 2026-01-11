import { describe, it, expect } from 'vitest';
import {
  createRecommendation,
  createReadyToStartRecommendation,
  createNeedsCourseRecommendation,
  createLinkedCourseRecommendation,
  createFreeRecommendation,
  createPaidRecommendation,
  createUnknownPriceRecommendation,
  createRecommendationBatch,
} from '@/test/factories/recommendation';

describe('Recommendation Factory', () => {
  describe('createRecommendation', () => {
    it('creates a valid recommendation with defaults', () => {
      const rec = createRecommendation();

      expect(rec.id).toBeDefined();
      expect(rec.user_id).toBe('test-user-id');
      expect(rec.title).toContain('Test Recommendation');
      expect(rec.type).toBe('course');
      expect(rec.status).toBe('pending');
    });

    it('allows overriding fields', () => {
      const rec = createRecommendation({
        title: 'Custom Title',
        status: 'completed',
        cost_usd: 199,
      });

      expect(rec.title).toBe('Custom Title');
      expect(rec.status).toBe('completed');
      expect(rec.cost_usd).toBe(199);
    });
  });

  describe('state-specific factories', () => {
    it('createReadyToStartRecommendation has a URL', () => {
      const rec = createReadyToStartRecommendation();

      expect(rec.url).toBeTruthy();
      expect(rec.status).toBe('pending');
      expect(rec.type).toBe('course');
    });

    it('createNeedsCourseRecommendation has no URL and no linked course', () => {
      const rec = createNeedsCourseRecommendation();

      expect(rec.url).toBeNull();
      expect(rec.linked_course_id).toBeNull();
      expect(rec.type).toBe('course');
    });

    it('createLinkedCourseRecommendation has linked course data', () => {
      const rec = createLinkedCourseRecommendation();

      expect(rec.linked_course_id).toBeTruthy();
      expect(rec.linked_course_title).toBeTruthy();
      expect(rec.enrollment_progress).toBeDefined();
      expect(rec.status).toBe('in_progress');
    });
  });

  describe('price-specific factories', () => {
    it('createFreeRecommendation has cost_usd of 0', () => {
      const rec = createFreeRecommendation();

      expect(rec.cost_usd).toBe(0);
      expect(rec.url).toBeTruthy(); // Has URL since it's a real course
    });

    it('createPaidRecommendation has positive cost_usd', () => {
      const rec = createPaidRecommendation();

      expect(rec.cost_usd).toBeGreaterThan(0);
      expect(rec.url).toBeTruthy();
    });

    it('createUnknownPriceRecommendation has null cost_usd', () => {
      const rec = createUnknownPriceRecommendation();

      expect(rec.cost_usd).toBeNull();
      expect(rec.url).toBeNull();
    });
  });

  describe('createRecommendationBatch', () => {
    it('creates specified number of recommendations', () => {
      const batch = createRecommendationBatch(10);

      expect(batch).toHaveLength(10);
      batch.forEach((rec, i) => {
        expect(rec.title).toContain(`Recommendation ${i + 1}`);
      });
    });

    it('creates mix of different types', () => {
      const batch = createRecommendationBatch(5);

      // Should have at least one with URL and one without
      const withUrl = batch.filter((r) => r.url !== null);
      const withoutUrl = batch.filter((r) => r.url === null);

      expect(withUrl.length).toBeGreaterThan(0);
      expect(withoutUrl.length).toBeGreaterThan(0);
    });
  });
});
