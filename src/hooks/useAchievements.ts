import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Achievement {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  requirement_type: string;
  requirement_count: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
  notified: boolean;
  achievement?: Achievement;
}

export interface UserXP {
  user_id: string;
  total_xp: number;
  level: number;
  updated_at: string;
}

// Fetch all available achievements
export function useAllAchievements() {
  return useQuery({
    queryKey: ['achievements', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('tier', { ascending: true })
        .order('requirement_count', { ascending: true });

      if (error) throw error;
      return data as Achievement[];
    },
  });
}

// Fetch user's earned achievements
export function useUserAchievements() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['achievements', 'user', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievement:achievements(*)
        `)
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      return data as (UserAchievement & { achievement: Achievement })[];
    },
    enabled: !!user,
  });
}

// Fetch user's XP and level
export function useUserXP() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user_xp', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_xp')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as UserXP | null;
    },
    enabled: !!user,
  });
}

// Fetch unnotified achievements
export function useUnnotifiedAchievements() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['achievements', 'unnotified', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievement:achievements(*)
        `)
        .eq('user_id', user.id)
        .eq('notified', false)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      return data as (UserAchievement & { achievement: Achievement })[];
    },
    enabled: !!user,
    refetchInterval: 30000, // Check every 30 seconds
  });
}

// Mark achievement as notified
export function useMarkNotified() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (achievementId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_achievements')
        .update({ notified: true })
        .eq('user_id', user.id)
        .eq('achievement_id', achievementId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achievements', 'unnotified'] });
      queryClient.invalidateQueries({ queryKey: ['achievements', 'user'] });
    },
  });
}

// Check and grant achievements
export function useCheckAchievements() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('check_achievements', {
        p_user_id: user.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['user_xp'] });
    },
  });
}

// Get achievement progress for display
export function useAchievementProgress() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['achievements', 'progress', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get counts for different requirement types
      const [coursesResult, jobsResult, ratingsResult, suggestionsResult] = await Promise.all([
        supabase.from('courses').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('dream_jobs').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('content_ratings').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('content_suggestions').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'approved'),
      ]);

      return {
        courses_uploaded: coursesResult.count || 0,
        jobs_added: jobsResult.count || 0,
        content_rated: ratingsResult.count || 0,
        suggestions_approved: suggestionsResult.count || 0,
      };
    },
    enabled: !!user,
  });
}

// Combined hook for achievement display with progress
export function useAchievementsWithProgress() {
  const { data: allAchievements, isLoading: loadingAll } = useAllAchievements();
  const { data: userAchievements, isLoading: loadingUser } = useUserAchievements();
  const { data: progress, isLoading: loadingProgress } = useAchievementProgress();
  const { data: userXP, isLoading: loadingXP } = useUserXP();

  const earnedIds = new Set(userAchievements?.map(ua => ua.achievement_id) || []);

  const achievementsWithStatus = allAchievements?.map(achievement => {
    const earned = earnedIds.has(achievement.id);
    const userAchievement = userAchievements?.find(ua => ua.achievement_id === achievement.id);

    // Calculate progress towards this achievement
    let currentProgress = 0;
    if (progress) {
      switch (achievement.requirement_type) {
        case 'courses_uploaded':
          currentProgress = progress.courses_uploaded;
          break;
        case 'jobs_added':
          currentProgress = progress.jobs_added;
          break;
        case 'content_rated':
          currentProgress = progress.content_rated;
          break;
        case 'suggestions_approved':
          currentProgress = progress.suggestions_approved;
          break;
        case 'total_xp':
          currentProgress = userXP?.total_xp || 0;
          break;
        default:
          currentProgress = 0;
      }
    }

    return {
      ...achievement,
      earned,
      earnedAt: userAchievement?.earned_at,
      progress: Math.min(currentProgress, achievement.requirement_count),
      progressPercent: Math.min(100, (currentProgress / achievement.requirement_count) * 100),
    };
  });

  // Group by tier
  const byTier = {
    bronze: achievementsWithStatus?.filter(a => a.tier === 'bronze') || [],
    silver: achievementsWithStatus?.filter(a => a.tier === 'silver') || [],
    gold: achievementsWithStatus?.filter(a => a.tier === 'gold') || [],
    platinum: achievementsWithStatus?.filter(a => a.tier === 'platinum') || [],
  };

  return {
    achievements: achievementsWithStatus || [],
    byTier,
    userXP,
    totalEarned: userAchievements?.length || 0,
    totalAchievements: allAchievements?.length || 0,
    isLoading: loadingAll || loadingUser || loadingProgress || loadingXP,
  };
}

// XP level calculations
export function getXPForLevel(level: number): number {
  // XP needed to reach this level: (level - 1)^2 * 100
  return Math.pow(level - 1, 2) * 100;
}

export function getXPForNextLevel(level: number): number {
  return getXPForLevel(level + 1);
}

export function getLevelProgress(totalXP: number, level: number): number {
  const currentLevelXP = getXPForLevel(level);
  const nextLevelXP = getXPForNextLevel(level);
  const xpIntoLevel = totalXP - currentLevelXP;
  const xpNeededForNext = nextLevelXP - currentLevelXP;
  return Math.min(100, (xpIntoLevel / xpNeededForNext) * 100);
}

// Tier colors and icons
export const tierConfig = {
  bronze: {
    tier: 'bronze' as const,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
    label: 'Bronze',
  },
  silver: {
    tier: 'silver' as const,
    color: 'text-slate-500',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-300',
    label: 'Silver',
  },
  gold: {
    tier: 'gold' as const,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
    label: 'Gold',
  },
  platinum: {
    tier: 'platinum' as const,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    label: 'Platinum',
  },
};
