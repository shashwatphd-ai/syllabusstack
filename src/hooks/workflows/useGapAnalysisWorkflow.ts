import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';
import { performGapAnalysis } from '@/services/gap-analysis-service';
import { generateRecommendations } from '@/services/recommendations-service';

async function refreshGapAnalysis(dreamJobId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Perform gap analysis
  const gapResult = await performGapAnalysis(dreamJobId);

  // Update or insert gap analysis record
  const { data: existingAnalysis } = await supabase
    .from('gap_analyses')
    .select('id')
    .eq('dream_job_id', dreamJobId)
    .eq('user_id', user.id)
    .single();

  const analysisData = {
    user_id: user.id,
    dream_job_id: dreamJobId,
    match_score: gapResult.match_score || 0,
    strong_overlaps: gapResult.strong_overlaps || [],
    partial_overlaps: gapResult.partial_overlaps || [],
    critical_gaps: gapResult.critical_gaps || [],
    priority_gaps: gapResult.priority_gaps || [],
    honest_assessment: gapResult.honest_assessment || null,
    readiness_level: gapResult.readiness_level || null,
    interview_readiness: gapResult.interview_readiness || null,
    job_success_prediction: gapResult.job_success_prediction || null,
  };

  if (existingAnalysis) {
    await supabase
      .from('gap_analyses')
      .update(analysisData)
      .eq('id', existingAnalysis.id);
  } else {
    await supabase.from('gap_analyses').insert(analysisData);
  }

  // Generate recommendations based on gaps
  const gapsToRecommend = gapResult.gaps || [];
  
  if (gapsToRecommend.length > 0) {
    try {
      await generateRecommendations(dreamJobId, gapsToRecommend);
    } catch (recError) {
      console.error('Failed to generate recommendations:', recError);
    }
  }

  return gapResult;
}

async function refreshAllAnalyses() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: dreamJobs } = await supabase
    .from('dream_jobs')
    .select('id')
    .eq('user_id', user.id);

  if (!dreamJobs || dreamJobs.length === 0) {
    throw new Error('No dream jobs found');
  }

  const results = await Promise.allSettled(
    dreamJobs.map(job => refreshGapAnalysis(job.id))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return { succeeded, failed, total: dreamJobs.length };
}

export function useRefreshAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshGapAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      
      toast({
        title: 'Analysis refreshed',
        description: 'Your gap analysis has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error refreshing analysis',
        description: error instanceof Error ? error.message : 'Failed to refresh analysis',
        variant: 'destructive',
      });
    },
  });
}

export function useRefreshAllAnalyses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshAllAnalyses,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      
      toast({
        title: 'Analyses refreshed',
        description: `Updated ${result.succeeded} of ${result.total} analyses.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error refreshing analyses',
        description: error instanceof Error ? error.message : 'Failed to refresh analyses',
        variant: 'destructive',
      });
    },
  });
}
