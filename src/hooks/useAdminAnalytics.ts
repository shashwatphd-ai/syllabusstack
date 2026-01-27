import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformStats {
  totalUsers: number;
  activeUsers: number; // Active in last 30 days
  newUsersThisMonth: number;
  totalCourses: number;
  totalInstructorCourses: number;
  totalEnrollments: number;
  totalCertificates: number;
  totalVerifiedSkills: number;
}

export interface UserGrowthData {
  date: string;
  newUsers: number;
  cumulativeUsers: number;
}

export interface CourseStats {
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
  completedEnrollments: number;
  averageCompletionRate: number;
  topCourses: Array<{
    id: string;
    title: string;
    enrollmentCount: number;
    completionRate: number;
  }>;
}

export interface SkillsStats {
  totalVerifiedSkills: number;
  uniqueSkillsCount: number;
  topSkills: Array<{
    skillName: string;
    count: number;
    category: string;
  }>;
  verificationTrend: Array<{
    date: string;
    count: number;
  }>;
}

export interface CareerStats {
  totalDreamJobs: number;
  totalGapAnalyses: number;
  averageMatchScore: number;
  topCareers: Array<{
    title: string;
    count: number;
  }>;
}

export interface SystemUsage {
  apiCallsToday: number;
  apiCallsThisMonth: number;
  averageResponseTime: number;
  errorRate: number;
  activeEdgeFunctions: number;
}

// Fetch platform-wide statistics
async function fetchPlatformStats(): Promise<PlatformStats> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get user counts
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  // Active users (with recent activity - approximated by updated_at)
  const { count: activeUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', thirtyDaysAgo.toISOString());

  // New users this month
  const { count: newUsersThisMonth } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth.toISOString());

  // Course counts
  const { count: totalCourses } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true });

  const { count: totalInstructorCourses } = await supabase
    .from('instructor_courses')
    .select('*', { count: 'exact', head: true });

  // Enrollment count
  const { count: totalEnrollments } = await supabase
    .from('course_enrollments')
    .select('*', { count: 'exact', head: true });

  // Certificate count
  const { count: totalCertificates } = await supabase
    .from('certificates')
    .select('*', { count: 'exact', head: true });

  // Verified skills count
  const { count: totalVerifiedSkills } = await supabase
    .from('verified_skills')
    .select('*', { count: 'exact', head: true });

  return {
    totalUsers: totalUsers || 0,
    activeUsers: activeUsers || 0,
    newUsersThisMonth: newUsersThisMonth || 0,
    totalCourses: totalCourses || 0,
    totalInstructorCourses: totalInstructorCourses || 0,
    totalEnrollments: totalEnrollments || 0,
    totalCertificates: totalCertificates || 0,
    totalVerifiedSkills: totalVerifiedSkills || 0,
  };
}

// Fetch user growth data for charts
async function fetchUserGrowthData(days = 30): Promise<UserGrowthData[]> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('created_at')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  if (!profiles) return [];

  // Group by date
  const dailyCounts = new Map<string, number>();
  for (const profile of profiles) {
    const date = profile.created_at.split('T')[0];
    dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
  }

  // Get total users before start date for cumulative calculation
  const { count: priorUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', startDate.toISOString());

  let cumulative = priorUsers || 0;
  const result: UserGrowthData[] = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const newUsers = dailyCounts.get(dateStr) || 0;
    cumulative += newUsers;
    result.push({
      date: dateStr,
      newUsers,
      cumulativeUsers: cumulative,
    });
  }

  return result;
}

// Fetch course statistics
async function fetchCourseStats(): Promise<CourseStats> {
  const { count: totalCourses } = await supabase
    .from('instructor_courses')
    .select('*', { count: 'exact', head: true });

  const { count: publishedCourses } = await supabase
    .from('instructor_courses')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true);

  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('instructor_course_id, completed_at');

  const totalEnrollments = enrollments?.length || 0;
  const completedEnrollments = enrollments?.filter(e => e.completed_at).length || 0;

  // Get top courses by enrollment
  const courseEnrollmentCounts = new Map<string, { total: number; completed: number }>();
  for (const e of enrollments || []) {
    const current = courseEnrollmentCounts.get(e.instructor_course_id) || { total: 0, completed: 0 };
    current.total++;
    if (e.completed_at) current.completed++;
    courseEnrollmentCounts.set(e.instructor_course_id, current);
  }

  const topCourseIds = Array.from(courseEnrollmentCounts.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([id]) => id);

  const { data: topCoursesData } = await supabase
    .from('instructor_courses')
    .select('id, title')
    .in('id', topCourseIds.length > 0 ? topCourseIds : ['none']);

  const topCourses = topCourseIds.map(id => {
    const course = topCoursesData?.find(c => c.id === id);
    const stats = courseEnrollmentCounts.get(id)!;
    return {
      id,
      title: course?.title || 'Unknown',
      enrollmentCount: stats.total,
      completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
    };
  });

  return {
    totalCourses: totalCourses || 0,
    publishedCourses: publishedCourses || 0,
    totalEnrollments,
    completedEnrollments,
    averageCompletionRate: totalEnrollments > 0
      ? Math.round((completedEnrollments / totalEnrollments) * 100)
      : 0,
    topCourses,
  };
}

