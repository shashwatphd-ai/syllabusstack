import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

export type Recommendation = Tables<'recommendations'>;
export type RecommendationUpdate = TablesUpdate<'recommendations'>;

// Extended recommendation type with linked course data
export interface RecommendationWithLinks extends Recommendation {
  linked_course_id?: string | null;
  linked_course_title?: string | null;
  enrollment_progress?: number | null;
}

// Fetch recommendations with linked course data
async function fetchRecommendations(dreamJobId?: string): Promise<RecommendationWithLinks[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // First fetch recommendations
  let query = supabase
    .from('recommendations')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (dreamJobId) {
    query = query.eq('dream_job_id', dreamJobId);
  }

  const { data: recs, error } = await query;
  if (error) throw error;
  if (!recs || recs.length === 0) return [];

  // Fetch linked courses and enrollments in parallel (N+1 fix)
  const recIds = recs.map(r => r.id);
  const [linksResult, enrollmentsResult] = await Promise.all([
    supabase
      .from('recommendation_course_links')
      .select(`
        recommendation_id,
        instructor_course_id,
        instructor_course:instructor_courses (
          id,
          title
        )
      `)
      .in('recommendation_id', recIds)
      .eq('link_status', 'active'),
    supabase
      .from('course_enrollments')
      .select('instructor_course_id, overall_progress')
      .eq('student_id', user.id)
  ]);

  const links = linksResult.data;
  const enrollments = enrollmentsResult.data;

  // Create lookup maps
  const linkMap = new Map<string, { courseId: string; title: string }>();
  links?.forEach(link => {
    if (link.instructor_course) {
      const course = link.instructor_course as { id: string; title: string };
      linkMap.set(link.recommendation_id, {
        courseId: course.id,
        title: course.title
      });
    }
  });

  const progressMap = new Map<string, number>();
  enrollments?.forEach(e => {
    progressMap.set(e.instructor_course_id, e.overall_progress || 0);
  });

  // Merge data
  return recs.map(rec => {
    const linkedCourse = linkMap.get(rec.id);
    return {
      ...rec,
      linked_course_id: linkedCourse?.courseId || null,
      linked_course_title: linkedCourse?.title || null,
      enrollment_progress: linkedCourse ? (progressMap.get(linkedCourse.courseId) ?? null) : null,
    };
  });
}

// Update recommendation status
async function updateRecommendationStatus(
  id: string,
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
): Promise<Recommendation> {
  const { data, error } = await supabase
    .from('recommendations')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Hooks
export function useRecommendations(dreamJobId?: string) {
  return useQuery({
    queryKey: queryKeys.recommendationsList(dreamJobId),
    queryFn: () => fetchRecommendations(dreamJobId),
  });
}

export function useUpdateRecommendationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'in_progress' | 'completed' | 'skipped' }) =>
      updateRecommendationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      toast({
        title: 'Status updated',
        description: 'Recommendation status has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      });
    },
  });
}

// Fetch anti-recommendations for a dream job
export type AntiRecommendation = {
  id: string;
  user_id: string;
  dream_job_id: string;
  action: string;
  reason: string;
  created_at: string;
};

async function fetchAntiRecommendations(dreamJobId?: string): Promise<AntiRecommendation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('anti_recommendations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (dreamJobId) {
    query = query.eq('dream_job_id', dreamJobId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export function useAntiRecommendations(dreamJobId?: string) {
  return useQuery({
    queryKey: queryKeys.antiRecommendations(dreamJobId),
    queryFn: () => fetchAntiRecommendations(dreamJobId),
    enabled: !!dreamJobId,
  });
}
