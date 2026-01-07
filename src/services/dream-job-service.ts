import { supabase } from '@/integrations/supabase/client';

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
