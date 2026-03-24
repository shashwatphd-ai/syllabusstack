import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useStudentApplications() {
  return useQuery({
    queryKey: ['capstone-applications', 'student'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('capstone_applications')
        .select('*, capstone_projects(*, company_profiles(name, sector))')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useBrowseProjects() {
  return useQuery({
    queryKey: ['capstone-browse-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('capstone_projects')
        .select('*, company_profiles(name, sector, city, state, organization_logo_url)')
        .in('status', ['active', 'draft'])
        .is('assigned_student_id', null)
        .order('final_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useApplyToProject() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ projectId, coverLetter }: { projectId: string; coverLetter?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('capstone_applications').insert({
        capstone_project_id: projectId,
        student_id: user.id,
        cover_letter: coverLetter,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capstone-applications'] });
      qc.invalidateQueries({ queryKey: ['capstone-browse-projects'] });
      toast({ title: 'Application Submitted', description: 'Your application has been sent.' });
    },
    onError: (e: Error) => {
      toast({ title: 'Application Failed', description: e.message, variant: 'destructive' });
    },
  });
}

export function useProjectApplications(projectId?: string) {
  return useQuery({
    queryKey: ['capstone-applications', 'project', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('capstone_applications')
        .select('*')
        .eq('capstone_project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });
}

export function useUpdateApplicationStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ applicationId, status }: { applicationId: string; status: string }) => {
      const { error } = await supabase
        .from('capstone_applications')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', applicationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capstone-applications'] });
      toast({ title: 'Status Updated' });
    },
  });
}
