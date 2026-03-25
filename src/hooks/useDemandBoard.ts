/**
 * Demand Board Hooks
 * Public marketplace: employers browse demand signals and express interest.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DemandSignal {
  id: string;
  created_at: string;
  skill_name: string;
  demand_level: string | null;
  source: string | null;
  region: string | null;
  industry: string | null;
  job_title: string | null;
  salary_range: string | null;
  growth_rate: number | null;
  posting_count: number | null;
  metadata: any | null;
}

export function useDemandSignals(filters?: { industry?: string; region?: string; search?: string }) {
  return useQuery({
    queryKey: ['demand-board', filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('demand_signals')
        .select('*')
        .order('posting_count', { ascending: false, nullsFirst: false });

      if (filters?.industry) {
        query = query.ilike('industry', `%${filters.industry}%`);
      }
      if (filters?.region) {
        query = query.ilike('region', `%${filters.region}%`);
      }
      if (filters?.search) {
        query = query.or(`skill_name.ilike.%${filters.search}%,job_title.ilike.%${filters.search}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return (data || []) as DemandSignal[];
    },
  });
}

export interface ExpressInterestInput {
  demandSignalId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  projectDescription?: string;
  preferredTimeline?: string;
}

export function useExpressInterest() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: ExpressInterestInput) => {
      const { error } = await (supabase as any)
        .from('employer_interest_submissions')
        .insert({
          demand_signal_id: input.demandSignalId,
          company_name: input.companyName,
          contact_name: input.contactName,
          contact_email: input.contactEmail,
          project_description: input.projectDescription || null,
          preferred_timeline: input.preferredTimeline || null,
          status: 'pending',
          referral_source: 'demand_board',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employer-interest'] });
      toast({ title: 'Interest Submitted', description: 'We\'ll match you with relevant capstone projects.' });
    },
    onError: (e: Error) => {
      toast({ title: 'Submission Failed', description: e.message, variant: 'destructive' });
    },
  });
}

export function useEmployerMatchedProjects(companyDomain?: string) {
  return useQuery({
    queryKey: ['employer-matched-projects', companyDomain],
    queryFn: async () => {
      if (!companyDomain) return [];
      const { data, error } = await supabase
        .from('capstone_projects')
        .select('*, company_profiles!inner(name, sector, website, city, state)')
        .ilike('company_profiles.website', `%${companyDomain}%`)
        .order('final_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyDomain,
  });
}

export function useProjectApplicants(projectIds: string[]) {
  return useQuery({
    queryKey: ['employer-project-applicants', projectIds],
    queryFn: async () => {
      if (!projectIds.length) return [];
      const { data, error } = await (supabase as any)
        .from('capstone_applications')
        .select('*, profiles(full_name, email, avatar_url)')
        .in('capstone_project_id', projectIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: projectIds.length > 0,
  });
}
