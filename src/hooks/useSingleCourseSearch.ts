import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query-keys';

interface SearchParams {
  gapAddressed: string;
  dreamJobId: string;
  dreamJobTitle: string;
}

interface SearchResult {
  coursesFound: number;
  rateLimited: boolean;
}

/**
 * Hook for searching courses for a single recommendation
 * Triggers firecrawl-search-courses for just one gap
 */
export function useSingleCourseSearch() {
  const queryClient = useQueryClient();
  const [searchingId, setSearchingId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ gapAddressed, dreamJobId, dreamJobTitle }: SearchParams): Promise<SearchResult> => {
      const { data, error } = await supabase.functions.invoke('firecrawl-search-courses', {
        body: {
          gaps: [{ gap: gapAddressed }],
          dreamJobId,
          dreamJobTitle,
        },
      });

      if (error) {
        // Check for rate limiting
        if (error.message?.includes('429') || error.message?.toLowerCase().includes('rate limit')) {
          return { coursesFound: 0, rateLimited: true };
        }
        throw error;
      }

      return { 
        coursesFound: data?.coursesFound || 0, 
        rateLimited: false 
      };
    },
    onSuccess: (result, variables) => {
      if (result.rateLimited) {
        toast({
          title: 'Search limit reached',
          description: 'Course search is temporarily limited. Please try again in a few minutes.',
          variant: 'destructive',
        });
        return;
      }

      if (result.coursesFound > 0) {
        toast({
          title: 'Courses found',
          description: `Found ${result.coursesFound} course${result.coursesFound > 1 ? 's' : ''} for "${variables.gapAddressed}"`,
        });
      } else {
        toast({
          title: 'No courses found',
          description: 'Try modifying the skill gap description or use the Link Course option.',
        });
      }

      // Invalidate recommendations to show new linked courses
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
    },
    onError: (error) => {
      toast({
        title: 'Search failed',
        description: error instanceof Error ? error.message : 'Unable to search for courses',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setSearchingId(null);
    },
  });

  const searchForCourse = async (
    recommendationId: string,
    params: SearchParams
  ) => {
    setSearchingId(recommendationId);
    return mutation.mutateAsync(params);
  };

  return {
    searchForCourse,
    isSearching: mutation.isPending,
    searchingId,
  };
}
