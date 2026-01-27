import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVerifiedSkills, VerifiedSkill, PROFICIENCY_CONFIG } from './useVerifiedSkills';

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
    staleTime: 30000, // 30 seconds - prevent serving stale data
    gcTime: 300000, // 5 minutes garbage collection
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('skill_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      // Explicit null check - no profile means assessment not completed
      if (!data) return null;
      return data as SkillProfile;
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

/**
 * Unified skill from combined sources
 */
export interface UnifiedSkill {
  name: string;
  proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  proficiencyScore: number; // 0-100 for sorting
  source: 'verified' | 'assessed' | 'self_reported';
  sourceDetails: string;
  verified: boolean;
  verifiedAt?: string;
  assessmentScore?: number;
  category?: string;
}

/**
 * Combined skill profile with verified and assessed skills
 */
export interface UnifiedSkillProfile {
  // From skills assessment
  hollandCode: string | null;
  hollandScores: Record<string, number>;
  workValues: Record<string, number>;
  assessedSkills: UnifiedSkill[];

  // From verified_skills table
  verifiedSkills: UnifiedSkill[];

  // Combined view
  allSkills: UnifiedSkill[];
  totalSkillCount: number;
  verifiedSkillCount: number;

  // Status
  hasCompletedAssessment: boolean;
  hasVerifiedSkills: boolean;
}

/**
 * Get unified skill profile combining assessed and verified skills
 * This provides a complete view of the user's skill portfolio
 */
export function useUnifiedSkillProfile() {
  const { data: assessmentProfile, isLoading: assessmentLoading, error: assessmentError } = useSkillProfile();
  const { data: verifiedSkillsData, isLoading: verifiedLoading, error: verifiedError } = useVerifiedSkills();

  const isLoading = assessmentLoading || verifiedLoading;
  const error = assessmentError || verifiedError;

  // Convert assessment technical skills to unified format
  const assessedSkills: UnifiedSkill[] = [];
  if (assessmentProfile?.technical_skills) {
    const skills = assessmentProfile.technical_skills as Record<string, number>;
    for (const [skillKey, score] of Object.entries(skills)) {
      // Convert score (0-5 or percentage) to proficiency level
      const normalizedScore = score > 5 ? score : score * 20; // Normalize to 0-100
      const proficiency = scoreToProficiency(normalizedScore);

      assessedSkills.push({
        name: formatSkillKey(skillKey),
        proficiencyLevel: proficiency,
        proficiencyScore: normalizedScore,
        source: 'assessed',
        sourceDetails: 'Skills Assessment',
        verified: false,
        assessmentScore: normalizedScore,
        category: 'Technical Skills',
      });
    }
  }

  // Convert verified skills to unified format
  const verifiedSkills: UnifiedSkill[] = (verifiedSkillsData || []).map((vs: VerifiedSkill) => ({
    name: vs.skill_name,
    proficiencyLevel: vs.proficiency_level,
    proficiencyScore: proficiencyToScore(vs.proficiency_level),
    source: 'verified' as const,
    sourceDetails: vs.source_name || 'Course Assessment',
    verified: true,
    verifiedAt: vs.verified_at,
    assessmentScore: vs.metadata?.score,
    category: vs.metadata?.skill_category || 'Course Skills',
  }));

  // Merge skills, prioritizing verified over assessed
  const skillMap = new Map<string, UnifiedSkill>();

  // Add assessed skills first
  for (const skill of assessedSkills) {
    const key = skill.name.toLowerCase();
    skillMap.set(key, skill);
  }

  // Override with verified skills (they take precedence)
  for (const skill of verifiedSkills) {
    const key = skill.name.toLowerCase();
    const existing = skillMap.get(key);

    if (!existing) {
      // New skill, add it
      skillMap.set(key, skill);
    } else if (skill.verified && !existing.verified) {
      // Verified skill overrides non-verified
      skillMap.set(key, {
        ...skill,
        // Keep the higher proficiency score
        proficiencyScore: Math.max(skill.proficiencyScore, existing.proficiencyScore),
        proficiencyLevel: existing.proficiencyScore > skill.proficiencyScore
          ? existing.proficiencyLevel
          : skill.proficiencyLevel,
      });
    } else if (skill.proficiencyScore > existing.proficiencyScore) {
      // Higher proficiency overrides
      skillMap.set(key, skill);
    }
  }

  // Sort all skills by: verified first, then proficiency score descending
  const allSkills = Array.from(skillMap.values()).sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    return b.proficiencyScore - a.proficiencyScore;
  });

  const profile: UnifiedSkillProfile = {
    hollandCode: assessmentProfile?.holland_code || null,
    hollandScores: assessmentProfile?.holland_scores || {},
    workValues: assessmentProfile?.work_values || {},
    assessedSkills,
    verifiedSkills,
    allSkills,
    totalSkillCount: allSkills.length,
    verifiedSkillCount: verifiedSkills.length,
    hasCompletedAssessment: !!assessmentProfile?.completed_at,
    hasVerifiedSkills: verifiedSkills.length > 0,
  };

  return {
    profile,
    isLoading,
    error,
  };
}

/**
 * Get skills summary for display
 */
export function useSkillsSummary() {
  const { profile, isLoading, error } = useUnifiedSkillProfile();

  const summary = {
    total: profile.totalSkillCount,
    verified: profile.verifiedSkillCount,
    assessed: profile.assessedSkills.length,
    topSkills: profile.allSkills.slice(0, 5),
    recentlyVerified: profile.verifiedSkills
      .sort((a, b) => {
        const dateA = a.verifiedAt ? new Date(a.verifiedAt).getTime() : 0;
        const dateB = b.verifiedAt ? new Date(b.verifiedAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 3),
    byProficiency: {
      expert: profile.allSkills.filter(s => s.proficiencyLevel === 'expert').length,
      advanced: profile.allSkills.filter(s => s.proficiencyLevel === 'advanced').length,
      intermediate: profile.allSkills.filter(s => s.proficiencyLevel === 'intermediate').length,
      beginner: profile.allSkills.filter(s => s.proficiencyLevel === 'beginner').length,
    },
    hasData: profile.hasCompletedAssessment || profile.hasVerifiedSkills,
  };

  return {
    summary,
    isLoading,
    error,
  };
}

/**
 * Check if a specific skill is verified
 */
export function useIsSkillVerified(skillName: string) {
  const { profile, isLoading } = useUnifiedSkillProfile();

  const skill = profile.allSkills.find(
    s => s.name.toLowerCase() === skillName.toLowerCase()
  );

  return {
    isVerified: skill?.verified || false,
    skill,
    isLoading,
  };
}

// Helper functions

function scoreToProficiency(score: number): UnifiedSkill['proficiencyLevel'] {
  if (score >= 80) return 'expert';
  if (score >= 60) return 'advanced';
  if (score >= 40) return 'intermediate';
  return 'beginner';
}

function proficiencyToScore(level: UnifiedSkill['proficiencyLevel']): number {
  const scores = {
    beginner: 25,
    intermediate: 50,
    advanced: 75,
    expert: 95,
  };
  return scores[level] || 50;
}

function formatSkillKey(key: string): string {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
