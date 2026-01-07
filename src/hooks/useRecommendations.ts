import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

export type Recommendation = Tables<'recommendations'>;
export type RecommendationUpdate = TablesUpdate<'recommendations'>;

// Fetch recommendations
async function fetchRecommendations(dreamJobId?: string): Promise<Recommendation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('recommendations')
    .select('*')
    .eq('user_id', user.id)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (dreamJobId) {
    query = query.eq('dream_job_id', dreamJobId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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
