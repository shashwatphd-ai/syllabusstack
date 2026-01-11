import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query-keys';

interface AutoLinkResult {
  suggestedLinks: number;
  message: string;
}

/**
 * Hook to trigger auto-linking of enrolled courses to recommendations
 */
export function useAutoLinkCourses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dreamJobId,
      instructorCourseId,
    }: {
      dreamJobId?: string;
      instructorCourseId?: string;
    } = {}): Promise<AutoLinkResult> => {
      const { data, error } = await supabase.functions.invoke('auto-link-courses', {
        body: { dreamJobId, instructorCourseId },
      });

      if (error) {
        throw new Error(error.message || 'Failed to auto-link courses');
      }

      return data as AutoLinkResult;
    },
    onSuccess: (data) => {
      // Invalidate recommendations to refresh suggested links
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: ['available-courses-for-linking'] });
      
      if (data.suggestedLinks > 0) {
        toast({
          title: 'Course Matches Found',
          description: data.message,
        });
      }
    },
    onError: (error) => {
      console.error('[useAutoLinkCourses] Error:', error);
      // Silent failure - don't disrupt the enrollment flow
    },
  });
}

/**
 * Hook to confirm or dismiss a suggested link
 */
export function useConfirmSuggestedLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recommendationId,
      action,
    }: {
      recommendationId: string;
      action: 'confirm' | 'dismiss';
    }) => {
      if (action === 'confirm') {
        // Update to active status
        const { error } = await supabase
          .from('recommendation_course_links')
          .update({
            link_status: 'active',
            link_type: 'enrolled',
          })
          .eq('recommendation_id', recommendationId);

        if (error) throw error;

        // Also update recommendation status to in_progress
        await supabase
          .from('recommendations')
          .update({ status: 'in_progress' })
          .eq('id', recommendationId)
          .in('status', ['pending', 'not_started']);
      } else {
        // Delete the suggested link
        const { error } = await supabase
          .from('recommendation_course_links')
          .delete()
          .eq('recommendation_id', recommendationId)
          .eq('link_status', 'suggested');

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      
      toast({
        title: variables.action === 'confirm' ? 'Link Confirmed' : 'Suggestion Dismissed',
        description: variables.action === 'confirm'
          ? 'Course linked to your learning plan'
          : 'We won\'t suggest this match again',
      });
    },
    onError: (error) => {
      console.error('[useConfirmSuggestedLink] Error:', error);
      toast({
        title: 'Action Failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    },
  });
}
