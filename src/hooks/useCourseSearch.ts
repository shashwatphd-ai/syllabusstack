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
  priority?: number;
}

async function searchCoursesWithFirecrawl(
  gaps: GapItem[],
  dreamJobId: string,
  dreamJobTitle: string
): Promise<CourseSearchResult> {
  const { data, error } = await supabase.functions.invoke('firecrawl-search-courses', {
    body: { gaps, dreamJobId, dreamJobTitle }
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.error) {
    throw new Error(data.error);
  }

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
