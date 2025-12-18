import { useQuery } from '@tanstack/react-query';
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

// Mock data
const mockDashboardOverview: DashboardOverview = {
  totalCourses: 4,
  totalDreamJobs: 2,
  totalCapabilities: 12,
  averageMatchScore: 68,
  topGaps: [
    { skill: 'Product Strategy', severity: 'critical', dreamJob: 'Product Manager' },
    { skill: 'Technical Knowledge', severity: 'important', dreamJob: 'Product Manager' },
    { skill: 'Financial Modeling', severity: 'important', dreamJob: 'Business Analyst' },
  ],
  recentRecommendations: [
    { id: '1', title: 'Complete Product Management Course', type: 'course', priority: 'high' },
    { id: '2', title: 'Build a Side Project', type: 'project', priority: 'medium' },
    { id: '3', title: 'Get Google Analytics Certified', type: 'certification', priority: 'medium' },
  ],
  progressSummary: {
    completedRecommendations: 3,
    totalRecommendations: 12,
    hoursInvested: 24,
  },
};

const mockDashboardStats: DashboardStats = {
  readinessScore: 68,
  readinessTrend: 'up',
  skillsGained: 12,
  skillsGainedThisMonth: 2,
  activeGoals: 5,
  goalsCompleted: 3,
};

// API functions
const fetchDashboardOverview = async (): Promise<DashboardOverview> => {
  await new Promise(resolve => setTimeout(resolve, 600));
  return mockDashboardOverview;
};

const fetchDashboardStats = async (): Promise<DashboardStats> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  return mockDashboardStats;
};

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
