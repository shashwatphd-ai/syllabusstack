import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';

interface EmployerDashboardData {
  companyProfile: {
    id: string;
    name: string;
    website: string | null;
    sector: string | null;
    city: string | null;
    contact_email: string | null;
    organization_logo_url: string | null;
  } | null;
  projects: any[];
  applications: any[];
}

async function fetchEmployerDashboard(userId: string): Promise<EmployerDashboardData> {
  const { data: profile, error: profileError } = await supabase
    .from("company_profiles")
    .select("id, name, website, sector, city, contact_email, organization_logo_url")
    .eq("contact_email", userId) // Will need to adjust based on how employers are linked
    .maybeSingle();

  if (profileError || !profile) {
    return { companyProfile: null, projects: [], applications: [] };
  }

  const [projectsRes, appsRes] = await Promise.allSettled([
    supabase
      .from("capstone_projects")
      .select("id, title, status, description, pricing_usd, skills")
      .eq("company_profile_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("capstone_applications")
      .select("id, created_at, status, capstone_project_id, student_id")
      .order("created_at", { ascending: false })
  ]);

  const projects = projectsRes.status === 'fulfilled' && !projectsRes.value.error
    ? projectsRes.value.data || [] : [];
  const applications = appsRes.status === 'fulfilled' && !appsRes.value.error
    ? appsRes.value.data || [] : [];

  return { companyProfile: profile, projects, applications };
}

export function useEmployerDashboard() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['employer-dashboard'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      return fetchEmployerDashboard(user.id);
    },
    staleTime: 2 * 60 * 1000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['employer-dashboard'] });
  }, [queryClient]);

  return { ...query, invalidate };
}
