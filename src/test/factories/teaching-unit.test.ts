import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockTeachingUnit,
  createMockTeachingUnitSequence,
  createQCATeachingUnits,
  resetTeachingUnitFactory,
} from './teaching-unit';

describe('Teaching Unit Factory', () => {
  beforeEach(() => {
    resetTeachingUnitFactory();
  });

  describe('createMockTeachingUnit', () => {
    it('creates a valid teaching unit with default values', () => {
      const unit = createMockTeachingUnit();

      expect(unit.id).toBeDefined();
      expect(unit.learning_objective_id).toBeDefined();
      expect(unit.sequence_order).toBe(1);
      expect(unit.title).toBe('Teaching Unit 1');
      expect(unit.what_to_teach).toBeTruthy();
      expect(unit.search_queries.length).toBeGreaterThan(0);
      expect(unit.status).toBe('pending');
    });

    it('allows overriding properties', () => {
      const unit = createMockTeachingUnit({
        title: 'Custom Title',
        status: 'approved',
        target_video_type: 'tutorial',
      });

      expect(unit.title).toBe('Custom Title');
      expect(unit.status).toBe('approved');
      expect(unit.target_video_type).toBe('tutorial');
    });

    it('increments sequence order for multiple units', () => {
      const unit1 = createMockTeachingUnit();
      const unit2 = createMockTeachingUnit();
      const unit3 = createMockTeachingUnit();

      expect(unit1.sequence_order).toBe(1);
      expect(unit2.sequence_order).toBe(2);
      expect(unit3.sequence_order).toBe(3);
    });
  });

  describe('createMockTeachingUnitSequence', () => {
    it('creates correctly sequenced units', () => {
      const loId = 'test-lo-id';
      const units = createMockTeachingUnitSequence(loId, 3);

      expect(units.length).toBe(3);
      expect(units.every(u => u.learning_objective_id === loId)).toBe(true);
      expect(units[0].sequence_order).toBe(1);
      expect(units[1].sequence_order).toBe(2);
      expect(units[2].sequence_order).toBe(3);
    });

    it('sets up prerequisite chain correctly', () => {
      const units = createMockTeachingUnitSequence('lo-id', 4);

      // First unit has no prerequisites
      expect(units[0].prerequisites).toEqual([]);

      // Each subsequent unit lists previous as prerequisite
      expect(units[1].prerequisites?.length).toBeGreaterThan(0);
      expect(units[2].prerequisites?.length).toBeGreaterThan(0);
    });
  });

  describe('createQCATeachingUnits', () => {
    it('creates a realistic QCA teaching unit sequence', () => {
      const units = createQCATeachingUnits('qca-lo-id');

      expect(units.length).toBe(4);
      
      // Verify expected topics are covered
      const titles = units.map(u => u.title.toLowerCase());
      expect(titles.some(t => t.includes('boolean'))).toBe(true);
      expect(titles.some(t => t.includes('set'))).toBe(true);
      expect(titles.some(t => t.includes('qca'))).toBe(true);
    });

    it('has specific search queries for each unit', () => {
      const units = createQCATeachingUnits('qca-lo-id');

      units.forEach(unit => {
        expect(unit.search_queries.length).toBeGreaterThanOrEqual(3);
        // Queries should be domain-specific, not just generic
        const hasSpecificQuery = unit.search_queries.some(
          q => !['tutorial', 'explained', 'introduction'].every(
            term => q.toLowerCase().includes(term)
          )
        );
        expect(hasSpecificQuery).toBe(true);
      });
    });

    it('has correct prerequisite ordering', () => {
      const units = createQCATeachingUnits('qca-lo-id');

      // Earlier units should not list later units as prerequisites
      units.forEach((unit, index) => {
        if (unit.prerequisites && unit.prerequisites.length > 0) {
          unit.prerequisites.forEach(prereq => {
            const prereqIndex = units.findIndex(u =>
              u.title.toLowerCase().includes(prereq.toLowerCase())
            );
            if (prereqIndex !== -1) {
              expect(prereqIndex).toBeLessThan(index);
            }
          });
        }
      });
    });
  });
});
