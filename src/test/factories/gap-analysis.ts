// Factory for gap analysis test data

export interface CriticalGap {
  job_requirement: string;
  your_evidence: string;
  impact: string;
  gap_severity?: string;
}

export interface PriorityGap {
  gap?: string;
  requirement?: string;
  reason?: string;
  priority?: string;
}

export interface StrongOverlap {
  requirement: string;
  evidence: string;
  strength?: string;
}

export interface PartialOverlap {
  requirement: string;
  current_level: string;
  gap_to_close: string;
}

export interface GapAnalysis {
  id: string;
  user_id: string;
  dream_job_id: string;
  match_score: number;
  strong_overlaps: StrongOverlap[];
  partial_overlaps: PartialOverlap[];
  critical_gaps: CriticalGap[];
  priority_gaps: PriorityGap[];
  honest_assessment: string;
  readiness_level: string;
  created_at: string;
  updated_at: string;
}

// Factory functions
export function createCriticalGap(overrides: Partial<CriticalGap> = {}): CriticalGap {
  return {
    job_requirement: 'Advanced data analysis skills',
    your_evidence: 'Limited coursework in this area',
    impact: 'Essential for day-to-day responsibilities',
    gap_severity: 'high',
    ...overrides,
  };
}

export function createPriorityGap(overrides: Partial<PriorityGap> = {}): PriorityGap {
  return {
    gap: 'Project management experience',
    requirement: 'Project management experience',
    reason: 'Needed for team coordination',
    priority: 'medium',
    ...overrides,
  };
}

export function createStrongOverlap(overrides: Partial<StrongOverlap> = {}): StrongOverlap {
  return {
    requirement: 'Programming fundamentals',
    evidence: 'CS101 and CS201 coursework with A grades',
    strength: 'strong',
    ...overrides,
  };
}

export function createPartialOverlap(overrides: Partial<PartialOverlap> = {}): PartialOverlap {
  return {
    requirement: 'Database design',
    current_level: 'Basic SQL knowledge',
    gap_to_close: 'Need advanced query optimization and NoSQL experience',
    ...overrides,
  };
}

export function createGapAnalysis(overrides: Partial<GapAnalysis> = {}): GapAnalysis {
  const now = new Date().toISOString();
  return {
    id: 'test-gap-analysis-id',
    user_id: 'test-user-id',
    dream_job_id: 'test-dream-job-id',
    match_score: 65,
    strong_overlaps: [createStrongOverlap()],
    partial_overlaps: [createPartialOverlap()],
    critical_gaps: [createCriticalGap()],
    priority_gaps: [createPriorityGap()],
    honest_assessment: 'You have a solid foundation but need to fill some critical gaps.',
    readiness_level: 'building_foundation',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

// Create gap analysis with only critical gaps
export function createCriticalOnlyGapAnalysis(): GapAnalysis {
  return createGapAnalysis({
    critical_gaps: [
      createCriticalGap({ job_requirement: 'Machine Learning' }),
      createCriticalGap({ job_requirement: 'Cloud Infrastructure' }),
    ],
    priority_gaps: [],
  });
}

// Create gap analysis with only priority gaps
export function createPriorityOnlyGapAnalysis(): GapAnalysis {
  return createGapAnalysis({
    critical_gaps: [],
    priority_gaps: [
      createPriorityGap({ gap: 'Leadership skills' }),
      createPriorityGap({ gap: 'Public speaking' }),
    ],
  });
}

// Create gap analysis with both gap types
export function createMixedGapAnalysis(): GapAnalysis {
  return createGapAnalysis({
    critical_gaps: [
      createCriticalGap({ job_requirement: 'System Design' }),
    ],
    priority_gaps: [
      createPriorityGap({ gap: 'Agile methodology' }),
      createPriorityGap({ gap: 'Technical writing' }),
    ],
  });
}

// Create empty gap analysis (no gaps)
export function createNoGapsAnalysis(): GapAnalysis {
  return createGapAnalysis({
    match_score: 95,
    critical_gaps: [],
    priority_gaps: [],
    strong_overlaps: [
      createStrongOverlap({ requirement: 'All required skills' }),
    ],
    honest_assessment: "You're well-prepared for this role!",
    readiness_level: 'ready',
  });
}
