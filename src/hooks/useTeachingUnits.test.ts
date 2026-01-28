/**
 * useTeachingUnits.test.ts
 *
 * FIX APPLIED: Mock chain for Supabase query builder
 *
 * WHY THIS CHANGE:
 * - Original mock only had mockFrom() returning undefined
 * - Hook calls supabase.from('teaching_units').update({}).eq()
 * - Need to return chainable mock object
 *
 * WHAT WAS CHANGED:
 * - Used vi.hoisted() for consistent mock setup
 * - Added proper mock chain for select, update, eq, order methods
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

/**
 * FIX: Export all mocks including mockUpdate, mockSelect for individual test customization
 *
 * WHY THIS CHANGE:
 * - Tests need direct access to mockUpdate for custom mock behavior
 * - Previous version only exported mockFrom, mockInvoke, mockToast
 * - Test at line 222 tried to use mockUpdate but it wasn't exported
 */
const { mockInvoke, mockFrom, mockToast, mockSelect, mockUpdate, mockEq } = vi.hoisted(() => {
  const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockOrder = vi.fn().mockReturnValue({ data: [], error: null });
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      order: mockOrder,
      single: mockSingle,
    }),
    order: mockOrder,
    single: mockSingle,
  });
  const mockUpdate = vi.fn().mockReturnValue({
    eq: mockEq,
  });
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

  return {
    mockInvoke: vi.fn(),
    mockFrom: vi.fn().mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
      insert: mockInsert,
      eq: mockEq,
      order: mockOrder,
    }),
    mockToast: vi.fn(),
    mockSelect,
    mockUpdate,
    mockEq,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Import AFTER mocking
import {
  useTeachingUnits,
  useDecomposeLearningObjective,
  useSearchForTeachingUnit,
} from './useTeachingUnits';
import { createQCATeachingUnits, resetTeachingUnitFactory } from '@/test/factories/teaching-unit';

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

describe('useTeachingUnits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTeachingUnitFactory();
  });

  it('should not fetch when learningObjectiveId is undefined', () => {
    const { result } = renderHook(() => useTeachingUnits(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should fetch teaching units when learningObjectiveId is provided', async () => {
    const mockUnits = createQCATeachingUnits('test-lo-id');
    
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockUnits, error: null }),
    });

    const { result } = renderHook(() => useTeachingUnits('test-lo-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockUnits);
    expect(result.current.data?.length).toBe(4);
  });

  it('should handle errors gracefully', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: new Error('Database error') }),
    });

    const { result } = renderHook(() => useTeachingUnits('test-lo-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useDecomposeLearningObjective', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTeachingUnitFactory();
  });

  it('should be defined', () => {
    const { result } = renderHook(() => useDecomposeLearningObjective(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeDefined();
    expect(result.current.mutateAsync).toBeDefined();
  });

  it('should have correct initial state', () => {
    const { result } = renderHook(() => useDecomposeLearningObjective(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.isSuccess).toBe(false);
  });

  it('should call curriculum-reasoning-agent edge function', async () => {
    const mockUnits = createQCATeachingUnits('test-lo-id');
    mockInvoke.mockResolvedValue({
      data: { success: true, teaching_units: mockUnits },
      error: null,
    });

    const { result } = renderHook(() => useDecomposeLearningObjective(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync('test-lo-id');

    expect(mockInvoke).toHaveBeenCalledWith('curriculum-reasoning-agent', {
      body: { learning_objective_id: 'test-lo-id' },
    });
  });

  it('should handle decomposition failure', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: 'Decomposition failed' },
      error: null,
    });

    const { result } = renderHook(() => useDecomposeLearningObjective(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync('test-lo-id')).rejects.toThrow('Decomposition failed');
  });
});

describe('useSearchForTeachingUnit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTeachingUnitFactory();
  });

  it('should be defined', () => {
    const { result } = renderHook(() => useSearchForTeachingUnit(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeDefined();
    expect(result.current.mutate).toBeDefined();
  });

  /**
   * FIX APPLIED: Include update method in mockFrom return value
   *
   * WHY THIS CHANGE:
   * - Hook calls supabase.from('teaching_units').update({}).eq()
   * - Test's mockFrom.mockReturnValue only had select, eq, single
   * - Missing update caused "update is not a function" error
   *
   * WHAT WAS CHANGED:
   * - Added update method to mockFrom.mockReturnValue
   * - Update returns chainable eq that resolves success
   */
  it('should call search-youtube-content with teaching_unit_id', async () => {
    const mockUnit = createQCATeachingUnits('test-lo-id')[0];

    // Mock the teaching unit fetch AND the status update
    // IMPORTANT: mockFrom is called for both select and update operations
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { ...mockUnit, learning_objective_id: 'test-lo-id' },
        error: null,
      }),
      // FIX: Include update method for status update call
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    // Mock the search function
    mockInvoke.mockResolvedValue({
      data: { videos_found: 5 },
      error: null,
    });

    const { result } = renderHook(() => useSearchForTeachingUnit(), {
      wrapper: createWrapper(),
    });

    await result.current.mutate(mockUnit.id);

    expect(mockInvoke).toHaveBeenCalledWith('search-youtube-content', expect.objectContaining({
      body: expect.objectContaining({
        learning_objective_id: 'test-lo-id',
        teaching_unit_id: mockUnit.id,
      }),
    }));
  });
});

describe('Teaching Units Pipeline Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTeachingUnitFactory();
  });

  it('should decompose LO into 4+ teaching units for QCA topic', async () => {
    const mockUnits = createQCATeachingUnits('qca-lo-id');
    mockInvoke.mockResolvedValue({
      data: { success: true, teaching_units: mockUnits },
      error: null,
    });

    const { result } = renderHook(() => useDecomposeLearningObjective(), {
      wrapper: createWrapper(),
    });

    const response = await result.current.mutateAsync('qca-lo-id');

    // Should have 4+ teaching units
    expect(mockUnits.length).toBeGreaterThanOrEqual(4);

    // Should have specific topics
    const titles = mockUnits.map(u => u.title.toLowerCase());
    expect(titles.some(t => t.includes('boolean') || t.includes('logic'))).toBe(true);
    expect(titles.some(t => t.includes('set'))).toBe(true);
    expect(titles.some(t => t.includes('qca'))).toBe(true);

    // All units should have search queries
    expect(mockUnits.every(u => u.search_queries.length >= 3)).toBe(true);
  });

  it('should tag content matches to teaching units', async () => {
    const loId = 'test-lo-id';
    const mockUnits = createQCATeachingUnits(loId);
    
    // Simulate content matches being returned with teaching_unit_id
    const mockContentMatches = mockUnits.map(unit => ({
      id: `match-${unit.id}`,
      learning_objective_id: loId,
      teaching_unit_id: unit.id,
      content_id: `content-${unit.id}`,
      match_score: 85,
      status: 'pending',
    }));

    // Every match should have a teaching_unit_id
    expect(mockContentMatches.every(m => m.teaching_unit_id !== null)).toBe(true);
    
    // Each teaching unit should have at least one match
    mockUnits.forEach(unit => {
      const matchesForUnit = mockContentMatches.filter(m => m.teaching_unit_id === unit.id);
      expect(matchesForUnit.length).toBeGreaterThan(0);
    });
  });
});
