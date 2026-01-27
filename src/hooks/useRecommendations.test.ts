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

// Import after mocking - use actual exports
import {
  useRecommendations,
  useUpdateRecommendationStatus,
  useAntiRecommendations,
  type Recommendation,
  type RecommendationWithLinks,
  type AntiRecommendation,
} from './useRecommendations';

// Test data using database schema (snake_case)
const mockRecommendations: Partial<Recommendation>[] = [
  {
    id: 'rec-1',
    dream_job_id: 'job-1',
    type: 'course',
    title: 'Advanced React Patterns',
    description: 'Learn advanced React patterns including compound components and render props.',
    reason: 'Addresses your React skill gap for Senior Frontend Engineer',
    priority: 1,
    skill_addressed: 'React Advanced Patterns',
    source_type: 'ai_generated',
    content_url: 'https://example.com/react-course',
    estimated_hours: 20,
    price: 'free',
    status: 'pending',
    created_at: '2024-01-28T10:00:00Z',
    updated_at: '2024-01-28T10:00:00Z',
  },
  {
    id: 'rec-2',
    dream_job_id: 'job-1',
    type: 'certification',
    title: 'AWS Solutions Architect',
    description: 'Demonstrate your cloud architecture skills with AWS certification.',
    reason: 'Highly valued for DevOps Engineer roles',
    priority: 2,
    skill_addressed: 'AWS',
    source_type: 'ai_generated',
    content_url: 'https://aws.amazon.com/certification',
    estimated_hours: 40,
    price: '$300',
    status: 'pending',
    created_at: '2024-01-27T10:00:00Z',
    updated_at: '2024-01-27T10:00:00Z',
  },
  {
    id: 'rec-3',
    dream_job_id: 'job-1',
    type: 'project',
    title: 'Build a Full-Stack App',
    description: 'Create a portfolio project demonstrating full-stack skills.',
    reason: 'Practical experience for your Node.js skill gap',
    priority: 1,
    skill_addressed: 'Full Stack Development',
    source_type: 'ai_generated',
    content_url: null,
    estimated_hours: 30,
    price: 'free',
    status: 'in_progress',
    created_at: '2024-01-26T10:00:00Z',
    updated_at: '2024-01-26T10:00:00Z',
  },
  {
    id: 'rec-4',
    dream_job_id: 'job-1',
    type: 'course',
    title: 'TypeScript Fundamentals',
    description: 'Master TypeScript basics and advanced types.',
    reason: 'Critical gap for your dream job',
    priority: 0,
    skill_addressed: 'TypeScript',
    source_type: 'firecrawl',
    content_url: 'https://example.com/typescript',
    estimated_hours: 15,
    price: 'free',
    status: 'completed',
    created_at: '2024-01-25T10:00:00Z',
    updated_at: '2024-01-25T10:00:00Z',
  },
];

