/**
 * Capstone Projects Hooks
 * Handles company discovery, project generation, assignment, and completion.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query-keys';

// ── Types ──

export interface CompanyProfile {
  id: string;
  name: string;
  sector: string | null;
  size: string | null;
  description: string | null;
  website: string | null;
  contact_email: string | null;
  contact_person: string | null;
  contact_title: string | null;
  full_address: string | null;
  linkedin_profile: string | null;
  apollo_organization_id: string | null;
  technologies_used: string[] | null;
  job_postings: any[] | null;
  funding_stage: string | null;
  employee_count: string | null;
  revenue_range: string | null;
  industries: string[] | null;
  keywords: string[] | null;
  data_completeness_score: number | null;
  created_at: string;
}

export interface CapstoneProject {
  id: string;
  instructor_course_id: string;
  company_profile_id: string | null;
  title: string;
  description: string | null;
  tasks: any;
  deliverables: any;
  skills: string[] | null;
  tier: string | null;
  lo_alignment: string | null;
  lo_alignment_score: number | null;
  feasibility_score: number | null;
  final_score: number | null;
  contact: any;
  equipment: string | null;
  majors: string[] | null;
  status: string;
  assigned_student_id: string | null;
  generation_batch_id: string | null;
  created_at: string;
  updated_at: string;
  company_profiles?: CompanyProfile | null;
}

export interface ProjectForm {
  id: string;
  capstone_project_id: string;
  form1_project_details: any;
  form2_contact_info: any;
  form3_requirements: any;
  form4_timeline: any;
  form5_logistics: any;
  form6_academic: any;
  milestones: any;
}

// ── Query Hooks ──

export function useCompanyProfiles(courseId: string) {
  return useQuery({
    queryKey: queryKeys.capstone.companies(courseId),
    queryFn: async () => {
      // Get company IDs linked to this course via capstone_projects
      const { data: projects } = await supabase
        .from('capstone_projects')
        .select('company_profile_id')
        .eq('instructor_course_id', courseId)
        .not('company_profile_id', 'is', null);

      const companyIds = [...new Set((projects || []).map(p => p.company_profile_id).filter(Boolean))];
      if (companyIds.length === 0) {
        // Also check if there are any companies discovered but not yet linked
        const { data: allCompanies, error } = await supabase
          .from('company_profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        return (allCompanies || []) as CompanyProfile[];
      }

      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .in('id', companyIds)
        .order('data_completeness_score', { ascending: false });

      if (error) throw error;
      return (data || []) as CompanyProfile[];
    },
    enabled: !!courseId,
  });
}

export function useCapstoneProjects(courseId: string) {
  return useQuery({
    queryKey: queryKeys.capstone.projects(courseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('capstone_projects')
        .select('*, company_profiles(*)')
        .eq('instructor_course_id', courseId)
        .order('final_score', { ascending: false });

      if (error) throw error;
      return (data || []) as CapstoneProject[];
    },
    enabled: !!courseId,
  });
}

export function useCapstoneProject(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.capstone.projectDetail(projectId || ''),
    queryFn: async () => {
      if (!projectId) return null;

      const { data: project, error: pError } = await supabase
        .from('capstone_projects')
        .select('*, company_profiles(*)')
        .eq('id', projectId)
        .single();

      if (pError) throw pError;

      const { data: form } = await supabase
        .from('project_forms')
        .select('*')
        .eq('capstone_project_id', projectId)
        .maybeSingle();

      return { ...project, form } as CapstoneProject & { form: ProjectForm | null };
    },
    enabled: !!projectId,
  });
}

export function useStudentCapstoneProject(courseId: string) {
  return useQuery({
    queryKey: queryKeys.capstone.studentProject(courseId),
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('capstone_projects')
        .select('*, company_profiles(*)')
        .eq('instructor_course_id', courseId)
        .eq('assigned_student_id', user.id);

      if (error) throw error;
      return (data || []) as CapstoneProject[];
    },
    enabled: !!courseId,
  });
}

// ── Mutation Hooks ──

export function useDiscoverCompanies() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (courseId: string) => {
      const { data, error } = await supabase.functions.invoke('discover-companies', {
        body: { instructor_course_id: courseId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, courseId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capstone.companies(courseId) });
      toast({
        title: 'Companies Discovered',
        description: `Found ${data?.companies_saved || 0} companies matching your course.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Discovery Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useGenerateCapstoneProjects() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (courseId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-capstone-projects', {
        body: { instructor_course_id: courseId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, courseId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capstone.projects(courseId) });
      toast({
        title: 'Projects Generated',
        description: `Created ${data?.projects_created || 0} capstone project proposals.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useAssignStudent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ projectId, studentId, courseId }: { projectId: string; studentId: string; courseId: string }) => {
      const { error } = await supabase
        .from('capstone_projects')
        .update({ assigned_student_id: studentId, status: 'active' })
        .eq('id', projectId);
      if (error) throw error;
      return { courseId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capstone.projects(data.courseId) });
      toast({ title: 'Student Assigned', description: 'Student has been assigned to the project.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Assignment Failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCompleteProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ projectId, courseId }: { projectId: string; courseId: string }) => {
      // Update status
      const { error: updateError } = await supabase
        .from('capstone_projects')
        .update({ status: 'completed' })
        .eq('id', projectId);
      if (updateError) throw updateError;

      // Extract competencies
      const { data, error } = await supabase.functions.invoke('extract-capstone-competencies', {
        body: { capstone_project_id: projectId },
      });
      if (error) throw error;
      return { ...data, courseId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capstone.projects(data.courseId) });
      toast({
        title: 'Project Completed',
        description: `Extracted ${data?.skills_extracted || 0} verified skills.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Completion Failed', description: error.message, variant: 'destructive' });
    },
  });
}
