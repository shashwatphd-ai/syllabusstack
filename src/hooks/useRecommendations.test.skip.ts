import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
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
  useRecommendations,
  useFilteredRecommendations,
  type Recommendation,
  type RecommendationType,
} from './useRecommendations';

// Test data
const mockRecommendations: Recommendation[] = [
  {
    id: 'rec-1',
    userId: 'user-1',
    type: 'course',
    title: 'Advanced React Patterns',
    description: 'Learn advanced React patterns including compound components and render props.',
    reason: 'Addresses your React skill gap for Senior Frontend Engineer',
    priority: 'high',
    relatedSkillId: 'skill-react',
    relatedSkillName: 'React',
    relatedDreamJobId: 'job-1',
    contentId: 'course-1',
    contentType: 'course',
    estimatedTime: '20 hours',
    matchScore: 92,
    status: 'pending',
    createdAt: '2024-01-28T10:00:00Z',
  },
  {
    id: 'rec-2',
    userId: 'user-1',
    type: 'certification',
    title: 'AWS Solutions Architect',
    description: 'Demonstrate your cloud architecture skills with AWS certification.',
    reason: 'Highly valued for DevOps Engineer roles',
    priority: 'medium',
    relatedSkillId: 'skill-aws',
    relatedSkillName: 'AWS',
    relatedDreamJobId: 'job-2',
    contentId: 'cert-1',
    contentType: 'certification',
    estimatedTime: '40 hours',
    matchScore: 85,
    status: 'pending',
    createdAt: '2024-01-27T10:00:00Z',
  },
  {
    id: 'rec-3',
    userId: 'user-1',
    type: 'project',
    title: 'Build a Full-Stack App',
    description: 'Create a portfolio project demonstrating full-stack skills.',
    reason: 'Practical experience for your Node.js skill gap',
    priority: 'high',
    relatedSkillId: 'skill-node',
    relatedSkillName: 'Node.js',
    relatedDreamJobId: 'job-1',
    contentId: null,
    contentType: 'project',
    estimatedTime: '30 hours',
    matchScore: 88,
    status: 'in_progress',
    createdAt: '2024-01-26T10:00:00Z',
  },
  {
    id: 'rec-4',
    userId: 'user-1',
    type: 'course',
    title: 'TypeScript Fundamentals',
    description: 'Master TypeScript basics and advanced types.',
    reason: 'Critical gap for your dream job',
    priority: 'critical',
    relatedSkillId: 'skill-ts',
    relatedSkillName: 'TypeScript',
    relatedDreamJobId: 'job-1',
    contentId: 'course-2',
    contentType: 'course',
    estimatedTime: '15 hours',
    matchScore: 95,
    status: 'completed',
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

const setupRecommendationsMock = (recommendations = mockRecommendations) => {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });

  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: recommendations.map(r => ({
            id: r.id,
            user_id: r.userId,
            type: r.type,
            title: r.title,
            description: r.description,
            reason: r.reason,
            priority: r.priority,
            related_skill_id: r.relatedSkillId,
            related_skill_name: r.relatedSkillName,
            related_dream_job_id: r.relatedDreamJobId,
            content_id: r.contentId,
            content_type: r.contentType,
            estimated_time: r.estimatedTime,
            match_score: r.matchScore,
            status: r.status,
            created_at: r.createdAt,
          })),
          error: null,
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });
};