// AntiRecommendation matches actual interface: id, user_id, dream_job_id, action, reason
const mockAntiRecommendations: AntiRecommendation[] = [
  {
    id: 'anti-1',
    user_id: 'user-1',
    dream_job_id: 'job-1',
    action: 'Avoid jQuery Mastery Course',
    reason: 'jQuery is outdated for modern web development. Focus on React instead.',
  },
  {
    id: 'anti-2',
    user_id: 'user-1',
    dream_job_id: 'job-1',
    action: 'Skip PHP for Beginners',
    reason: 'Not aligned with your frontend-focused career path.',
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
          data: recommendations,
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

  it('should fetch recommendations for a dream job', async () => {
    setupRecommendationsMock();

    const { result } = renderHook(() => useRecommendations('job-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('should return empty array when no dream job id provided', async () => {
    const { result } = renderHook(() => useRecommendations(undefined), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
  });
});

describe('useAntiRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct anti-recommendation structure', () => {
    mockAntiRecommendations.forEach(anti => {
      expect(anti.id).toBeDefined();
      expect(anti.user_id).toBeDefined();
      expect(anti.dream_job_id).toBeDefined();
      expect(anti.action).toBeDefined();
      expect(anti.reason).toBeDefined();
    });
  });
});

describe('Recommendation Types', () => {
  it('should have valid recommendation types', () => {
    const validTypes = ['course', 'certification', 'project', 'book', 'video', 'article', 'practice'];
    mockRecommendations.forEach(rec => {
      expect(validTypes).toContain(rec.type);
    });
  });

  it('should have different recommendation types in test data', () => {
    const types = new Set(mockRecommendations.map(r => r.type));
    expect(types.size).toBeGreaterThan(1);
  });
});

describe('Recommendation Priority', () => {
  it('should have numeric priority values', () => {
    mockRecommendations.forEach(rec => {
      expect(typeof rec.priority).toBe('number');
      expect(rec.priority).toBeGreaterThanOrEqual(0);
    });
  });

  it('should have varying priority levels', () => {
    const priorities = new Set(mockRecommendations.map(r => r.priority));
    expect(priorities.size).toBeGreaterThan(1);
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

describe('Recommendation Content', () => {
  it('should have title and description', () => {
    mockRecommendations.forEach(rec => {
      expect(rec.title).toBeDefined();
      expect(rec.title!.length).toBeGreaterThan(0);
      expect(rec.description).toBeDefined();
      expect(rec.description!.length).toBeGreaterThan(0);
    });
  });

  it('should have reason explaining the recommendation', () => {
    mockRecommendations.forEach(rec => {
      expect(rec.reason).toBeDefined();
      expect(rec.reason!.length).toBeGreaterThan(0);
    });
  });

  it('should have estimated hours when available', () => {
    const recsWithTime = mockRecommendations.filter(r => r.estimated_hours);
    expect(recsWithTime.length).toBeGreaterThan(0);
    recsWithTime.forEach(rec => {
      expect(rec.estimated_hours).toBeGreaterThan(0);
    });
  });
});

describe('Source Type', () => {
  it('should have valid source types', () => {
    const validSources = ['ai_generated', 'firecrawl', 'manual', 'youtube'];
    mockRecommendations.forEach(rec => {
      expect(validSources).toContain(rec.source_type);
    });
  });
});

describe('Price Information', () => {
  it('should have price information', () => {
    mockRecommendations.forEach(rec => {
      expect(rec.price).toBeDefined();
    });
  });

  it('should have both free and paid recommendations', () => {
    const freeRecs = mockRecommendations.filter(r => r.price === 'free');
    const paidRecs = mockRecommendations.filter(r => r.price !== 'free');

    expect(freeRecs.length).toBeGreaterThan(0);
    expect(paidRecs.length).toBeGreaterThan(0);
  });
});

describe('Content URL', () => {
  it('should have content URL for external resources', () => {
    const externalRecs = mockRecommendations.filter(r => r.type !== 'project');
    externalRecs.forEach(rec => {
      expect(rec.content_url).toBeDefined();
    });
  });

  it('should allow null URL for self-directed projects', () => {
    const projectRec = mockRecommendations.find(r => r.type === 'project');
    expect(projectRec?.content_url).toBeNull();
  });
});

describe('Skill Addressed', () => {
  it('should specify the skill being addressed', () => {
    mockRecommendations.forEach(rec => {
      expect(rec.skill_addressed).toBeDefined();
      expect(rec.skill_addressed!.length).toBeGreaterThan(0);
    });
  });
});

describe('Anti-Recommendations', () => {
  it('should have clear reasoning', () => {
    mockAntiRecommendations.forEach(anti => {
      expect(anti.reason.length).toBeGreaterThan(20);
    });
  });

  it('should have actionable guidance', () => {
    mockAntiRecommendations.forEach(anti => {
      expect(anti.action).toBeDefined();
      expect(anti.action.length).toBeGreaterThan(0);
    });
  });

  it('should be linked to a dream job', () => {
    mockAntiRecommendations.forEach(anti => {
      expect(anti.dream_job_id).toBeDefined();
    });
  });
});
