import { TeachingUnit } from '@/hooks/useTeachingUnits';

let teachingUnitCounter = 0;

/**
 * Factory to create mock TeachingUnit data for tests
 */
export function createMockTeachingUnit(overrides: Partial<TeachingUnit> = {}): TeachingUnit {
  teachingUnitCounter++;
  
  return {
    id: `tu-${teachingUnitCounter}`,
    learning_objective_id: `lo-${Math.floor(Math.random() * 1000)}`,
    sequence_order: teachingUnitCounter,
    title: `Teaching Unit ${teachingUnitCounter}`,
    description: 'A mock teaching unit for testing',
    what_to_teach: 'Key concepts to cover in this unit',
    why_this_matters: 'Understanding this helps build foundation',
    how_to_teach: 'Use examples and demonstrations',
    common_misconceptions: ['Common misconception 1', 'Common misconception 2'],
    prerequisites: ['Basic prerequisite'],
    enables: ['Advanced topic'],
    target_video_type: 'explainer',
    target_duration_minutes: 10,
    search_queries: ['query 1', 'query 2', 'query 3'],
    required_concepts: ['concept A', 'concept B'],
    avoid_terms: ['avoid this term'],
    status: 'pending',
    videos_found_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create multiple teaching units with correct sequencing
 */
export function createMockTeachingUnitSequence(
  learningObjectiveId: string,
  count: number = 3
): TeachingUnit[] {
  return Array.from({ length: count }, (_, index) =>
    createMockTeachingUnit({
      learning_objective_id: learningObjectiveId,
      sequence_order: index + 1,
      title: `Unit ${index + 1}: ${getSequenceTitles()[index] || `Topic ${index + 1}`}`,
      prerequisites: index > 0 ? [getSequenceTitles()[index - 1]] : [],
      enables: index < count - 1 ? [getSequenceTitles()[index + 1]] : [],
    })
  );
}

function getSequenceTitles(): string[] {
  return [
    'Boolean Algebra Basics',
    'Set Theory Fundamentals',
    'Truth Tables and Logic Gates',
    'Set Operations and Membership',
    'Introduction to QCA',
  ];
}

/**
 * Create a QCA-specific teaching unit sequence (realistic example)
 */
export function createQCATeachingUnits(learningObjectiveId: string): TeachingUnit[] {
  return [
    createMockTeachingUnit({
      learning_objective_id: learningObjectiveId,
      sequence_order: 1,
      title: 'Boolean Algebra Basics',
      what_to_teach: 'AND, OR, NOT operations and truth tables',
      target_video_type: 'explainer',
      target_duration_minutes: 8,
      search_queries: [
        'boolean algebra basics explained',
        'AND OR NOT logic tutorial',
        'truth tables introduction',
      ],
      prerequisites: [],
      enables: ['Set Operations'],
    }),
    createMockTeachingUnit({
      learning_objective_id: learningObjectiveId,
      sequence_order: 2,
      title: 'Set Theory Fundamentals',
      what_to_teach: 'Sets, membership, union, intersection, complement',
      target_video_type: 'explainer',
      target_duration_minutes: 10,
      search_queries: [
        'set theory fundamentals',
        'sets union intersection explained',
        'set membership mathematics',
      ],
      prerequisites: ['Boolean Algebra Basics'],
      enables: ['Fuzzy Sets'],
    }),
    createMockTeachingUnit({
      learning_objective_id: learningObjectiveId,
      sequence_order: 3,
      title: 'Fuzzy Sets and Membership Functions',
      what_to_teach: 'Partial membership, calibration, fuzzy set operations',
      target_video_type: 'tutorial',
      target_duration_minutes: 12,
      search_queries: [
        'fuzzy sets introduction',
        'fuzzy membership functions explained',
        'fuzzy set calibration tutorial',
      ],
      prerequisites: ['Set Theory Fundamentals'],
      enables: ['fsQCA'],
    }),
    createMockTeachingUnit({
      learning_objective_id: learningObjectiveId,
      sequence_order: 4,
      title: 'Qualitative Comparative Analysis (QCA)',
      what_to_teach: 'QCA methodology, truth table analysis, necessity and sufficiency',
      target_video_type: 'lecture',
      target_duration_minutes: 15,
      search_queries: [
        'qualitative comparative analysis explained',
        'QCA methodology tutorial',
        'necessity sufficiency QCA',
      ],
      prerequisites: ['Fuzzy Sets and Membership Functions'],
      enables: [],
    }),
  ];
}

/**
 * Reset counter for test isolation
 */
export function resetTeachingUnitFactory() {
  teachingUnitCounter = 0;
}
