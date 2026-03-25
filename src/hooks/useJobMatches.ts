import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { useRealtimeChannel } from './useRealtimeChannel';
import { useToast } from '@/hooks/use-toast';

export interface JobMatch {
  id: string;
  student_id: string;
  job_title: string;
  company_name: string | null;
  company_profile_id: string | null;
  match_score: number;
  skill_overlap: {
    matched: string[];
    missing: string[];
    extra: string[];
  } | null;
  salary_estimate: {
    min: number | null;
    max: number | null;
    currency: string;
  } | null;
  location: string | null;
  source: string | null;
  status: string;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch job matches for the current student
 */
export function useJobMatches() {
  return useQuery({
    queryKey: queryKeys.jobMatches.list(),
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any)
        .from('job_matches')
        .select('*')
        .eq('student_id', user.id)
        .order('match_score', { ascending: false });

      if (error) throw error;
      return (data || []) as JobMatch[];
    },
  });
}

/**
 * Trigger the job-matcher edge function to refresh matches
 */
export function useRefreshJobMatches() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params?: { course_id?: string }) => {
      const { data, error } = await supabase.functions.invoke('job-matcher', {
        body: params || {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobMatches.all() });
      toast({
        title: 'Job Matches Updated',
        description: `Found ${data?.total_matches || 0} matching opportunities.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Match Error',
        description: error instanceof Error ? error.message : 'Failed to refresh matches',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Update job match status (e.g., mark as applied)
 */
export function useUpdateJobMatchStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, status }: { matchId: string; status: string }) => {
      const { error } = await supabase
        .from('job_matches')
        .update({ status })
        .eq('id', matchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobMatches.all() });
    },
  });
}

/**
 * Subscribe to realtime job match updates
 */
export function useJobMatchesRealtime(studentId: string | undefined) {
  useRealtimeChannel(
    studentId ? `job-matches-${studentId}` : '',
    'job_matches',
    studentId ? `student_id=eq.${studentId}` : undefined,
    [queryKeys.jobMatches.all()],
    5000,
    !!studentId
  );
}
