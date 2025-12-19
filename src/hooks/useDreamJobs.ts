import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

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

// Create a new dream job
async function createDreamJob(job: Omit<DreamJobInsert, 'user_id'>): Promise<DreamJob> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('dream_jobs')
    .insert({ ...job, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete a dream job
async function deleteDreamJob(id: string): Promise<void> {
  const { error } = await supabase
    .from('dream_jobs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Hooks
export function useDreamJobs() {
  return useQuery({
    queryKey: queryKeys.dreamJobsList(),
    queryFn: fetchDreamJobs,
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
    mutationFn: createDreamJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dreamJobs });
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast({
        title: 'Dream job added',
        description: 'Your dream job has been saved.',
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
