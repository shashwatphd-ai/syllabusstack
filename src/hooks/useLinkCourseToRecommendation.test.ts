import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLinkCourseToRecommendation, useUnlinkCourseFromRecommendation } from './useLinkCourseToRecommendation';
import React from 'react';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn(() => ({ error: null })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })) })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
    })),
  },
}));

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe('useLinkCourseToRecommendation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should be defined', () => {
    const { result } = renderHook(() => useLinkCourseToRecommendation(), { wrapper: createWrapper() });
    expect(result.current).toBeDefined();
    expect(result.current.mutateAsync).toBeDefined();
  });

  it('should have correct initial state', () => {
    const { result } = renderHook(() => useLinkCourseToRecommendation(), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(false);
  });
});

describe('useUnlinkCourseFromRecommendation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should be defined', () => {
    const { result } = renderHook(() => useUnlinkCourseFromRecommendation(), { wrapper: createWrapper() });
    expect(result.current).toBeDefined();
  });
});
