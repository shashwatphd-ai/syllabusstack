import { supabase } from '@/integrations/supabase/client';

export interface Capability {
  name: string;
  category: string;
  proficiency_level: string;
}

export interface AnalyzeSyllabusResponse {
  capabilities: Capability[];
  error?: string;
}

export async function analyzeSyllabus(
  syllabusText: string,
  courseId?: string
): Promise<AnalyzeSyllabusResponse> {
  const { data, error } = await supabase.functions.invoke('analyze-syllabus', {
    body: { syllabusText, courseId }
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export interface JobRequirement {
  skill_name: string;
  importance: 'critical' | 'important' | 'nice_to_have';
  category: string;
}

export interface DayOneCapability {
  requirement: string;
  importance: 'critical' | 'important' | 'nice_to_have';
}

export interface AnalyzeDreamJobResponse {
  requirements: JobRequirement[];
  description?: string;
  salary_range?: string;
  day_one_capabilities?: DayOneCapability[];
  differentiators?: string[];
  common_misconceptions?: string[];
  realistic_bar?: string;
  error?: string;
}

export async function analyzeDreamJob(
  jobTitle: string,
  companyType?: string,
  location?: string,
  dreamJobId?: string
): Promise<AnalyzeDreamJobResponse> {
  const { data, error } = await supabase.functions.invoke('analyze-dream-job', {
    body: { jobTitle, companyType, location, dreamJobId }
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

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
  top_strengths?: string[];
  critical_gaps?: string[];
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

export interface Recommendation {
  title: string;
  type: 'course' | 'certification' | 'project' | 'experience' | 'skill';
  description: string;
  provider?: string;
  url?: string;
  duration?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface GenerateRecommendationsResponse {
  recommendations: Recommendation[];
  error?: string;
}

export async function generateRecommendations(
  dreamJobId: string,
  gaps: SkillGap[]
): Promise<GenerateRecommendationsResponse> {
  const { data, error } = await supabase.functions.invoke('generate-recommendations', {
    body: { dreamJobId, gaps }
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}
