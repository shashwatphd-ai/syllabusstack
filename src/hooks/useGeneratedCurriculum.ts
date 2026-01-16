import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CurriculumSubject {
  title: string;
  description: string;
  estimated_hours: number;
  skills_covered: string[];
  modules: {
    title: string;
    description: string;
    estimated_hours: number;
    learning_objectives: {
      text: string;
      bloom_level: string;
      estimated_minutes: number;
    }[];
  }[];
}

export interface GeneratedCurriculum {
  id: string;
  user_id: string;
  career_match_id: string | null;
  target_occupation: string;
  curriculum_structure: {
    subjects: CurriculumSubject[];
    estimated_total_weeks: number;
    curriculum_summary: string;
  };
  estimated_weeks: number | null;
  total_subjects: number | null;
  total_modules: number | null;
  total_learning_objectives: number | null;
  status: string | null;
  progress_percentage: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerateCurriculumParams {
  career_match_id?: string;
  dream_job_id?: string;
  customizations?: {
    hours_per_week?: number;
    learning_style?: 'visual' | 'reading' | 'hands_on';
    priority_skills?: string[];
    exclude_topics?: string[];
  };
}

// Hook: Generate a new curriculum
export function useGenerateCurriculum() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: GenerateCurriculumParams) => {
      const { data, error } = await supabase.functions.invoke('generate-curriculum', {
        body: params,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as {
        success: boolean;
        curriculum_id: string;
        title: string;
        summary: string;
        estimated_weeks: number;
        subjects: Array<{
          title: string;
          description: string;
          estimated_hours: number;
          modules_count: number;
          skills_covered: string[];
        }>;
        total_modules: number;
        total_learning_objectives: number;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['generated-curricula'] });
      toast({
        title: 'Curriculum Generated!',
        description: `Created ${data.subjects.length} subjects with ${data.total_learning_objectives} learning objectives`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate curriculum',
        variant: 'destructive',
      });
    },
  });
}

// Hook: Get user's generated curricula
export function useGeneratedCurricula() {
  return useQuery({
    queryKey: ['generated-curricula'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('generated_curricula')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(c => ({
        ...c,
        curriculum_structure: c.curriculum_structure as unknown as GeneratedCurriculum['curriculum_structure'],
      })) as GeneratedCurriculum[];
    },
  });
}

// Hook: Get single curriculum by ID
export function useGeneratedCurriculumById(curriculumId?: string) {
  return useQuery({
    queryKey: ['generated-curriculum', curriculumId],
    queryFn: async () => {
      if (!curriculumId) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('generated_curricula')
        .select('*')
        .eq('id', curriculumId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      return {
        ...data,
        curriculum_structure: data.curriculum_structure as unknown as GeneratedCurriculum['curriculum_structure'],
      } as GeneratedCurriculum;
    },
    enabled: !!curriculumId,
  });
}

// Hook: Update curriculum progress
export function useUpdateCurriculumProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      curriculumId,
      progress,
    }: {
      curriculumId: string;
      progress: number;
    }) => {
      const updates: Record<string, unknown> = {
        progress_percentage: progress,
        updated_at: new Date().toISOString(),
      };

      if (progress === 100) {
        updates.status = 'completed';
        updates.completed_at = new Date().toISOString();
      } else if (progress > 0) {
        updates.status = 'in_progress';
        if (!updates.started_at) {
          updates.started_at = new Date().toISOString();
        }
      }

      const { data, error } = await supabase
        .from('generated_curricula')
        .update(updates)
        .eq('id', curriculumId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generated-curricula'] });
    },
  });
}

// Hook: Delete curriculum
export function useDeleteCurriculum() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (curriculumId: string) => {
      const { error } = await supabase
        .from('generated_curricula')
        .delete()
        .eq('id', curriculumId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generated-curricula'] });
      toast({
        title: 'Curriculum Deleted',
        description: 'The curriculum has been removed',
      });
    },
    onError: (error) => {
      toast({
        title: 'Deletion Failed',
        description: error instanceof Error ? error.message : 'Failed to delete curriculum',
        variant: 'destructive',
      });
    },
  });
}
