import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { generateRecommendations, SkillGap, SkillOverlap } from '@/services';
import { toast } from '@/hooks/use-toast';

// Re-export types from services
export type { SkillGap, SkillOverlap };

export interface GapAnalysisData {
  id: string;
  dream_job_id: string;
  match_score: number | null;
  honest_assessment: string | null;
  readiness_level: string | null;
  interview_readiness: string | null;
  job_success_prediction: string | null;
  strong_overlaps: unknown;
  partial_overlaps: unknown;
  critical_gaps: unknown;
  priority_gaps: unknown;
  created_at: string;
  updated_at: string;
}

export interface CapabilityProfile {
  totalCapabilities: number;
  categories: { name: string; count: number; percentage: number }[];
  topSkills: { name: string; level: string; category: string }[];
  recentlyAdded: { name: string; addedAt: string }[];
  trend: 'improving' | 'stable' | 'declining';
}

// Fetch gap analysis from DATABASE (instant, cached data)
async function fetchGapAnalysisFromDB(dreamJobId: string): Promise<GapAnalysisData | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('gap_analyses')
    .select('*')
    .eq('dream_job_id', dreamJobId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Run AI gap analysis (expensive, only on demand)
async function runGapAnalysisAI(dreamJobId: string): Promise<GapAnalysisData> {
  const { data, error } = await supabase.functions.invoke('gap-analysis', {
    body: { dreamJobId }
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);

  // Return the saved analysis
  return {
    id: data.gap_analysis_id,
    dream_job_id: dreamJobId,
    match_score: data.match_score,
    honest_assessment: data.honest_assessment,
    readiness_level: data.readiness_level,
    interview_readiness: data.interview_readiness,
    job_success_prediction: data.job_success_prediction,
    strong_overlaps: data.strong_overlaps,
    partial_overlaps: data.partial_overlaps,
    critical_gaps: data.critical_gaps,
    priority_gaps: data.priority_gaps,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Fetch capability profile from database
async function fetchCapabilityProfile(): Promise<CapabilityProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: capabilities, error } = await supabase
    .from('capabilities')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const caps = capabilities || [];
  
  // Calculate category breakdown
  const categoryMap: Record<string, number> = {};
  caps.forEach(cap => {
    const cat = cap.category || 'other';
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  });

  const categories = Object.entries(categoryMap).map(([name, count]) => ({
    name,
    count,
    percentage: caps.length > 0 ? Math.round((count / caps.length) * 100) : 0
  })).sort((a, b) => b.count - a.count);

  // Top skills (by proficiency)
  const proficiencyOrder = ['expert', 'advanced', 'intermediate', 'beginner'];
  const topSkills = [...caps]
    .sort((a, b) => {
      const aIdx = proficiencyOrder.indexOf(a.proficiency_level || 'beginner');
      const bIdx = proficiencyOrder.indexOf(b.proficiency_level || 'beginner');
      return aIdx - bIdx;
    })
    .slice(0, 5)
    .map(cap => ({
      name: cap.name,
      level: cap.proficiency_level || 'beginner',
      category: cap.category || 'other'
    }));

  // Recently added
  const recentlyAdded = caps.slice(0, 5).map(cap => ({
    name: cap.name,
    addedAt: cap.created_at
  }));

  return {
    totalCapabilities: caps.length,
    categories,
    topSkills,
    recentlyAdded,
    trend: caps.length > 5 ? 'improving' : 'stable'
  };
}

// HOOK: Read gap analysis from DB (FAST - for page load)
export function useGapAnalysis(dreamJobId: string) {
  return useQuery({
    queryKey: queryKeys.gapAnalysis(dreamJobId),
    queryFn: () => fetchGapAnalysisFromDB(dreamJobId),
    enabled: !!dreamJobId,
    staleTime: 1000 * 60 * 10, // 10 minutes - it's cached data
  });
}

// HOOK: Run AI analysis on demand (SLOW - only when user clicks refresh)
export function useRefreshGapAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dreamJobId: string) => runGapAnalysisAI(dreamJobId),
    onSuccess: (data, dreamJobId) => {
      // Update cache with new data
      queryClient.setQueryData(queryKeys.gapAnalysis(dreamJobId), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dreamJobs });
      toast({
        title: 'Analysis complete',
        description: 'Your gap analysis has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'Failed to run gap analysis',
        variant: 'destructive',
      });
    },
  });
}

export function useCapabilityProfile() {
  return useQuery({
    queryKey: queryKeys.capabilityProfile(),
    queryFn: fetchCapabilityProfile,
  });
}

export function useGenerateRecommendations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dreamJobId, gaps }: { dreamJobId: string; gaps: SkillGap[] }) =>
      generateRecommendations(dreamJobId, gaps),
    onSuccess: (_, { dreamJobId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendationsList(dreamJobId) });
    },
  });
}
