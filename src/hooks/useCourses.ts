import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';
import { performGapAnalysis, generateRecommendations } from '@/services';

// Types from database
export type Course = Tables<'courses'>;
export type CourseInsert = TablesInsert<'courses'>;

export interface CourseCapability {
  id: string;
  course_id: string;
  capability_name: string;
  proficiency_level: number;
  evidence: string;
  category: string;
}

// Fetch all courses for the current user
async function fetchCourses(): Promise<Course[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Fetch a single course by ID
async function fetchCourseById(id: string): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

// Create a new course
async function createCourse(course: Omit<CourseInsert, 'user_id'>): Promise<Course> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('courses')
    .insert({ ...course, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Check if gap analysis is fresh (less than 24 hours old)
async function isAnalysisFresh(dreamJobId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('gap_analyses')
    .select('updated_at')
    .eq('dream_job_id', dreamJobId)
    .eq('user_id', userId)
    .limit(1);

  if (!data || data.length === 0) return false;
  
  const analysisAge = Date.now() - new Date(data[0].updated_at).getTime();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return analysisAge < twentyFourHours;
}

// Auto-refresh gap analyses for all dream jobs when courses change
// Only refreshes if existing analysis is older than 24 hours
// Now parallelized with Promise.allSettled for better performance
async function refreshAllGapAnalyses() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: dreamJobs } = await supabase
    .from('dream_jobs')
    .select('id')
    .eq('user_id', user.id);

  if (!dreamJobs || dreamJobs.length === 0) return;

  console.log('[Workflow] Checking gap analyses freshness for', dreamJobs.length, 'dream jobs');
  
  // Check freshness for all jobs in parallel
  const freshnessChecks = await Promise.all(
    dreamJobs.map(async job => ({
      job,
      isFresh: await isAnalysisFresh(job.id, user.id)
    }))
  );
  
  // Filter to only stale analyses
  const staleJobs = freshnessChecks
    .filter(({ isFresh }) => !isFresh)
    .map(({ job }) => job);
  
  if (staleJobs.length === 0) {
    console.log('[Workflow] All analyses are fresh, skipping refresh');
    return;
  }

  console.log('[Workflow] Refreshing', staleJobs.length, 'stale analyses in parallel');
  
  // Process stale analyses in parallel with Promise.allSettled (handles partial failures)
  const results = await Promise.allSettled(
    staleJobs.map(async job => {
      console.log('[Workflow] Refreshing stale analysis for job:', job.id);
      const gapResult = await performGapAnalysis(job.id);
      if (gapResult.gaps && gapResult.gaps.length > 0) {
        await generateRecommendations(job.id, gapResult.gaps);
      }
      return job.id;
    })
  );
  
  // Log any failures
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error('[Workflow] Failed to refresh analysis for job:', staleJobs[index].id, result.reason);
    }
  });
}

// Delete a course and its associated capabilities
async function deleteCourse(id: string): Promise<void> {
  // First delete associated capabilities (no cascade delete on this FK)
  const { error: capError } = await supabase
    .from('capabilities')
    .delete()
    .eq('course_id', id);

  if (capError) {
    console.error('Error deleting capabilities:', capError);
    // Continue anyway - capabilities might not exist
  }

  // Then delete the course
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Hooks
export function useCourses() {
  return useQuery({
    queryKey: queryKeys.coursesList(),
    queryFn: fetchCourses,
  });
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: queryKeys.courseDetail(id),
    queryFn: () => fetchCourseById(id),
    enabled: !!id,
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      // Invalidate directly related queries only (reduces cascading refetches)
      queryClient.invalidateQueries({ queryKey: queryKeys.courses });
      queryClient.invalidateQueries({ queryKey: queryKeys.capabilities });
      // Note: Don't invalidate analysis/dashboard here - they'll refetch when accessed
      // This prevents unnecessary API calls when user is just managing courses

      // Auto-refresh gap analyses in background (don't block)
      refreshAllGapAnalyses().catch(console.error);

      toast({
        title: 'Course added',
        description: 'Your course has been added successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add course',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Course> }) => {
      const { data, error } = await supabase
        .from('courses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate directly related queries only
      queryClient.invalidateQueries({ queryKey: queryKeys.courses });
      queryClient.invalidateQueries({ queryKey: queryKeys.courseDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.capabilities });
      // Note: analysis queries will refetch when user navigates to analysis page
      toast({
        title: 'Course updated',
        description: 'Your course has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update course',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCourse,
    onSuccess: () => {
      // Invalidate directly related queries only (reduces cascading refetches)
      queryClient.invalidateQueries({ queryKey: queryKeys.courses });
      queryClient.invalidateQueries({ queryKey: queryKeys.capabilities });
      // Note: analysis/dashboard will refetch when accessed

      // Auto-refresh gap analyses in background after course deletion
      refreshAllGapAnalyses().catch(console.error);

      toast({
        title: 'Course deleted',
        description: 'Your course has been removed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete course',
        variant: 'destructive',
      });
    },
  });
}
