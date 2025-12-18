import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';

// Types
export interface DashboardOverview {
  totalCourses: number;
  totalDreamJobs: number;
  totalCapabilities: number;
  averageMatchScore: number;
  topGaps: {
    skill: string;
    severity: 'critical' | 'important' | 'minor';
    dreamJob: string;
  }[];
  recentRecommendations: {
    id: string;
    title: string;
    type: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  progressSummary: {
    completedRecommendations: number;
    totalRecommendations: number;
    hoursInvested: number;
  };
}

export interface DashboardStats {
  readinessScore: number;
  readinessTrend: 'up' | 'down' | 'stable';
  skillsGained: number;
  skillsGainedThisMonth: number;
  activeGoals: number;
  goalsCompleted: number;
}

// Fetch dashboard overview from database
async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch all data in parallel
  const [
    { data: courses },
    { data: dreamJobs },
    { data: capabilities },
    { data: recommendations }
  ] = await Promise.all([
    supabase.from('courses').select('id').eq('user_id', user.id),
    supabase.from('dream_jobs').select('id, title, match_score').eq('user_id', user.id),
    supabase.from('capabilities').select('id, name').eq('user_id', user.id),
    supabase.from('recommendations').select('id, title, type, status, priority').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
  ]);

  const jobs = dreamJobs || [];
  const recs = recommendations || [];

  // Calculate average match score
  const matchScores = jobs.map(j => j.match_score || 0).filter(s => s > 0);
  const averageMatchScore = matchScores.length > 0 
    ? Math.round(matchScores.reduce((a, b) => a + b, 0) / matchScores.length)
    : 0;

  // Progress summary
  const completedRecs = recs.filter(r => r.status === 'completed').length;

  return {
    totalCourses: courses?.length || 0,
    totalDreamJobs: jobs.length,
    totalCapabilities: capabilities?.length || 0,
    averageMatchScore,
    topGaps: [], // Would be populated from gap analysis
    recentRecommendations: recs.slice(0, 3).map(r => ({
      id: r.id,
      title: r.title,
      type: r.type || 'skill',
      priority: (r.priority as 'high' | 'medium' | 'low') || 'medium'
    })),
    progressSummary: {
      completedRecommendations: completedRecs,
      totalRecommendations: recs.length,
      hoursInvested: completedRecs * 5 // Estimate 5 hours per completed recommendation
    }
  };
}

// Fetch dashboard stats from database
async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const [
    { data: capabilities },
    { data: dreamJobs },
    { data: recommendations }
  ] = await Promise.all([
    supabase.from('capabilities').select('id, created_at').eq('user_id', user.id),
    supabase.from('dream_jobs').select('match_score').eq('user_id', user.id),
    supabase.from('recommendations').select('status').eq('user_id', user.id)
  ]);

  const caps = capabilities || [];
  const jobs = dreamJobs || [];
  const recs = recommendations || [];

  // Skills gained this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const skillsGainedThisMonth = caps.filter(c => 
    new Date(c.created_at) >= startOfMonth
  ).length;

  // Readiness score (average of match scores or 0)
  const matchScores = jobs.map(j => j.match_score || 0).filter(s => s > 0);
  const readinessScore = matchScores.length > 0
    ? Math.round(matchScores.reduce((a, b) => a + b, 0) / matchScores.length)
    : 0;

  // Goals
  const completedCount = recs.filter(r => r.status === 'completed').length;
  const activeCount = recs.filter(r => r.status === 'in_progress' || r.status === 'pending').length;

  return {
    readinessScore,
    readinessTrend: 'stable',
    skillsGained: caps.length,
    skillsGainedThisMonth,
    activeGoals: activeCount,
    goalsCompleted: completedCount
  };
}

// Hooks
export function useDashboardOverview() {
  return useQuery({
    queryKey: queryKeys.dashboardOverview(),
    queryFn: fetchDashboardOverview,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboardStats(),
    queryFn: fetchDashboardStats,
  });
}
