import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Verified skill from database
 */
export interface VerifiedSkill {
  id: string;
  user_id: string;
  skill_name: string;
  proficiency_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  source_type: 'course_assessment' | 'micro_check' | 'project' | 'certification' | 'manual';
  source_id: string | null;
  source_name: string | null;
  verified_at: string;
  evidence_url: string | null;
  metadata: {
    learning_objective_id?: string;
    assessment_session_id?: string;
    score?: number;
    skill_category?: string;
    extraction_confidence?: number;
    bloom_level?: string;
  } | null;
  created_at: string;
  updated_at: string;
}

/**
 * Grouped skills by category
 */
export interface SkillsByCategory {
  category: string;
  skills: VerifiedSkill[];
  count: number;
}

/**
 * Skill statistics
 */
export interface SkillStats {
  total: number;
  byProficiency: Record<string, number>;
  bySourceType: Record<string, number>;
  byCategory: Record<string, number>;
  recentlyVerified: VerifiedSkill[];
  topSkills: VerifiedSkill[];
}

/**
 * Proficiency level display configuration
 */
export const PROFICIENCY_CONFIG = {
  beginner: {
    label: 'Beginner',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    badgeColor: 'bg-blue-500',
    description: 'Foundational understanding',
    order: 1,
  },
  intermediate: {
    label: 'Intermediate',
    color: 'bg-green-100 text-green-800 border-green-200',
    badgeColor: 'bg-green-500',
    description: 'Working proficiency',
    order: 2,
  },
  advanced: {
    label: 'Advanced',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    badgeColor: 'bg-purple-500',
    description: 'Deep expertise',
    order: 3,
  },
  expert: {
    label: 'Expert',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    badgeColor: 'bg-amber-500',
    description: 'Mastery level',
    order: 4,
  },
} as const;

/**
 * Source type display configuration
 */
export const SOURCE_TYPE_CONFIG = {
  course_assessment: {
    label: 'Course Assessment',
    icon: 'GraduationCap',
    description: 'Verified through course assessment',
  },
  micro_check: {
    label: 'Micro-Check',
    icon: 'CheckCircle',
    description: 'Verified through comprehension checks',
  },
  project: {
    label: 'Project',
    icon: 'FolderCode',
    description: 'Verified through project completion',
  },
  certification: {
    label: 'Certification',
    icon: 'Award',
    description: 'Verified through certification exam',
  },
  manual: {
    label: 'Manual Entry',
    icon: 'PenLine',
    description: 'Manually added skill',
  },
} as const;

/**
 * Fetch all verified skills for the current user
 */
export function useVerifiedSkills() {
  return useQuery({
    queryKey: ['verified-skills'],
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('verified_skills')
        .select('*')
        .eq('user_id', user.id)
        .order('verified_at', { ascending: false });

      if (error) throw error;
      return (data || []) as VerifiedSkill[];
    },
  });
}

/**
 * Get verified skills grouped by category
 */
export function useVerifiedSkillsByCategory() {
  const { data: skills, isLoading, error } = useVerifiedSkills();

  const groupedSkills: SkillsByCategory[] = [];

  if (skills) {
    const categoryMap = new Map<string, VerifiedSkill[]>();

    for (const skill of skills) {
      const category = skill.metadata?.skill_category || 'General Skills';
      const existing = categoryMap.get(category) || [];
      existing.push(skill);
      categoryMap.set(category, existing);
    }

    for (const [category, categorySkills] of categoryMap) {
      groupedSkills.push({
        category,
        skills: categorySkills,
        count: categorySkills.length,
      });
    }

    // Sort categories by skill count descending
    groupedSkills.sort((a, b) => b.count - a.count);
  }

  return {
    groupedSkills,
    isLoading,
    error,
  };
}

/**
 * Get skill statistics for the current user
 */
export function useSkillStats() {
  const { data: skills, isLoading, error } = useVerifiedSkills();

  const stats: SkillStats = {
    total: 0,
    byProficiency: {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
      expert: 0,
    },
    bySourceType: {
      course_assessment: 0,
      micro_check: 0,
      project: 0,
      certification: 0,
      manual: 0,
    },
    byCategory: {},
    recentlyVerified: [],
    topSkills: [],
  };

  if (skills) {
    stats.total = skills.length;

    for (const skill of skills) {
      // Count by proficiency
      if (skill.proficiency_level in stats.byProficiency) {
        stats.byProficiency[skill.proficiency_level]++;
      }

      // Count by source type
      if (skill.source_type in stats.bySourceType) {
        stats.bySourceType[skill.source_type]++;
      }

      // Count by category
      const category = skill.metadata?.skill_category || 'General Skills';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    }

    // Recently verified (last 5)
    stats.recentlyVerified = skills.slice(0, 5);

    // Top skills (highest proficiency, then most recent)
    stats.topSkills = [...skills]
      .sort((a, b) => {
        const profA = PROFICIENCY_CONFIG[a.proficiency_level]?.order || 0;
        const profB = PROFICIENCY_CONFIG[b.proficiency_level]?.order || 0;
        if (profB !== profA) return profB - profA;
        return new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime();
      })
      .slice(0, 10);
  }

  return {
    stats,
    isLoading,
    error,
  };
}

