import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useVerifiedSkills,
  useVerifiedSkillsByCategory,
  useSkillStats,
  useHasVerifiedSkill,
  useSkillsByProficiency,
  useSearchVerifiedSkills,
  getProficiencyBadge,
  getSourceTypeInfo,
  formatSkillDisplay,
  calculateOverallSkillLevel,
  PROFICIENCY_CONFIG,
  SOURCE_TYPE_CONFIG,
  type VerifiedSkill,
} from './useVerifiedSkills';

// Mock supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

// Test data
const mockVerifiedSkills: VerifiedSkill[] = [
  {
    id: '1',
    user_id: 'user-1',
    skill_name: 'JavaScript',
    proficiency_level: 'advanced',
    source_type: 'course_assessment',
    source_id: 'course-1',
    source_name: 'Web Development 101',
    verified_at: '2024-01-15T10:00:00Z',
    evidence_url: null,
    metadata: {
      skill_category: 'Technical & Engineering',
      score: 85,
    },
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    user_id: 'user-1',
    skill_name: 'React',
    proficiency_level: 'intermediate',
    source_type: 'course_assessment',
    source_id: 'course-2',
    source_name: 'Frontend Framework Course',
    verified_at: '2024-01-20T10:00:00Z',
    evidence_url: null,
    metadata: {
      skill_category: 'Technical & Engineering',
      score: 72,
    },
    created_at: '2024-01-20T10:00:00Z',
    updated_at: '2024-01-20T10:00:00Z',
  },
  {
    id: '3',
    user_id: 'user-1',
    skill_name: 'Project Management',
    proficiency_level: 'beginner',
    source_type: 'certification',
    source_id: 'cert-1',
    source_name: 'PM Fundamentals',
    verified_at: '2024-01-25T10:00:00Z',
    evidence_url: 'https://example.com/cert',
    metadata: {
      skill_category: 'Business & Management',
      score: 70,
    },
    created_at: '2024-01-25T10:00:00Z',
    updated_at: '2024-01-25T10:00:00Z',
  },
  {
    id: '4',
    user_id: 'user-1',
    skill_name: 'Data Analysis',
    proficiency_level: 'expert',
    source_type: 'project',
    source_id: 'project-1',
    source_name: 'Capstone Project',
    verified_at: '2024-02-01T10:00:00Z',
    evidence_url: null,
    metadata: {
      skill_category: 'Science & Research',
      score: 95,
    },
    created_at: '2024-02-01T10:00:00Z',
    updated_at: '2024-02-01T10:00:00Z',
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

describe('useVerifiedSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
  });

  it('should fetch verified skills for authenticated user', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockVerifiedSkills,
            error: null,
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useVerifiedSkills(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toHaveLength(4);
    expect(result.current.data?.[0].skill_name).toBe('JavaScript');
  });

  it('should return empty array when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { result } = renderHook(() => useVerifiedSkills(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([]);
  });

  it('should throw error when database query fails', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Database error'),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useVerifiedSkills(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useVerifiedSkillsByCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockVerifiedSkills,
            error: null,
          }),
        }),
      }),
    });
  });

  it('should group skills by category', async () => {
    const { result } = renderHook(() => useVerifiedSkillsByCategory(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.groupedSkills).toHaveLength(3); // 3 categories
    expect(result.current.groupedSkills[0].category).toBe('Technical & Engineering'); // Most skills
    expect(result.current.groupedSkills[0].count).toBe(2);
  });

  it('should sort categories by count descending', async () => {
    const { result } = renderHook(() => useVerifiedSkillsByCategory(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const counts = result.current.groupedSkills.map(g => g.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});

describe('useSkillStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockVerifiedSkills,
            error: null,
          }),
        }),
      }),
    });
  });

  it('should calculate correct statistics', async () => {
    const { result } = renderHook(() => useSkillStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stats.total).toBe(4);
    expect(result.current.stats.byProficiency.expert).toBe(1);
    expect(result.current.stats.byProficiency.advanced).toBe(1);
    expect(result.current.stats.byProficiency.intermediate).toBe(1);
    expect(result.current.stats.byProficiency.beginner).toBe(1);
  });

  it('should count skills by source type', async () => {
    const { result } = renderHook(() => useSkillStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stats.bySourceType.course_assessment).toBe(2);
    expect(result.current.stats.bySourceType.certification).toBe(1);
    expect(result.current.stats.bySourceType.project).toBe(1);
  });

  it('should return top skills sorted by proficiency', async () => {
    const { result } = renderHook(() => useSkillStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stats.topSkills[0].skill_name).toBe('Data Analysis'); // Expert
    expect(result.current.stats.topSkills[0].proficiency_level).toBe('expert');
  });
});

describe('useHasVerifiedSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockVerifiedSkills,
            error: null,
          }),
        }),
      }),
    });
  });

  it('should return true for existing skill', async () => {
    const { result } = renderHook(() => useHasVerifiedSkill('JavaScript'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasSkill).toBe(true);
    expect(result.current.skill?.proficiency_level).toBe('advanced');
  });

  it('should return false for non-existing skill', async () => {
    const { result } = renderHook(() => useHasVerifiedSkill('Python'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasSkill).toBe(false);
    expect(result.current.skill).toBeUndefined();
  });

  it('should be case-insensitive', async () => {
    const { result } = renderHook(() => useHasVerifiedSkill('javascript'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasSkill).toBe(true);
  });
});

describe('useSkillsByProficiency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockVerifiedSkills,
            error: null,
          }),
        }),
      }),
    });
  });

  it('should filter skills by proficiency level', async () => {
    const { result } = renderHook(() => useSkillsByProficiency('advanced'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.count).toBe(1);
    expect(result.current.skills[0].skill_name).toBe('JavaScript');
  });
});