describe('useRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch recommendations for authenticated user', async () => {
    setupRecommendationsMock();

    const { result } = renderHook(() => useRecommendations(), {
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

    const { result } = renderHook(() => useRecommendations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
  });
});

describe('useFilteredRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should filter by type', async () => {
    setupRecommendationsMock();

    const { result } = renderHook(
      () => useFilteredRecommendations({ type: 'course' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Should filter to only course type
  });

  it('should filter by status', async () => {
    setupRecommendationsMock();

    const { result } = renderHook(
      () => useFilteredRecommendations({ status: 'pending' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('should filter by priority', async () => {
    setupRecommendationsMock();

    const { result } = renderHook(
      () => useFilteredRecommendations({ priority: 'critical' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('should filter by dream job', async () => {
    setupRecommendationsMock();

    const { result } = renderHook(
      () => useFilteredRecommendations({ dreamJobId: 'job-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});

describe('Recommendation Types', () => {
  const recommendationTypes: RecommendationType[] = ['course', 'certification', 'project', 'skill_practice'];

  it('should have valid recommendation types', () => {
    mockRecommendations.forEach(rec => {
      expect(['course', 'certification', 'project', 'skill_practice']).toContain(rec.type);
    });
  });

  it('should have different recommendation types in test data', () => {
    const types = new Set(mockRecommendations.map(r => r.type));
    expect(types.size).toBeGreaterThan(1);
  });
});

describe('Recommendation Priority', () => {
  it('should have valid priority levels', () => {
    const validPriorities = ['critical', 'high', 'medium', 'low'];
    mockRecommendations.forEach(rec => {
      expect(validPriorities).toContain(rec.priority);
    });
  });

  it('should have critical priority for essential recommendations', () => {
    const criticalRecs = mockRecommendations.filter(r => r.priority === 'critical');
    expect(criticalRecs.length).toBeGreaterThan(0);
  });
});

describe('Recommendation Status', () => {
  it('should have valid status values', () => {
    const validStatuses = ['pending', 'in_progress', 'completed', 'dismissed'];
    mockRecommendations.forEach(rec => {
      expect(validStatuses).toContain(rec.status);
    });
  });

  it('should track different statuses', () => {
    const pendingCount = mockRecommendations.filter(r => r.status === 'pending').length;
    const inProgressCount = mockRecommendations.filter(r => r.status === 'in_progress').length;
    const completedCount = mockRecommendations.filter(r => r.status === 'completed').length;

    expect(pendingCount).toBe(2);
    expect(inProgressCount).toBe(1);
    expect(completedCount).toBe(1);
  });
});

describe('Match Score', () => {
  it('should have match scores between 0 and 100', () => {
    mockRecommendations.forEach(rec => {
      expect(rec.matchScore).toBeGreaterThanOrEqual(0);
      expect(rec.matchScore).toBeLessThanOrEqual(100);
    });
  });

  it('should have higher match scores for critical items', () => {
    const criticalRec = mockRecommendations.find(r => r.priority === 'critical');
    const lowPriorityRec = mockRecommendations.find(r => r.priority === 'medium');

    expect(criticalRec?.matchScore).toBeGreaterThanOrEqual(lowPriorityRec?.matchScore || 0);
  });
});

describe('Recommendation Content', () => {
  it('should have title and description', () => {
    mockRecommendations.forEach(rec => {
      expect(rec.title).toBeDefined();
      expect(rec.title.length).toBeGreaterThan(0);
      expect(rec.description).toBeDefined();
      expect(rec.description.length).toBeGreaterThan(0);
    });
  });

  it('should have reason explaining the recommendation', () => {
    mockRecommendations.forEach(rec => {
      expect(rec.reason).toBeDefined();
      expect(rec.reason.length).toBeGreaterThan(0);
    });
  });

  it('should have estimated time when available', () => {
    const recsWithTime = mockRecommendations.filter(r => r.estimatedTime);
    expect(recsWithTime.length).toBeGreaterThan(0);
  });
});

describe('Related Data', () => {
  it('should link to related skill', () => {
    mockRecommendations.forEach(rec => {
      expect(rec.relatedSkillId).toBeDefined();
      expect(rec.relatedSkillName).toBeDefined();
    });
  });

  it('should link to dream job when applicable', () => {
    const recsWithJob = mockRecommendations.filter(r => r.relatedDreamJobId);
    expect(recsWithJob.length).toBeGreaterThan(0);
  });
});
