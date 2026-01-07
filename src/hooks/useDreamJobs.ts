import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';
import { analyzeDreamJob, performGapAnalysis, generateRecommendations } from '@/services';

// Types from database
export type DreamJob = Tables<'dream_jobs'>;
export type DreamJobInsert = TablesInsert<'dream_jobs'>;

export interface JobRequirement {
  id: string;
  dream_job_id: string;
  requirement_name: string;
  importance_level: 'required' | 'preferred' | 'nice-to-have';
  category: string;
  description: string;
}

// Fetch all dream jobs for the current user
async function fetchDreamJobs(): Promise<DreamJob[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('dream_jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Fetch a single dream job by ID
async function fetchDreamJobById(id: string): Promise<DreamJob | null> {
  const { data, error } = await supabase
    .from('dream_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

// Create a new dream job with automated analysis workflow
async function createDreamJobWithWorkflow(job: Omit<DreamJobInsert, 'user_id'>): Promise<DreamJob> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Create the dream job
  const { data: newJob, error } = await supabase
    .from('dream_jobs')
    .insert({ ...job, user_id: user.id })
    .select()
    .single();

  if (error) throw error;

  // 2. Auto-trigger job requirements analysis (async, don't block)
  (async () => {
    try {
      console.log('[Workflow] Auto-analyzing job requirements for:', newJob.id);
      const analysisResult = await analyzeDreamJob(
        job.title,
        job.company_type || undefined,
        job.location || undefined,
        newJob.id
      );

      if (analysisResult) {
        await supabase
          .from('dream_jobs')
          .update({
            day_one_capabilities: analysisResult.day_one_capabilities?.slice(0, 10).map(r => r.requirement) || [],
            realistic_bar: analysisResult.realistic_bar || null,
            differentiators: analysisResult.differentiators || [],
            common_misconceptions: analysisResult.common_misconceptions || [],
            requirements_keywords: analysisResult.requirements?.map(r => r.skill_name) || [],
          })
          .eq('id', newJob.id);

        // 3. Auto-trigger gap analysis after job analysis
        console.log('[Workflow] Auto-triggering gap analysis for:', newJob.id);
        const gapResult = await performGapAnalysis(newJob.id);

        // 4. Auto-generate recommendations based on gaps
        if (gapResult.gaps && gapResult.gaps.length > 0) {
          console.log('[Workflow] Auto-generating recommendations for:', newJob.id);
          await generateRecommendations(newJob.id, gapResult.gaps);
        }
      }
    } catch (workflowError) {
      console.error('[Workflow] Background analysis failed:', workflowError);
      // Don't throw - background task shouldn't break the main flow
    }
  })();

  return newJob;
}

// Delete a dream job
async function deleteDreamJob(id: string): Promise<void> {
  const { error } = await supabase
    .from('dream_jobs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Fetch gap analyses for all user's dream jobs
async function fetchGapAnalysesForJobs() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('gap_analyses')
    .select('id, dream_job_id, critical_gaps, priority_gaps, match_score')
    .eq('user_id', user.id);

  if (error) throw error;
  return data || [];
}

// Hooks
export function useDreamJobs() {
  return useQuery({
    queryKey: queryKeys.dreamJobsList(),
    queryFn: fetchDreamJobs,
  });
}

export function useGapAnalysesForJobs() {
  return useQuery({
    queryKey: [...queryKeys.analysis, 'all-gap-analyses'],
    queryFn: fetchGapAnalysesForJobs,
  });
}

export function useDreamJob(id: string) {
  return useQuery({
    queryKey: queryKeys.dreamJobDetail(id),
    queryFn: () => fetchDreamJobById(id),
    enabled: !!id,
  });
}

export function useCreateDreamJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDreamJobWithWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dreamJobs });
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast({
        title: 'Dream job added',
        description: 'Analyzing requirements and generating gap analysis...',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add dream job',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateDreamJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DreamJob> }) => {
      const { data, error } = await supabase
        .from('dream_jobs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dreamJobs });
      queryClient.invalidateQueries({ queryKey: queryKeys.dreamJobDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
      toast({
        title: 'Dream job updated',
        description: 'Your dream job has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update dream job',
        variant: 'destructive',
      });
    },
  });
}

export function useSetPrimaryDreamJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // First, set all jobs to not primary
      await supabase
        .from('dream_jobs')
        .update({ is_primary: false })
        .eq('user_id', user.id);

      // Then set the selected one as primary
      const { data, error } = await supabase
        .from('dream_jobs')
        .update({ is_primary: true })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dreamJobs });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast({
        title: 'Primary job updated',
        description: 'Your primary dream job has been set.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to set primary job',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteDreamJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDreamJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dreamJobs });
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast({
        title: 'Dream job removed',
        description: 'The dream job has been deleted.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete dream job',
        variant: 'destructive',
      });
    },
  });
}
