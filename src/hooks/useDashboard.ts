import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';

// Types
export interface DashboardOverview {
  totalCourses: number;
  totalDreamJobs: number;
  totalCapabilities: number;
  averageMatchScore: number;
  hasGapAnalysis: boolean;
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
    inProgressRecommendations: number;
    pendingRecommendations: number;
    skippedRecommendations: number;
    totalRecommendations: number;
    hoursInvested: number;
  };
  topRecommendation?: string;
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
    { data: recommendations },
    { data: gapAnalyses }
  ] = await Promise.all([
    supabase.from('courses').select('id').eq('user_id', user.id),
    supabase.from('dream_jobs').select('id, title, match_score').eq('user_id', user.id),
    supabase.from('capabilities').select('id, name').eq('user_id', user.id),
    supabase.from('recommendations').select('id, title, type, status, priority').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('gap_analyses').select('id, dream_job_id, critical_gaps, priority_gaps').eq('user_id', user.id)
  ]);

  const jobs = dreamJobs || [];
  const recs = recommendations || [];
  const gaps = gapAnalyses || [];

  // Calculate average match score
  const matchScores = jobs.map(j => j.match_score || 0).filter(s => s > 0);
  const averageMatchScore = matchScores.length > 0 
    ? Math.round(matchScores.reduce((a, b) => a + b, 0) / matchScores.length)
    : 0;

  // Progress summary by status - single pass with reduce (was 4 separate filter calls)
  const recCounts = recs.reduce((acc, r) => {
    if (r.status === 'completed') acc.completed++;
    else if (r.status === 'in_progress') acc.inProgress++;
    else if (r.status === 'skipped') acc.skipped++;
    else acc.pending++; // 'pending' or no status
    return acc;
  }, { completed: 0, inProgress: 0, pending: 0, skipped: 0 });

  // Find top recommendation (first high priority pending item)
  const topRec = recs.find(r => 
    (r.status === 'pending' || !r.status) && r.priority === 'high'
  ) || recs.find(r => r.status === 'pending' || !r.status);

  // Build job lookup Map for O(1) access (was O(n) find per gap)
  const jobsById = new Map(jobs.map(j => [j.id, j]));

  // Calculate actual gaps from gap_analyses
  interface GapItem { job_requirement?: string; gap?: string }
  const topGaps: DashboardOverview['topGaps'] = [];
  for (const ga of gaps) {
    const job = jobsById.get(ga.dream_job_id); // O(1) lookup instead of O(n) find
    const criticalGaps = (ga.critical_gaps as GapItem[] | null) || [];
    const priorityGaps = (ga.priority_gaps as GapItem[] | null) || [];
    
    // Add critical gaps
    for (const g of criticalGaps.slice(0, 3)) {
      topGaps.push({
        skill: g.job_requirement || 'Unknown skill',
        severity: 'critical',
        dreamJob: job?.title || 'Dream Job'
      });
    }
    // Add priority gaps
    for (const g of priorityGaps.slice(0, 2)) {
      topGaps.push({
        skill: g.gap || 'Unknown skill',
        severity: 'important',
        dreamJob: job?.title || 'Dream Job'
      });
    }
  }

  return {
    totalCourses: courses?.length || 0,
    totalDreamJobs: jobs.length,
    totalCapabilities: capabilities?.length || 0,
    averageMatchScore,
    hasGapAnalysis: gaps.length > 0,
    topGaps: topGaps.slice(0, 5), // Top 5 gaps across all dream jobs
    recentRecommendations: recs.slice(0, 3).map(r => ({
      id: r.id,
      title: r.title,
      type: r.type || 'skill',
      priority: (r.priority as 'high' | 'medium' | 'low') || 'medium'
    })),
    progressSummary: {
      completedRecommendations: recCounts.completed,
      inProgressRecommendations: recCounts.inProgress,
      pendingRecommendations: recCounts.pending,
      skippedRecommendations: recCounts.skipped,
      totalRecommendations: recs.length,
      hoursInvested: recCounts.completed * 5 // Estimate 5 hours per completed recommendation
    },
    topRecommendation: topRec?.title
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
    queryKey: queryKeys.dashboard.overview,
    queryFn: fetchDashboardOverview,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats,
    queryFn: fetchDashboardStats,
  });
}
