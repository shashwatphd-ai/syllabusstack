import { supabase } from '@/integrations/supabase/client';

export interface SkillOverlap {
  capability: string;
  requirement: string;
  strength: 'strong' | 'moderate' | 'partial';
  notes?: string;
}

export interface SkillGap {
  requirement: string;
  importance: 'critical' | 'important' | 'nice_to_have';
  difficulty: 'easy' | 'moderate' | 'challenging';
  time_to_close: string;
  suggested_action?: string;
}

export interface GapAnalysisResponse {
  match_score: number;
  overlaps: SkillOverlap[];
  gaps: SkillGap[];
  honest_assessment: string;
  readiness_level?: 'ready_to_apply' | '3_months_away' | '6_months_away' | '1_year_away' | 'needs_significant_development';
  interview_readiness?: string;
  job_success_prediction?: string;
  strong_overlaps?: Array<{
    student_capability: string;
    job_requirement: string;
    assessment: string;
  }>;
  partial_overlaps?: Array<{
    student_capability: string;
    job_requirement: string;
    assessment: string;
  }>;
  critical_gaps?: Array<{
    job_requirement: string;
    student_status: string;
    impact: string;
  }>;
  priority_gaps?: Array<{
    gap: string;
    priority: number;
    reason: string;
  }>;
  anti_recommendations?: string[];
  error?: string;
}

export async function performGapAnalysis(dreamJobId: string): Promise<GapAnalysisResponse> {
  const { data, error } = await supabase.functions.invoke('gap-analysis', {
    body: { dreamJobId }
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}
