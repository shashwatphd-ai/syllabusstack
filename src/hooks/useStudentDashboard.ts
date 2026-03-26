import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';

export interface StudentDashboardMetrics {
  totalApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  matchedJobs: number;
  verifiedSkills: number;
  availableProjects: number;
}

export interface RecentCapstoneApplication {
  id: string;
  status: string;
  created_at: string;
  capstone_project_id: string;
}

interface StudentDashboardData {
  metrics: StudentDashboardMetrics;
  recentApplications: RecentCapstoneApplication[];
}

async function fetchStudentDashboard(userId: string): Promise<StudentDashboardData> {
  const results = await Promise.allSettled([
    supabase
      .from("capstone_applications")
      .select("id, status, created_at, capstone_project_id")
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("job_matches")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("verified_skills")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("capstone_projects")
      .select("*", { count: "exact", head: true })
      .in("status", ["approved", "published"])
  ]);

  const applicationsResult = results[0].status === 'fulfilled' ? results[0].value : { data: [] };
  const jobCountResult = results[1].status === 'fulfilled' ? results[1].value : { count: 0 };
  const skillCountResult = results[2].status === 'fulfilled' ? results[2].value : { count: 0 };
  const projectCountResult = results[3].status === 'fulfilled' ? results[3].value : { count: 0 };

  const applications = applicationsResult.data || [];
  const pending = applications.filter((a: any) => a.status === "pending").length;
  const approved = applications.filter((a: any) => a.status === "approved").length;

  return {
    metrics: {
      totalApplications: applications.length,
      pendingApplications: pending,
      approvedApplications: approved,
      matchedJobs: jobCountResult.count ?? 0,
      verifiedSkills: skillCountResult.count ?? 0,
      availableProjects: projectCountResult.count ?? 0,
    },
    recentApplications: applications as RecentCapstoneApplication[],
  };
}

export function useStudentDashboard() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      return fetchStudentDashboard(user.id);
    },
    staleTime: 2 * 60 * 1000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
  }, [queryClient]);

  return { ...query, invalidate };
}
