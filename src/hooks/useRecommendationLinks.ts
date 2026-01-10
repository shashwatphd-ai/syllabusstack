import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

export interface RecommendationLink {
  id: string;
  recommendation_id: string;
  instructor_course_id: string | null;
  learning_objective_id: string | null;
  external_course_url: string | null;
  link_type: 'enrolled' | 'suggested' | 'external' | 'manual';
  link_status: 'active' | 'completed' | 'abandoned';
  progress_percentage: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface RecommendationWithLink {
  id: string;
  title: string;
  type: string;
  description: string;
  status: string;
  priority: string;
  gap_addressed: string | null;
  instructor_course_id: string | null;
  learning_objective_id: string | null;
  linked_external_url: string | null;
  link_type: string | null;
  link_status: string | null;
  link_progress: number | null;
  linked_course_title: string | null;
  linked_course_code: string | null;
  enrollment_progress: number | null;
  enrollment_completed_at: string | null;
}

/**
 * Hook to fetch recommendations with their course links
 */
export function useRecommendationsWithLinks(dreamJobId?: string) {
  return useQuery({
    queryKey: [...queryKeys.recommendations, 'with-links', dreamJobId],
    queryFn: async () => {
      if (!dreamJobId) return [];

      // Try to use the view, fallback to manual join if view doesn't exist
      const { data, error } = await supabase
        .from('recommendations')
        .select(`
          *,
          recommendation_course_links (
            id,
            instructor_course_id,
            learning_objective_id,
            external_course_url,
            link_type,
            link_status,
            progress_percentage,
            completed_at
          )
        `)
        .eq('dream_job_id', dreamJobId)
        .is('deleted_at', null)
        .order('priority', { ascending: true });

      if (error) {
        console.error('Error fetching recommendations with links:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!dreamJobId,
  });
}

/**
 * Hook to link a recommendation to a course
 */
export function useLinkRecommendationToCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recommendationId,
      instructorCourseId,
      learningObjectiveId,
      externalUrl,
    }: {
      recommendationId: string;
      instructorCourseId?: string;
      learningObjectiveId?: string;
      externalUrl?: string;
    }) => {
      // Try to use the database function first
      const { data, error } = await supabase.rpc('link_recommendation_to_course', {
        p_recommendation_id: recommendationId,
        p_instructor_course_id: instructorCourseId || null,
        p_learning_objective_id: learningObjectiveId || null,
        p_external_url: externalUrl || null,
      });

      if (error) {
        // Fallback to direct insert if function doesn't exist
        if (error.message.includes('does not exist')) {
          const linkType = instructorCourseId ? 'enrolled' : externalUrl ? 'external' : 'manual';

          const { data: insertData, error: insertError } = await supabase
            .from('recommendation_course_links')
            .upsert({
              recommendation_id: recommendationId,
              instructor_course_id: instructorCourseId || null,
              learning_objective_id: learningObjectiveId || null,
              external_course_url: externalUrl || null,
              link_type: linkType,
            }, {
              onConflict: 'recommendation_id',
            })
            .select()
            .single();

          if (insertError) throw insertError;
          return insertData;
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      toast({
        title: 'Course Linked',
        description: 'Recommendation linked to course. Progress will sync automatically.',
      });
    },
    onError: (error) => {
      console.error('Error linking recommendation:', error);
      toast({
        title: 'Link Failed',
        description: error instanceof Error ? error.message : 'Failed to link course',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to unlink a recommendation from a course
 */
export function useUnlinkRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recommendationId: string) => {
      const { error } = await supabase
        .from('recommendation_course_links')
        .delete()
        .eq('recommendation_id', recommendationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      toast({
        title: 'Link Removed',
        description: 'Recommendation unlinked from course.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Unlink Failed',
        description: error instanceof Error ? error.message : 'Failed to unlink course',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to get available courses for linking (user's enrolled courses)
 */
export function useAvailableCoursesForLinking() {
  return useQuery({
    queryKey: ['available-courses-for-linking'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('course_enrollments')
        .select(`
          id,
          instructor_course_id,
          overall_progress,
          completed_at,
          instructor_courses (
            id,
            title,
            code
          )
        `)
        .eq('student_id', user.id)
        .order('enrolled_at', { ascending: false });

      if (error) {
        console.error('Error fetching available courses:', error);
        return [];
      }

      return (data || []).map((enrollment: any) => ({
        enrollmentId: enrollment.id,
        courseId: enrollment.instructor_course_id,
        title: enrollment.instructor_courses?.title || 'Untitled Course',
        code: enrollment.instructor_courses?.code || '',
        progress: enrollment.overall_progress || 0,
        completed: !!enrollment.completed_at,
      }));
    },
  });
}
