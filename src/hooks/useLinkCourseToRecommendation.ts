import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query-keys';

/**
 * Hook to link an enrolled course to a recommendation
 * This creates the link and updates the recommendation status to in_progress
 */
export function useLinkCourseToRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      enrollmentId,
      courseId,
      recommendationId,
    }: {
      enrollmentId: string;
      courseId: string;
      recommendationId: string;
    }) => {
      // Create the link
      const { error: linkError } = await supabase
        .from('recommendation_course_links')
        .upsert({
          recommendation_id: recommendationId,
          instructor_course_id: courseId,
          link_type: 'enrolled',
          link_status: 'active',
          progress_percentage: 0,
        }, {
          onConflict: 'recommendation_id',
        });

      if (linkError) throw linkError;

      // Update recommendation status to in_progress if it was pending
      const { error: updateError } = await supabase
        .from('recommendations')
        .update({ status: 'in_progress' })
        .eq('id', recommendationId)
        .eq('status', 'pending');

      // Ignore update error - status change is optional
      if (updateError) {
        console.warn('Could not update recommendation status:', updateError);
      }

      return { enrollmentId, courseId, recommendationId };
    },
    onSuccess: () => {
      // Invalidate both recommendations and enrollments queries
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: ['student-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['available-courses-for-linking'] });
      
      toast({
        title: 'Course Linked',
        description: 'Your enrolled course is now linked to this recommendation. Progress will sync automatically.',
      });
    },
    onError: (error) => {
      console.error('Error linking course:', error);
      toast({
        title: 'Failed to Link Course',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to unlink a course from a recommendation
 */
export function useUnlinkCourseFromRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recommendationId: string) => {
      const { error } = await supabase
        .from('recommendation_course_links')
        .delete()
        .eq('recommendation_id', recommendationId);

      if (error) throw error;

      // Optionally revert status to pending
      await supabase
        .from('recommendations')
        .update({ status: 'pending' })
        .eq('id', recommendationId)
        .eq('status', 'in_progress');

      return recommendationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: ['available-courses-for-linking'] });
      
      toast({
        title: 'Course Unlinked',
        description: 'The course has been unlinked from this recommendation.',
      });
    },
    onError: (error) => {
      console.error('Error unlinking course:', error);
      toast({
        title: 'Failed to Unlink',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    },
  });
}
