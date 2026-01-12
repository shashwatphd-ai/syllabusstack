import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';
import { 
  normalizeGaps, 
  gapsToSearchFormat,
  type NormalizedGap,
  type RawGapInput 
} from '@/lib/gap-utils';

export interface CourseResult {
  title: string;
  provider: string;
  url: string;
  description: string;
  duration?: string;
  rating?: string;
  price?: string;
}

export interface CourseSearchResult {
  success: boolean;
  courses: CourseResult[];
  gapsSearched: number;
  totalFound: number;
}

// Rate limit error class for specific handling
export class RateLimitError extends Error {
  retryAfter?: number;
  
  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Search for courses using the edge function
 * Accepts gaps in any format - they will be normalized before sending
 */
async function searchCoursesWithFirecrawl(
  gaps: RawGapInput[],
  dreamJobId: string,
  dreamJobTitle: string
): Promise<CourseSearchResult> {
  // Normalize gaps using our robust utility
  const normalizedGaps = normalizeGaps(gaps);
  
  if (normalizedGaps.length === 0) {
    throw new Error('No valid skill gaps found. Please ensure your gap analysis has been completed.');
  }
  
  if (!dreamJobId || typeof dreamJobId !== 'string') {
    throw new Error('Dream job ID is required');
  }
  
  if (!dreamJobTitle || typeof dreamJobTitle !== 'string') {
    throw new Error('Dream job title is required');
  }
  
  // Convert to the format expected by the edge function
  const gapsForSearch = gapsToSearchFormat(normalizedGaps);
  
  console.log(`[useCourseSearch] Searching courses for ${gapsForSearch.length} gaps:`, 
    gapsForSearch.map(g => g.gap.slice(0, 40)).join(' | '));
  
  const { data, error } = await supabase.functions.invoke('firecrawl-search-courses', {
    body: { 
      gaps: gapsForSearch, 
      dreamJobId, 
      dreamJobTitle 
    }
  });

  if (error) {
    console.error('[useCourseSearch] Edge function error:', error);
    // Check for rate limit errors (429)
    if (error.message?.includes('429') || error.message?.toLowerCase().includes('rate limit')) {
      throw new RateLimitError(
        'Course search limit reached. Please try again in a few minutes.',
        60 // Default 60 second retry
      );
    }
    throw new Error(error.message || 'Failed to search for courses');
  }

  if (data?.error) {
    console.error('[useCourseSearch] API error:', data.error);
    if (data.error.includes('rate limit') || data.error.includes('429')) {
      throw new RateLimitError(
        'Course search limit reached. Please try again in a few minutes.',
        data.retryAfter || 60
      );
    }
    throw new Error(data.error);
  }

  console.log(`[useCourseSearch] Found ${data?.totalFound || 0} courses`);
  return data;
}

/**
 * Hook for searching courses based on skill gaps
 * 
 * Usage:
 * ```tsx
 * const { searchCourses, isSearching, results } = useCourseSearch();
 * 
 * // Can be called with any gap format - will be normalized automatically
 * await searchCourses(gaps, dreamJobId, dreamJobTitle);
 * 
 * // Or with object params
 * await searchCourses({ gaps, dreamJobId, dreamJobTitle });
 * ```
 */
export function useCourseSearch() {
  const queryClient = useQueryClient();
  const [lastResults, setLastResults] = useState<CourseResult[]>([]);

  const mutation = useMutation({
    mutationFn: ({ 
      gaps, 
      dreamJobId, 
      dreamJobTitle 
    }: { 
      gaps: RawGapInput[]; 
      dreamJobId: string; 
      dreamJobTitle: string;
    }) => searchCoursesWithFirecrawl(gaps, dreamJobId, dreamJobTitle),
    onSuccess: (data) => {
      setLastResults(data.courses);
      
      // Invalidate recommendations to show newly saved courses
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      
      toast({
        title: `Found ${data.totalFound} courses! 🎓`,
        description: `Searched ${data.gapsSearched} skill gaps. Courses saved to your recommendations.`,
      });
    },
    onError: (error) => {
      // Handle rate limit errors specifically
      if (error instanceof RateLimitError) {
        toast({
          title: 'Search Limit Reached ⏳',
          description: error.message,
          variant: 'destructive',
          duration: 6000,
        });
        return;
      }
      
      toast({
        title: 'Course Search Failed',
        description: error instanceof Error ? error.message : 'Failed to search for courses',
        variant: 'destructive',
      });
    },
  });

  /**
   * Search for courses - supports multiple calling conventions
   * 
   * @example
   * // Array + separate params
   * searchCourses(gaps, dreamJobId, dreamJobTitle)
   * 
   * @example
   * // Object params
   * searchCourses({ gaps, dreamJobId, dreamJobTitle })
   */
  const searchCourses = async (
    gapsOrParams: RawGapInput[] | { gaps: RawGapInput[]; dreamJobId: string; dreamJobTitle: string },
    dreamJobId?: string,
    dreamJobTitle?: string
  ) => {
    // Support both calling conventions
    if (Array.isArray(gapsOrParams)) {
      if (!dreamJobId || !dreamJobTitle) {
        throw new Error('dreamJobId and dreamJobTitle are required');
      }
      return mutation.mutateAsync({ gaps: gapsOrParams, dreamJobId, dreamJobTitle });
    }
    return mutation.mutateAsync(gapsOrParams);
  };

  return {
    searchCourses,
    searchCoursesMutation: mutation.mutate,
    isSearching: mutation.isPending,
    results: lastResults,
    error: mutation.error,
    reset: () => setLastResults([]),
  };
}