/**
 * Check if user has a specific skill verified
 */
export function useHasVerifiedSkill(skillName: string) {
  const { data: skills, isLoading } = useVerifiedSkills();

  const hasSkill = skills?.some(
    s => s.skill_name.toLowerCase() === skillName.toLowerCase()
  ) || false;

  const skill = skills?.find(
    s => s.skill_name.toLowerCase() === skillName.toLowerCase()
  );

  return {
    hasSkill,
    skill,
    isLoading,
  };
}

/**
 * Get skills by proficiency level
 */
export function useSkillsByProficiency(level: VerifiedSkill['proficiency_level']) {
  const { data: skills, isLoading, error } = useVerifiedSkills();

  const filteredSkills = skills?.filter(s => s.proficiency_level === level) || [];

  return {
    skills: filteredSkills,
    count: filteredSkills.length,
    isLoading,
    error,
  };
}

/**
 * Search verified skills by name
 */
export function useSearchVerifiedSkills(searchTerm: string) {
  const { data: skills, isLoading, error } = useVerifiedSkills();

  const filteredSkills = skills?.filter(s =>
    s.skill_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return {
    skills: filteredSkills,
    count: filteredSkills.length,
    isLoading,
    error,
  };
}

/**
 * Manually add a verified skill (for manual/certification entries)
 */
export function useAddVerifiedSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      skillName,
      proficiencyLevel,
      sourceType,
      sourceName,
      evidenceUrl,
      metadata,
    }: {
      skillName: string;
      proficiencyLevel: VerifiedSkill['proficiency_level'];
      sourceType: VerifiedSkill['source_type'];
      sourceName?: string;
      evidenceUrl?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('verified_skills')
        .insert([{
          user_id: user.id,
          skill_name: skillName,
          proficiency_level: proficiencyLevel,
          source_type: sourceType,
          source_name: sourceName || null,
          evidence_url: evidenceUrl || null,
          metadata: (metadata || {}) as unknown as import('@/integrations/supabase/types').Json,
        }])
        .select()
        .single();

      if (error) throw error;
      return data as VerifiedSkill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verified-skills'] });
      queryClient.invalidateQueries({ queryKey: ['skill-profile'] });
    },
  });
}

/**
 * Delete a verified skill
 */
export function useDeleteVerifiedSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (skillId: string) => {
      const { error } = await supabase
        .from('verified_skills')
        .delete()
        .eq('id', skillId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verified-skills'] });
      queryClient.invalidateQueries({ queryKey: ['skill-profile'] });
    },
  });
}

/**
 * Get a formatted proficiency badge configuration
 */
export function getProficiencyBadge(level: VerifiedSkill['proficiency_level']) {
  return PROFICIENCY_CONFIG[level] || PROFICIENCY_CONFIG.intermediate;
}

/**
 * Get source type display info
 */
export function getSourceTypeInfo(sourceType: VerifiedSkill['source_type']) {
  return SOURCE_TYPE_CONFIG[sourceType] || SOURCE_TYPE_CONFIG.manual;
}

/**
 * Format skill for display with proficiency indicator
 */
export function formatSkillDisplay(skill: VerifiedSkill): string {
  const proficiency = PROFICIENCY_CONFIG[skill.proficiency_level];
  return `${skill.skill_name} (${proficiency?.label || 'Unknown'})`;
}

/**
 * Calculate overall skill level based on all verified skills
 */
export function calculateOverallSkillLevel(skills: VerifiedSkill[]): {
  level: string;
  score: number;
  description: string;
} {
  if (skills.length === 0) {
    return { level: 'Getting Started', score: 0, description: 'Start learning to build your skill portfolio' };
  }

  // Calculate weighted score based on proficiency levels
  const weights = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
  const totalScore = skills.reduce((sum, skill) => {
    return sum + (weights[skill.proficiency_level] || 1);
  }, 0);

  const avgScore = totalScore / skills.length;

  if (avgScore >= 3.5) {
    return { level: 'Expert', score: avgScore, description: 'Highly skilled professional' };
  } else if (avgScore >= 2.5) {
    return { level: 'Advanced', score: avgScore, description: 'Strong skill portfolio' };
  } else if (avgScore >= 1.5) {
    return { level: 'Intermediate', score: avgScore, description: 'Growing competency' };
  } else {
    return { level: 'Beginner', score: avgScore, description: 'Building foundations' };
  }
}
