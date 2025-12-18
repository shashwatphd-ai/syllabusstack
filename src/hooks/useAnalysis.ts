import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

// Types
export interface GapAnalysis {
  id: string;
  dream_job_id: string;
  overall_match_score: number;
  skills_aligned: number;
  gaps_identified: number;
  estimated_time_to_ready: string;
  honest_feedback: string;
  strengths: string[];
  weaknesses: string[];
  created_at: string;
}

export interface SkillGap {
  id: string;
  gap_analysis_id: string;
  skill: string;
  current_level: number;
  required_level: number;
  severity: 'critical' | 'important' | 'minor';
  category: string;
  description: string;
  estimated_time_to_close: string;
}

export interface SkillOverlap {
  id: string;
  gap_analysis_id: string;
  student_capability: string;
  job_requirement: string;
  strength: 'strong' | 'moderate' | 'partial';
  strength_score: number;
  assessment: string;
  source_course: string;
}

export interface CapabilityProfile {
  id: string;
  user_id: string;
  capabilities: {
    name: string;
    level: number;
    category: string;
    trend: 'up' | 'down' | 'stable';
  }[];
  last_updated: string;
}

// Mock data
const mockGapAnalysis: GapAnalysis = {
  id: '1',
  dream_job_id: '1',
  overall_match_score: 72,
  skills_aligned: 8,
  gaps_identified: 5,
  estimated_time_to_ready: '4-6 months',
  honest_feedback: 'You have a solid foundation in business analytics, but lack hands-on experience with product management tools and agile methodologies.',
  strengths: ['Data Analysis', 'Business Communication', 'Project Management'],
  weaknesses: ['Product Strategy', 'Technical Knowledge', 'Agile/Scrum'],
  created_at: new Date().toISOString(),
};

const mockCapabilityProfile: CapabilityProfile = {
  id: '1',
  user_id: 'mock-user',
  capabilities: [
    { name: 'Data Analysis', level: 4, category: 'Technical', trend: 'up' },
    { name: 'Communication', level: 4, category: 'Soft Skills', trend: 'stable' },
    { name: 'Project Management', level: 3, category: 'Management', trend: 'up' },
    { name: 'SQL', level: 3, category: 'Technical', trend: 'up' },
    { name: 'Excel', level: 4, category: 'Technical', trend: 'stable' },
    { name: 'Presentation', level: 3, category: 'Soft Skills', trend: 'up' },
  ],
  last_updated: new Date().toISOString(),
};

// API functions
const fetchGapAnalysis = async (dreamJobId: string): Promise<GapAnalysis | null> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  if (dreamJobId) {
    return { ...mockGapAnalysis, dream_job_id: dreamJobId };
  }
  return null;
};

const fetchCapabilityProfile = async (): Promise<CapabilityProfile> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  return mockCapabilityProfile;
};

// Hooks
export function useGapAnalysis(dreamJobId: string) {
  return useQuery({
    queryKey: queryKeys.gapAnalysis(dreamJobId),
    queryFn: () => fetchGapAnalysis(dreamJobId),
    enabled: !!dreamJobId,
  });
}

export function useCapabilityProfile() {
  return useQuery({
    queryKey: queryKeys.capabilityProfile(),
    queryFn: fetchCapabilityProfile,
  });
}