describe('useSearchVerifiedSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockVerifiedSkills,
            error: null,
          }),
        }),
      }),
    });
  });

  it('should search skills by name', async () => {
    const { result } = renderHook(() => useSearchVerifiedSkills('java'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.count).toBe(1);
    expect(result.current.skills[0].skill_name).toBe('JavaScript');
  });

  it('should return empty for no matches', async () => {
    const { result } = renderHook(() => useSearchVerifiedSkills('xyz'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.count).toBe(0);
  });
});

describe('Utility Functions', () => {
  describe('getProficiencyBadge', () => {
    it('should return correct config for each proficiency level', () => {
      expect(getProficiencyBadge('beginner').label).toBe('Beginner');
      expect(getProficiencyBadge('intermediate').label).toBe('Intermediate');
      expect(getProficiencyBadge('advanced').label).toBe('Advanced');
      expect(getProficiencyBadge('expert').label).toBe('Expert');
    });

    it('should return order values in ascending order', () => {
      expect(getProficiencyBadge('beginner').order).toBe(1);
      expect(getProficiencyBadge('intermediate').order).toBe(2);
      expect(getProficiencyBadge('advanced').order).toBe(3);
      expect(getProficiencyBadge('expert').order).toBe(4);
    });
  });

  describe('getSourceTypeInfo', () => {
    it('should return correct info for each source type', () => {
      expect(getSourceTypeInfo('course_assessment').label).toBe('Course Assessment');
      expect(getSourceTypeInfo('micro_check').label).toBe('Micro-Check');
      expect(getSourceTypeInfo('project').label).toBe('Project');
      expect(getSourceTypeInfo('certification').label).toBe('Certification');
      expect(getSourceTypeInfo('manual').label).toBe('Manual Entry');
    });
  });

  describe('formatSkillDisplay', () => {
    it('should format skill with proficiency', () => {
      const skill: VerifiedSkill = {
        ...mockVerifiedSkills[0],
        proficiency_level: 'advanced',
      };
      expect(formatSkillDisplay(skill)).toBe('JavaScript (Advanced)');
    });
  });

  describe('calculateOverallSkillLevel', () => {
    it('should return "Getting Started" for empty skills', () => {
      const result = calculateOverallSkillLevel([]);
      expect(result.level).toBe('Getting Started');
      expect(result.score).toBe(0);
    });

    it('should calculate correct level for mixed skills', () => {
      const result = calculateOverallSkillLevel(mockVerifiedSkills);
      // Average: (1 + 2 + 3 + 4) / 4 = 2.5 = Advanced
      expect(result.level).toBe('Advanced');
    });

    it('should return Expert for high-proficiency skills', () => {
      const expertSkills: VerifiedSkill[] = [
        { ...mockVerifiedSkills[0], proficiency_level: 'expert' },
        { ...mockVerifiedSkills[1], proficiency_level: 'expert' },
        { ...mockVerifiedSkills[2], proficiency_level: 'advanced' },
      ];
      const result = calculateOverallSkillLevel(expertSkills);
      expect(result.level).toBe('Expert');
    });

    it('should return Beginner for low-proficiency skills', () => {
      const beginnerSkills: VerifiedSkill[] = [
        { ...mockVerifiedSkills[0], proficiency_level: 'beginner' },
        { ...mockVerifiedSkills[1], proficiency_level: 'beginner' },
      ];
      const result = calculateOverallSkillLevel(beginnerSkills);
      expect(result.level).toBe('Beginner');
    });
  });
});

describe('PROFICIENCY_CONFIG', () => {
  it('should have all required proficiency levels', () => {
    expect(PROFICIENCY_CONFIG).toHaveProperty('beginner');
    expect(PROFICIENCY_CONFIG).toHaveProperty('intermediate');
    expect(PROFICIENCY_CONFIG).toHaveProperty('advanced');
    expect(PROFICIENCY_CONFIG).toHaveProperty('expert');
  });

  it('should have required properties for each level', () => {
    Object.values(PROFICIENCY_CONFIG).forEach(config => {
      expect(config).toHaveProperty('label');
      expect(config).toHaveProperty('color');
      expect(config).toHaveProperty('badgeColor');
      expect(config).toHaveProperty('description');
      expect(config).toHaveProperty('order');
    });
  });
});

describe('SOURCE_TYPE_CONFIG', () => {
  it('should have all required source types', () => {
    expect(SOURCE_TYPE_CONFIG).toHaveProperty('course_assessment');
    expect(SOURCE_TYPE_CONFIG).toHaveProperty('micro_check');
    expect(SOURCE_TYPE_CONFIG).toHaveProperty('project');
    expect(SOURCE_TYPE_CONFIG).toHaveProperty('certification');
    expect(SOURCE_TYPE_CONFIG).toHaveProperty('manual');
  });

  it('should have required properties for each source type', () => {
    Object.values(SOURCE_TYPE_CONFIG).forEach(config => {
      expect(config).toHaveProperty('label');
      expect(config).toHaveProperty('icon');
      expect(config).toHaveProperty('description');
    });
  });
});
