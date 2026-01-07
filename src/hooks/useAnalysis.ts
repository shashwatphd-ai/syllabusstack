import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { performGapAnalysis, generateRecommendations, GapAnalysisResponse, SkillGap, SkillOverlap } from '@/services';

// Re-export types from services
export type { GapAnalysisResponse, SkillGap, SkillOverlap };

export interface CapabilityProfile {
  totalCapabilities: number;
  categories: { name: string; count: number; percentage: number }[];
  topSkills: { name: string; level: string; category: string }[];
  recentlyAdded: { name: string; addedAt: string }[];
  trend: 'improving' | 'stable' | 'declining';
}

// Fetch capability profile from database
async function fetchCapabilityProfile(): Promise<CapabilityProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: capabilities, error } = await supabase
    .from('capabilities')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const caps = capabilities || [];
  
  // Calculate category breakdown
  const categoryMap: Record<string, number> = {};
  caps.forEach(cap => {
    const cat = cap.category || 'other';
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  });

  const categories = Object.entries(categoryMap).map(([name, count]) => ({
    name,
    count,
    percentage: caps.length > 0 ? Math.round((count / caps.length) * 100) : 0
  })).sort((a, b) => b.count - a.count);

  // Top skills (by proficiency)
  const proficiencyOrder = ['expert', 'advanced', 'intermediate', 'beginner'];
  const topSkills = [...caps]
    .sort((a, b) => {
      const aIdx = proficiencyOrder.indexOf(a.proficiency_level || 'beginner');
      const bIdx = proficiencyOrder.indexOf(b.proficiency_level || 'beginner');
      return aIdx - bIdx;
    })
    .slice(0, 5)
    .map(cap => ({
      name: cap.name,
      level: cap.proficiency_level || 'beginner',
      category: cap.category || 'other'
    }));

  // Recently added
  const recentlyAdded = caps.slice(0, 5).map(cap => ({
    name: cap.name,
    addedAt: cap.created_at
  }));

  return {
    totalCapabilities: caps.length,
    categories,
    topSkills,
    recentlyAdded,
    trend: caps.length > 5 ? 'improving' : 'stable'
  };
}

// Hooks
export function useGapAnalysis(dreamJobId: string) {
  return useQuery({
    queryKey: queryKeys.gapAnalysis(dreamJobId),
    queryFn: () => performGapAnalysis(dreamJobId),
    enabled: !!dreamJobId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCapabilityProfile() {
  return useQuery({
    queryKey: queryKeys.capabilityProfile(),
    queryFn: fetchCapabilityProfile,
  });
}

export function useGenerateRecommendations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dreamJobId, gaps }: { dreamJobId: string; gaps: SkillGap[] }) =>
      generateRecommendations(dreamJobId, gaps),
    onSuccess: (_, { dreamJobId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendationsList(dreamJobId) });
    },
  });
}
