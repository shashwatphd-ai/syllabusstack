import type { RecommendationWithLinks } from '@/hooks/useRecommendations';

// Unique ID generator for tests
let idCounter = 0;
export function generateTestId(prefix = 'test'): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Date.now()}`;
}

// Reset ID counter between test suites
export function resetIdCounter() {
  idCounter = 0;
}

// Factory to create recommendation test data
export function createRecommendation(
  overrides: Partial<RecommendationWithLinks> = {}
): RecommendationWithLinks {
  const id = overrides.id || generateTestId('rec');
  const now = new Date().toISOString();

  return {
    id,
    user_id: 'test-user-id',
    dream_job_id: 'test-dream-job-id',
    gap_analysis_id: 'test-gap-analysis-id',
    title: `Test Recommendation ${id}`,
    description: 'This is a test recommendation description',
    type: 'course',
    priority: 'medium',
    status: 'pending',
    duration: '4 weeks',
    effort_hours: 20,
    cost_usd: 0,
    provider: 'Test Provider',
    url: null,
    gap_addressed: 'Test skill gap',
    why_this_matters: 'This skill is important for your career',
    steps: [
      { step: 'Step 1', description: 'Do the first thing' },
      { step: 'Step 2', description: 'Do the second thing' },
    ],
    evidence_created: 'Portfolio project',
    how_to_demonstrate: 'I built X using Y technology',
    deleted_at: null,
    created_at: now,
    updated_at: now,
    // Linked course fields
    linked_course_id: null,
    linked_course_title: null,
    enrollment_progress: null,
    ...overrides,
  };
}

// Factory for different recommendation states
export function createReadyToStartRecommendation(
  overrides: Partial<RecommendationWithLinks> = {}
): RecommendationWithLinks {
  return createRecommendation({
    type: 'course',
    url: 'https://example.com/course',
    status: 'pending',
    cost_usd: 0,
    ...overrides,
  });
}

export function createNeedsCourseRecommendation(
  overrides: Partial<RecommendationWithLinks> = {}
): RecommendationWithLinks {
  return createRecommendation({
    type: 'course',
    url: null,
    linked_course_id: null,
    status: 'pending',
    ...overrides,
  });
}

export function createLinkedCourseRecommendation(
  overrides: Partial<RecommendationWithLinks> = {}
): RecommendationWithLinks {
  return createRecommendation({
    type: 'course',
    url: null,
    linked_course_id: 'linked-course-id',
    linked_course_title: 'Enrolled Course Title',
    enrollment_progress: 45,
    status: 'in_progress',
    ...overrides,
  });
}

export function createCompletedRecommendation(
  overrides: Partial<RecommendationWithLinks> = {}
): RecommendationWithLinks {
  return createRecommendation({
    status: 'completed',
    ...overrides,
  });
}

export function createSkippedRecommendation(
  overrides: Partial<RecommendationWithLinks> = {}
): RecommendationWithLinks {
  return createRecommendation({
    status: 'skipped',
    ...overrides,
  });
}

// Factory for free vs paid recommendations
export function createFreeRecommendation(
  overrides: Partial<RecommendationWithLinks> = {}
): RecommendationWithLinks {
  return createRecommendation({
    type: 'course',
    cost_usd: 0,
    provider: 'Khan Academy',
    url: 'https://khanacademy.org/course',
    ...overrides,
  });
}

export function createPaidRecommendation(
  overrides: Partial<RecommendationWithLinks> = {}
): RecommendationWithLinks {
  return createRecommendation({
    type: 'course',
    cost_usd: 199,
    provider: 'Coursera',
    url: 'https://coursera.org/course',
    ...overrides,
  });
}

export function createUnknownPriceRecommendation(
  overrides: Partial<RecommendationWithLinks> = {}
): RecommendationWithLinks {
  return createRecommendation({
    type: 'course',
    cost_usd: null,
    provider: 'Various (Coursera, Udemy, edX)',
    url: null,
    ...overrides,
  });
}

// Create a batch of mixed recommendations
export function createRecommendationBatch(count: number = 5): RecommendationWithLinks[] {
  const factories = [
    createReadyToStartRecommendation,
    createNeedsCourseRecommendation,
    createLinkedCourseRecommendation,
    createFreeRecommendation,
    createPaidRecommendation,
  ];

  return Array.from({ length: count }, (_, i) => {
    const factory = factories[i % factories.length];
    return factory({ title: `Recommendation ${i + 1}` });
  });
}
