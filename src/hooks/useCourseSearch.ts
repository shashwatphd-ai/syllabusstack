import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

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

interface GapItem {
  gap?: string;
  requirement?: string;
  job_requirement?: string;
  skill?: string;
  text?: string;
  priority?: number;
}

// Type for gaps that could be strings or objects
type GapInput = GapItem | string;

// Validate that gap items have extractable text
function validateGaps(gaps: GapInput[]): { valid: boolean; error?: string } {
  if (!Array.isArray(gaps)) {
    return { valid: false, error: 'Gaps must be an array' };
  }
  if (gaps.length === 0) {
    return { valid: false, error: 'No skill gaps provided' };
  }
  
  // Check that at least one gap has extractable text
  const hasValidGap = gaps.some(gap => {
    if (typeof gap === 'string') return gap.trim().length > 0;
    if (typeof gap === 'object' && gap !== null) {
      return ['gap', 'requirement', 'job_requirement', 'skill', 'text'].some(
        key => typeof (gap as Record<string, unknown>)[key] === 'string' && 
               ((gap as Record<string, unknown>)[key] as string).trim().length > 0
      );
    }
    return false;
  });
  
  if (!hasValidGap) {
    return { valid: false, error: 'No valid skill gap text found in the provided data' };
  }
  
  return { valid: true };
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

async function searchCoursesWithFirecrawl(
  gaps: GapItem[],
  dreamJobId: string,
  dreamJobTitle: string
): Promise<CourseSearchResult> {
  // Validate inputs before API call
  const validation = validateGaps(gaps);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid gaps data');
  }
  
  if (!dreamJobId || typeof dreamJobId !== 'string') {
    throw new Error('Dream job ID is required');
  }
  
  if (!dreamJobTitle || typeof dreamJobTitle !== 'string') {
    throw new Error('Dream job title is required');
  }
  
  console.log(`[useCourseSearch] Searching courses for ${gaps.length} gaps`);
  
  const { data, error } = await supabase.functions.invoke('firecrawl-search-courses', {
    body: { gaps, dreamJobId, dreamJobTitle }
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

export function useCourseSearch() {
  const queryClient = useQueryClient();
  const [lastResults, setLastResults] = useState<CourseResult[]>([]);

  const mutation = useMutation({
    mutationFn: ({ 
      gaps, 
      dreamJobId, 
      dreamJobTitle 
    }: { 
      gaps: GapItem[]; 
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

  // Helper for async/await usage - supports both object and individual args
  const searchCourses = async (
    gapsOrParams: GapItem[] | { gaps: GapItem[]; dreamJobId: string; dreamJobTitle: string },
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
