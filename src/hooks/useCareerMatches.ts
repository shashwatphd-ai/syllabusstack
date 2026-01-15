import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CareerMatch {
  id: string;
  user_id: string;
  skill_profile_id: string | null;
  onet_soc_code: string;
  occupation_title: string;
  overall_match_score: number;
  skill_match_score: number | null;
  interest_match_score: number | null;
  values_match_score: number | null;
  match_breakdown: {
    holland_similarity?: number;
    skill_gaps?: Array<{ skill: string; gap: number }>;
    top_matching_skills?: string[];
  } | null;
  skill_gaps: Array<{
    skill: string;
    required_level: number;
    current_level: number;
    gap: number;
  }> | null;
  dream_job_id: string | null;
  is_saved: boolean | null;
  is_dismissed: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ONetOccupation {
  id: string;
  soc_code: string;
  title: string;
  description: string | null;
  riasec_code: string | null;
  riasec_scores: Record<string, number> | null;
  required_skills: Array<{ skill: string; level: number; importance: string }> | null;
  required_knowledge: Array<{ name: string; level: number }> | null;
  required_abilities: Array<{ name: string; level: number }> | null;
  work_values: Record<string, number> | null;
  education_level: string | null;
  experience_level: string | null;
  median_wage: number | null;
  job_outlook: string | null;
  job_outlook_percent: number | null;
  employment_count: number | null;
  bright_outlook: boolean | null;
  green_occupation: boolean | null;
}

export interface CareerFilters {
  minMatchScore?: number;
  educationLevel?: string;
  minSalary?: number;
  brightOutlookOnly?: boolean;
  excludeDismissed?: boolean;
}

// Hook: Trigger career matching
export function useMatchCareers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ topN = 20 }: { topN?: number } = {}) => {
      const { data, error } = await supabase.functions.invoke('match-careers', {
        body: { top_n: topN },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as {
        success: boolean;
        matches: CareerMatch[];
        total_occupations_analyzed: number;
        skill_profile_id: string;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['career-matches'] });
      toast({
        title: 'Career Matches Found!',
        description: `Analyzed ${data.total_occupations_analyzed} occupations, found ${data.matches.length} matches`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Matching Failed',
        description: error instanceof Error ? error.message : 'Failed to find career matches',
        variant: 'destructive',
      });
    },
  });
}

// Hook: Get user's career matches
export function useCareerMatches(filters?: CareerFilters) {
  return useQuery({
    queryKey: ['career-matches', filters],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('career_matches')
        .select('*')
        .eq('user_id', user.id)
        .order('overall_match_score', { ascending: false });

      if (filters?.minMatchScore) {
        query = query.gte('overall_match_score', filters.minMatchScore);
      }

      if (filters?.excludeDismissed !== false) {
        query = query.or('is_dismissed.is.null,is_dismissed.eq.false');
      }

      const { data, error } = await query;
      if (error) throw error;

      return data as CareerMatch[];
    },
  });
}

// Hook: Get single occupation details
export function useONetOccupation(socCode?: string) {
  return useQuery({
    queryKey: ['onet-occupation', socCode],
    queryFn: async () => {
      if (!socCode) return null;

      const { data, error } = await supabase.functions.invoke('get-onet-occupation', {
        body: { soc_code: socCode },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data.occupation as ONetOccupation;
    },
    enabled: !!socCode,
  });
}

// Hook: Save/dismiss career match
export function useUpdateCareerMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      matchId,
      updates,
    }: {
      matchId: string;
      updates: { is_saved?: boolean; is_dismissed?: boolean };
    }) => {
      const { data, error } = await supabase
        .from('career_matches')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', matchId)
        .select()
        .single();

      if (error) throw error;
      return data as CareerMatch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['career-matches'] });
    },
  });
}

// Hook: Add career match to dream jobs
export function useAddMatchToDreamJobs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ match }: { match: CareerMatch }) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create dream job
      const { data: dreamJob, error: djError } = await supabase
        .from('dream_jobs')
        .insert([{
          user_id: user.id,
          title: match.occupation_title,
          description: `O*NET occupation: ${match.onet_soc_code}`,
          match_score: match.overall_match_score,
        }])
        .select()
        .single();

      if (djError) throw djError;

      // Update career match with dream_job_id
      const { error: cmError } = await supabase
        .from('career_matches')
        .update({ 
          dream_job_id: dreamJob.id,
          is_saved: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.id);

      if (cmError) throw cmError;

      return dreamJob;
    },
    onSuccess: (dreamJob) => {
      queryClient.invalidateQueries({ queryKey: ['career-matches'] });
      queryClient.invalidateQueries({ queryKey: ['dream-jobs'] });
      
      toast({
        title: 'Added to Dream Jobs!',
        description: `${dreamJob.title} is now in your dream jobs`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to add',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}

// Hook: Get saved career matches
export function useSavedCareerMatches() {
  return useQuery({
    queryKey: ['career-matches', 'saved'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('career_matches')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_saved', true)
        .order('overall_match_score', { ascending: false });

      if (error) throw error;
      return data as CareerMatch[];
    },
  });
}
