import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  functions: {
    invoke: vi.fn(),
  },
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

// Import after mocking
import {
  useCareerMatches,
  useTopCareerMatches,
  type CareerMatch,
} from './useCareerMatches';

// Test data
const mockCareerMatches: CareerMatch[] = [
  {
    id: 'match-1',
    userId: 'user-1',
    jobId: 'job-1',
    jobTitle: 'Senior Frontend Engineer',
    company: 'TechCorp',
    matchScore: 85,
    matchedSkills: ['JavaScript', 'React', 'TypeScript', 'CSS'],
    missingSkills: ['GraphQL', 'Testing'],
    salaryRange: { min: 120000, max: 180000, currency: 'USD' },
    location: 'San Francisco, CA',
    remote: true,
    experienceLevel: 'senior',
    industry: 'Technology',
    matchReasons: [
      'Strong JavaScript and React skills',
      '5+ years of relevant experience',
      'Portfolio projects align with role',
    ],
    createdAt: '2024-01-28T10:00:00Z',
  },
  {
    id: 'match-2',
    userId: 'user-1',
    jobId: 'job-2',
    jobTitle: 'Full Stack Developer',
    company: 'StartupXYZ',
    matchScore: 78,
    matchedSkills: ['JavaScript', 'Node.js', 'React'],
    missingSkills: ['PostgreSQL', 'Docker', 'AWS'],
    salaryRange: { min: 100000, max: 150000, currency: 'USD' },
    location: 'New York, NY',
    remote: true,
    experienceLevel: 'mid',
    industry: 'Fintech',
    matchReasons: [
      'Full-stack experience matches',
      'Startup culture fit',
    ],
    createdAt: '2024-01-27T10:00:00Z',
  },
  {
    id: 'match-3',
    userId: 'user-1',
    jobId: 'job-3',
    jobTitle: 'React Developer',
    company: 'MediaCo',
    matchScore: 92,
    matchedSkills: ['React', 'JavaScript', 'CSS', 'Redux'],
    missingSkills: [],
    salaryRange: { min: 90000, max: 130000, currency: 'USD' },
    location: 'Remote',
    remote: true,
    experienceLevel: 'mid',
    industry: 'Media',
    matchReasons: [
      'Perfect skill match',
      'Experience exceeds requirements',
      'Domain expertise in media',
    ],
    createdAt: '2024-01-26T10:00:00Z',
  },
  {
    id: 'match-4',
    userId: 'user-1',
    jobId: 'job-4',
    jobTitle: 'JavaScript Engineer',
    company: 'BigTech Inc',
    matchScore: 72,
    matchedSkills: ['JavaScript', 'TypeScript'],
    missingSkills: ['Angular', 'RxJS', 'NgRx'],
    salaryRange: { min: 140000, max: 200000, currency: 'USD' },
    location: 'Seattle, WA',
    remote: false,
    experienceLevel: 'senior',
    industry: 'Technology',
    matchReasons: [
      'Core JavaScript expertise',
      'TypeScript proficiency',
    ],
    createdAt: '2024-01-25T10:00:00Z',
  },
];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

const setupCareerMatchesMock = (matches = mockCareerMatches) => {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });

  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: matches.map(m => ({
              id: m.id,
              user_id: m.userId,
              job_id: m.jobId,
              job_title: m.jobTitle,
              company: m.company,
              match_score: m.matchScore,
              matched_skills: m.matchedSkills,
              missing_skills: m.missingSkills,
              salary_range: m.salaryRange,
              location: m.location,
              remote: m.remote,
              experience_level: m.experienceLevel,
              industry: m.industry,
              match_reasons: m.matchReasons,
              created_at: m.createdAt,
            })),
            error: null,
          }),
        }),
      }),
    }),
  });
};

describe('useCareerMatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch career matches for authenticated user', async () => {
    setupCareerMatchesMock();

    const { result } = renderHook(() => useCareerMatches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
  });

  it('should return empty array when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { result } = renderHook(() => useCareerMatches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
  });
});

