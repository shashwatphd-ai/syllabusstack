import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SkillProfile {
  id: string;
  user_id: string;
  holland_code: string | null;
  holland_scores: Record<string, number>;
  technical_skills: Record<string, number>;
  work_values: Record<string, number>;
  assessment_version: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HollandDimension {
  key: string;
  label: string;
  description: string;
  score: number;
}

const HOLLAND_LABELS: Record<string, { label: string; description: string }> = {
  realistic: {
    label: 'Realistic',
    description: 'Practical, hands-on problem solving with tools and machines',
  },
  investigative: {
    label: 'Investigative',
    description: 'Analytical thinking, research, and exploring ideas',
  },
  artistic: {
    label: 'Artistic',
    description: 'Creative expression, originality, and imagination',
  },
  social: {
    label: 'Social',
    description: 'Helping, teaching, and working with people',
  },
  enterprising: {
    label: 'Enterprising',
    description: 'Leading, persuading, and business ventures',
  },
  conventional: {
    label: 'Conventional',
    description: 'Organizing data, attention to detail, and following procedures',
  },
};

const WORK_VALUE_LABELS: Record<string, { label: string; description: string }> = {
  achievement: {
    label: 'Achievement',
    description: 'Results-oriented work that lets you use your abilities',
  },
  independence: {
    label: 'Independence',
    description: 'Autonomous work with freedom to make decisions',
  },
  recognition: {
    label: 'Recognition',
    description: 'Advancement potential and prestige',
  },
  relationships: {
    label: 'Relationships',
    description: 'Friendly coworkers and service to others',
  },
  support: {
    label: 'Support',
    description: 'Supportive management and fair policies',
  },
  working_conditions: {
    label: 'Working Conditions',
    description: 'Job security, good pay, and pleasant environment',
  },
};

// Fetch current user's skill profile
export function useSkillProfile() {
  return useQuery({
    queryKey: ['skill-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('skill_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as SkillProfile | null;
    },
  });
}

// Check if user has completed assessment
export function useHasCompletedAssessment() {
  const { data: profile, isLoading } = useSkillProfile();
  return {
    hasCompleted: !!profile?.completed_at,
    isLoading,
    profile,
  };
}

// Get Holland dimensions with labels and scores
export function useHollandDimensions() {
  const { data: profile, isLoading, error } = useSkillProfile();

  const dimensions: HollandDimension[] = profile?.holland_scores
    ? Object.entries(HOLLAND_LABELS).map(([key, { label, description }]) => ({
        key,
        label,
        description,
        score: (profile.holland_scores as Record<string, number>)[key] || 0,
      }))
    : [];

  // Sort by score descending
  dimensions.sort((a, b) => b.score - a.score);

  return {
    dimensions,
    hollandCode: profile?.holland_code || null,
    isLoading,
    error,
  };
}

// Get work values with labels
export function useWorkValues() {
  const { data: profile, isLoading, error } = useSkillProfile();

  const values = profile?.work_values
    ? Object.entries(WORK_VALUE_LABELS).map(([key, { label, description }]) => ({
        key,
        label,
        description,
        score: (profile.work_values as Record<string, number>)[key] || 0,
      }))
    : [];

  // Sort by score descending
  values.sort((a, b) => b.score - a.score);

  return {
    values,
    isLoading,
    error,
  };
}

// Get top technical skills
export function useTopSkills(limit = 10) {
  const { data: profile, isLoading, error } = useSkillProfile();

  const skills = profile?.technical_skills
    ? Object.entries(profile.technical_skills as Record<string, number>)
        .map(([key, score]) => ({
          key,
          label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          score,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
    : [];

  return {
    skills,
    isLoading,
    error,
  };
}

// Get Holland code explanation
export function getHollandCodeExplanation(code: string | null): string[] {
  if (!code) return [];
  
  return code.split('').map(letter => {
    const dimension = Object.entries(HOLLAND_LABELS).find(
      ([key]) => key.charAt(0).toUpperCase() === letter
    );
    return dimension ? `${letter} - ${dimension[1].label}: ${dimension[1].description}` : '';
  }).filter(Boolean);
}
