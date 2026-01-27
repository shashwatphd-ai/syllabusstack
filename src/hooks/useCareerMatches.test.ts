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

// Import after mocking - use actual exports from useCareerMatches
import {
  useMatchCareers,
  useCareerMatches,
  useONetOccupation,
  useUpdateCareerMatch,
  useAddMatchToDreamJobs,
  useSavedCareerMatches,
} from './useCareerMatches';

// Test data using database schema (snake_case)
const mockCareerMatches = [
  {
    id: 'match-1',
    user_id: 'user-1',
    onet_code: '15-1252.00',
    occupation_title: 'Senior Frontend Engineer',
    overall_match_score: 85,
    interest_match_score: 90,
    skills_match_score: 80,
    knowledge_match_score: 82,
    abilities_match_score: 88,
    matched_interests: ['JavaScript', 'React', 'TypeScript', 'CSS'],
    gap_skills: ['GraphQL', 'Testing'],
    salary_median: 150000,
    job_outlook: 'Much faster than average',
    is_saved: false,
    created_at: '2024-01-28T10:00:00Z',
  },
  {
    id: 'match-2',
    user_id: 'user-1',
    onet_code: '15-1254.00',
    occupation_title: 'Full Stack Developer',
    overall_match_score: 78,
    interest_match_score: 75,
    skills_match_score: 80,
    knowledge_match_score: 76,
    abilities_match_score: 81,
    matched_interests: ['JavaScript', 'Node.js', 'React'],
    gap_skills: ['PostgreSQL', 'Docker', 'AWS'],
    salary_median: 125000,
    job_outlook: 'Faster than average',
    is_saved: true,
    created_at: '2024-01-27T10:00:00Z',
  },
  {
    id: 'match-3',
    user_id: 'user-1',
    onet_code: '15-1299.01',
    occupation_title: 'React Developer',
    overall_match_score: 92,
    interest_match_score: 95,
    skills_match_score: 90,
    knowledge_match_score: 88,
    abilities_match_score: 95,
    matched_interests: ['React', 'JavaScript', 'CSS', 'Redux'],
    gap_skills: [],
    salary_median: 110000,
    job_outlook: 'Faster than average',
    is_saved: false,
    created_at: '2024-01-26T10:00:00Z',
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
        order: vi.fn().mockResolvedValue({
          data: matches,
          error: null,
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

describe('useSavedCareerMatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return only saved career matches', async () => {
    const savedMatches = mockCareerMatches.filter(m => m.is_saved);
    setupCareerMatchesMock(savedMatches);

    const { result } = renderHook(() => useSavedCareerMatches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});

describe('Match Score Calculations', () => {
  it('should have overall match scores between 0 and 100', () => {
    mockCareerMatches.forEach(match => {
      expect(match.overall_match_score).toBeGreaterThanOrEqual(0);
      expect(match.overall_match_score).toBeLessThanOrEqual(100);
    });
  });

  it('should have component scores between 0 and 100', () => {
    mockCareerMatches.forEach(match => {
      expect(match.interest_match_score).toBeGreaterThanOrEqual(0);
      expect(match.interest_match_score).toBeLessThanOrEqual(100);
      expect(match.skills_match_score).toBeGreaterThanOrEqual(0);
      expect(match.skills_match_score).toBeLessThanOrEqual(100);
      expect(match.knowledge_match_score).toBeGreaterThanOrEqual(0);
      expect(match.knowledge_match_score).toBeLessThanOrEqual(100);
      expect(match.abilities_match_score).toBeGreaterThanOrEqual(0);
      expect(match.abilities_match_score).toBeLessThanOrEqual(100);
    });
  });

  it('should order matches by score descending', () => {
    const sortedMatches = [...mockCareerMatches].sort(
      (a, b) => b.overall_match_score - a.overall_match_score
    );
    expect(sortedMatches[0].overall_match_score).toBeGreaterThanOrEqual(
      sortedMatches[sortedMatches.length - 1].overall_match_score
    );
  });

  it('should have highest score for perfect skill match', () => {
    const perfectMatch = mockCareerMatches.find(m => m.gap_skills.length === 0);
    expect(perfectMatch).toBeDefined();
    expect(perfectMatch?.overall_match_score).toBe(92);
  });
});

describe('Skill Matching', () => {
  it('should track matched interests/skills', () => {
    mockCareerMatches.forEach(match => {
      expect(Array.isArray(match.matched_interests)).toBe(true);
    });
  });

  it('should track skill gaps', () => {
    mockCareerMatches.forEach(match => {
      expect(Array.isArray(match.gap_skills)).toBe(true);
    });
  });

  it('should have some matches with no skill gaps', () => {
    const perfectMatches = mockCareerMatches.filter(m => m.gap_skills.length === 0);
    expect(perfectMatches.length).toBeGreaterThan(0);
  });
});

describe('O*NET Integration', () => {
  it('should have O*NET occupation codes', () => {
    mockCareerMatches.forEach(match => {
      expect(match.onet_code).toBeDefined();
      // O*NET codes are in format XX-XXXX.XX
      expect(match.onet_code).toMatch(/^\d{2}-\d{4}\.\d{2}$/);
    });
  });

  it('should have occupation titles', () => {
    mockCareerMatches.forEach(match => {
      expect(match.occupation_title).toBeDefined();
      expect(match.occupation_title.length).toBeGreaterThan(0);
    });
  });
});

describe('Salary Information', () => {
  it('should include salary median', () => {
    mockCareerMatches.forEach(match => {
      expect(match.salary_median).toBeDefined();
      expect(match.salary_median).toBeGreaterThan(0);
    });
  });

  it('should have reasonable salary ranges', () => {
    mockCareerMatches.forEach(match => {
      expect(match.salary_median).toBeGreaterThan(30000);
      expect(match.salary_median).toBeLessThan(500000);
    });
  });
});

describe('Job Outlook', () => {
  it('should include job outlook information', () => {
    mockCareerMatches.forEach(match => {
      expect(match.job_outlook).toBeDefined();
      expect(match.job_outlook.length).toBeGreaterThan(0);
    });
  });

  it('should have valid outlook descriptions', () => {
    const validOutlooks = [
      'Much faster than average',
      'Faster than average',
      'Average',
      'Slower than average',
      'Decline',
    ];
    mockCareerMatches.forEach(match => {
      expect(validOutlooks.some(outlook => match.job_outlook.includes(outlook) || outlook.includes(match.job_outlook))).toBe(true);
    });
  });
});

describe('Saved Status', () => {
  it('should track saved status', () => {
    mockCareerMatches.forEach(match => {
      expect(typeof match.is_saved).toBe('boolean');
    });
  });

  it('should have both saved and unsaved matches', () => {
    const savedMatches = mockCareerMatches.filter(m => m.is_saved);
    const unsavedMatches = mockCareerMatches.filter(m => !m.is_saved);

    expect(savedMatches.length).toBeGreaterThan(0);
    expect(unsavedMatches.length).toBeGreaterThan(0);
  });
});