// Fetch skills statistics
async function fetchSkillsStats(): Promise<SkillsStats> {
  const { data: skills, count } = await supabase
    .from('verified_skills')
    .select('skill_name, source_type, verified_at', { count: 'exact' });

  const skillCounts = new Map<string, { count: number; category: string }>();
  for (const skill of skills || []) {
    const key = skill.skill_name.toLowerCase();
    // Use source_type as category proxy since skill_category doesn't exist
    const current = skillCounts.get(key) || { count: 0, category: skill.source_type || 'general' };
    current.count++;
    skillCounts.set(key, current);
  }

  const topSkills = Array.from(skillCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([skillName, data]) => ({
      skillName,
      count: data.count,
      category: data.category,
    }));

  // Verification trend (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dailyCounts = new Map<string, number>();

  for (const skill of skills || []) {
    if (new Date(skill.verified_at) >= thirtyDaysAgo) {
      const date = skill.verified_at.split('T')[0];
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
    }
  }

  const verificationTrend = Array.from(dailyCounts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalVerifiedSkills: count || 0,
    uniqueSkillsCount: skillCounts.size,
    topSkills,
    verificationTrend,
  };
}

// Fetch career/dream job statistics
async function fetchCareerStats(): Promise<CareerStats> {
  const { count: totalDreamJobs } = await supabase
    .from('dream_jobs')
    .select('*', { count: 'exact', head: true });

  const { data: gapAnalyses, count: totalGapAnalyses } = await supabase
    .from('gap_analyses')
    .select('match_score, dream_job_id');

  const averageMatchScore = gapAnalyses && gapAnalyses.length > 0
    ? Math.round(gapAnalyses.reduce((sum, g) => sum + (g.match_score || 0), 0) / gapAnalyses.length)
    : 0;

  // Get top dream job titles
  const { data: dreamJobs } = await supabase
    .from('dream_jobs')
    .select('title');

  const titleCounts = new Map<string, number>();
  for (const job of dreamJobs || []) {
    const title = job.title.toLowerCase();
    titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
  }

  const topCareers = Array.from(titleCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([title, count]) => ({ title, count }));

  return {
    totalDreamJobs: totalDreamJobs || 0,
    totalGapAnalyses: totalGapAnalyses || 0,
    averageMatchScore,
    topCareers,
  };
}

// Hooks

/**
 * Fetch platform-wide statistics
 */
export function usePlatformStats() {
  return useQuery({
    queryKey: ['admin-analytics', 'platform-stats'],
    queryFn: fetchPlatformStats,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch user growth data for charts
 */
export function useUserGrowthData(days = 30) {
  return useQuery({
    queryKey: ['admin-analytics', 'user-growth', days],
    queryFn: () => fetchUserGrowthData(days),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch course statistics
 */
export function useCourseStats() {
  return useQuery({
    queryKey: ['admin-analytics', 'course-stats'],
    queryFn: fetchCourseStats,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch skills statistics
 */
export function useSkillsStats() {
  return useQuery({
    queryKey: ['admin-analytics', 'skills-stats'],
    queryFn: fetchSkillsStats,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch career statistics
 */
export function useCareerStats() {
  return useQuery({
    queryKey: ['admin-analytics', 'career-stats'],
    queryFn: fetchCareerStats,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch all admin analytics at once
 */
export function useAdminAnalytics() {
  const platformStats = usePlatformStats();
  const userGrowth = useUserGrowthData();
  const courseStats = useCourseStats();
  const skillsStats = useSkillsStats();
  const careerStats = useCareerStats();

  return {
    platformStats: platformStats.data,
    userGrowth: userGrowth.data,
    courseStats: courseStats.data,
    skillsStats: skillsStats.data,
    careerStats: careerStats.data,
    isLoading: platformStats.isLoading || userGrowth.isLoading || courseStats.isLoading || skillsStats.isLoading || careerStats.isLoading,
    error: platformStats.error || userGrowth.error || courseStats.error || skillsStats.error || careerStats.error,
  };
}