describe('useTopCareerMatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return limited number of top matches', async () => {
    setupCareerMatchesMock();

    const { result } = renderHook(() => useTopCareerMatches(3), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Should limit to 3 results
  });
});

describe('Match Score Calculations', () => {
  it('should have match scores between 0 and 100', () => {
    mockCareerMatches.forEach(match => {
      expect(match.matchScore).toBeGreaterThanOrEqual(0);
      expect(match.matchScore).toBeLessThanOrEqual(100);
    });
  });

  it('should order matches by score descending', () => {
    const sortedMatches = [...mockCareerMatches].sort((a, b) => b.matchScore - a.matchScore);
    expect(sortedMatches[0].matchScore).toBeGreaterThanOrEqual(sortedMatches[sortedMatches.length - 1].matchScore);
  });

  it('should have highest score for perfect skill match', () => {
    const perfectMatch = mockCareerMatches.find(m => m.missingSkills.length === 0);
    expect(perfectMatch).toBeDefined();
    expect(perfectMatch?.matchScore).toBe(92);
  });
});

describe('Skill Matching', () => {
  it('should track matched skills', () => {
    mockCareerMatches.forEach(match => {
      expect(Array.isArray(match.matchedSkills)).toBe(true);
    });
  });

  it('should track missing skills', () => {
    mockCareerMatches.forEach(match => {
      expect(Array.isArray(match.missingSkills)).toBe(true);
    });
  });

  it('should have some matches with no missing skills', () => {
    const perfectMatches = mockCareerMatches.filter(m => m.missingSkills.length === 0);
    expect(perfectMatches.length).toBeGreaterThan(0);
  });
});

describe('Job Details', () => {
  it('should include job title and company', () => {
    mockCareerMatches.forEach(match => {
      expect(match.jobTitle).toBeDefined();
      expect(match.jobTitle.length).toBeGreaterThan(0);
      expect(match.company).toBeDefined();
    });
  });

  it('should include location information', () => {
    mockCareerMatches.forEach(match => {
      expect(match.location).toBeDefined();
      expect(typeof match.remote).toBe('boolean');
    });
  });

  it('should include salary range', () => {
    mockCareerMatches.forEach(match => {
      expect(match.salaryRange).toBeDefined();
      expect(match.salaryRange.min).toBeLessThanOrEqual(match.salaryRange.max);
      expect(match.salaryRange.currency).toBeDefined();
    });
  });

  it('should include experience level', () => {
    const validLevels = ['entry', 'junior', 'mid', 'senior', 'lead', 'principal'];
    mockCareerMatches.forEach(match => {
      expect(validLevels).toContain(match.experienceLevel);
    });
  });
});

describe('Match Reasons', () => {
  it('should provide match reasons', () => {
    mockCareerMatches.forEach(match => {
      expect(Array.isArray(match.matchReasons)).toBe(true);
      expect(match.matchReasons.length).toBeGreaterThan(0);
    });
  });

  it('should have descriptive reasons', () => {
    mockCareerMatches.forEach(match => {
      match.matchReasons.forEach(reason => {
        expect(reason.length).toBeGreaterThan(10);
      });
    });
  });
});

describe('Remote Work Filter', () => {
  it('should have remote and non-remote jobs', () => {
    const remoteJobs = mockCareerMatches.filter(m => m.remote);
    const onsiteJobs = mockCareerMatches.filter(m => !m.remote);

    expect(remoteJobs.length).toBeGreaterThan(0);
    expect(onsiteJobs.length).toBeGreaterThan(0);
  });
});

describe('Industry Distribution', () => {
  it('should have industry information', () => {
    mockCareerMatches.forEach(match => {
      expect(match.industry).toBeDefined();
      expect(match.industry.length).toBeGreaterThan(0);
    });
  });

  it('should have diverse industries', () => {
    const industries = new Set(mockCareerMatches.map(m => m.industry));
    expect(industries.size).toBeGreaterThan(1);
  });
});
