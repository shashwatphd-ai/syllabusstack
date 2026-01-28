import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SkillGap {
  id: string;
  skillId: string;
  skillName: string;
  category: string;
  currentLevel: string | null;
  requiredLevel: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  gapScore: number;
  recommendations: string[];
}

export interface GapAnalysisResult {
  dreamJobId: string;
  dreamJobTitle: string;
  overallMatchScore: number;
  skillGaps: SkillGap[];
  strengths: string[];
  analyzedAt: string;
}

export function useGapAnalysis(dreamJobId: string | undefined) {
  return useQuery({
    queryKey: ['gap-analysis', dreamJobId],
    queryFn: async (): Promise<GapAnalysisResult | null> => {
      if (!dreamJobId) return null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('gap_analyses')
        .select(`
          id,
          dream_job_id,
          match_score,
          strong_overlaps,
          critical_gaps,
          created_at,
          dream_jobs (
            id,
            title
          )
        `)
        .eq('dream_job_id', dreamJobId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error || !data) return null;
      
      const dreamJob = data.dream_jobs as { id: string; title: string } | null;
      const criticalGaps = (data.critical_gaps as Array<{ job_requirement: string; student_status: string; impact: string }>) || [];
      
      return {
        dreamJobId: data.dream_job_id,
        dreamJobTitle: dreamJob?.title || 'Unknown Job',
        overallMatchScore: data.match_score || 0,
        skillGaps: criticalGaps.map((gap, index) => ({
          id: `gap-${index}`,
          skillId: `skill-${index}`,
          skillName: gap.job_requirement,
          category: 'general',
          currentLevel: gap.student_status,
          requiredLevel: 'proficient',
          priority: 'high' as const,
          gapScore: 50,
          recommendations: [gap.impact],
        })),
        strengths: ((data.strong_overlaps as Array<{ student_capability: string }>) || []).map(o => o.student_capability),
        analyzedAt: data.created_at,
      };
    },
    enabled: !!dreamJobId,
  });
}

export function useGapAnalysisForJob(dreamJobId: string | undefined) {
  return useGapAnalysis(dreamJobId);
}
