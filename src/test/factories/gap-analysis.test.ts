import { describe, it, expect } from 'vitest';
import {
  createCriticalGap,
  createPriorityGap,
  createGapAnalysis,
  createCriticalOnlyGapAnalysis,
  createPriorityOnlyGapAnalysis,
  createMixedGapAnalysis,
  createNoGapsAnalysis,
} from '@/test/factories/gap-analysis';

describe('Gap Analysis Factory', () => {
  describe('createCriticalGap', () => {
    it('creates a valid critical gap', () => {
      const gap = createCriticalGap();

      expect(gap.job_requirement).toBeTruthy();
      expect(gap.your_evidence).toBeTruthy();
      expect(gap.impact).toBeTruthy();
    });

    it('allows overriding fields', () => {
      const gap = createCriticalGap({ job_requirement: 'Machine Learning' });

      expect(gap.job_requirement).toBe('Machine Learning');
    });
  });

  describe('createPriorityGap', () => {
    it('creates a valid priority gap', () => {
      const gap = createPriorityGap();

      expect(gap.gap || gap.requirement).toBeTruthy();
    });
  });

  describe('createGapAnalysis', () => {
    it('creates a complete gap analysis', () => {
      const analysis = createGapAnalysis();

      expect(analysis.id).toBeDefined();
      expect(analysis.match_score).toBeDefined();
      expect(analysis.strong_overlaps).toHaveLength(1);
      expect(analysis.critical_gaps).toHaveLength(1);
      expect(analysis.priority_gaps).toHaveLength(1);
    });
  });

  describe('specialized factories', () => {
    it('createCriticalOnlyGapAnalysis has only critical gaps', () => {
      const analysis = createCriticalOnlyGapAnalysis();

      expect(analysis.critical_gaps.length).toBeGreaterThan(0);
      expect(analysis.priority_gaps).toHaveLength(0);
    });

    it('createPriorityOnlyGapAnalysis has only priority gaps', () => {
      const analysis = createPriorityOnlyGapAnalysis();

      expect(analysis.critical_gaps).toHaveLength(0);
      expect(analysis.priority_gaps.length).toBeGreaterThan(0);
    });

    it('createMixedGapAnalysis has both gap types', () => {
      const analysis = createMixedGapAnalysis();

      expect(analysis.critical_gaps.length).toBeGreaterThan(0);
      expect(analysis.priority_gaps.length).toBeGreaterThan(0);
    });

    it('createNoGapsAnalysis has no gaps and high score', () => {
      const analysis = createNoGapsAnalysis();

      expect(analysis.critical_gaps).toHaveLength(0);
      expect(analysis.priority_gaps).toHaveLength(0);
      expect(analysis.match_score).toBeGreaterThanOrEqual(90);
    });
  });
});
