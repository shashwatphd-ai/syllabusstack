import { supabase } from '@/integrations/supabase/client';
import { SkillGap } from './gap-analysis-service';

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
