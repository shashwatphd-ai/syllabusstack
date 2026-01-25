import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GenerationTrigger {
  id: string;
  instructor_course_id: string;
  learning_objective_id: string | null;
  teaching_unit_id: string | null;
  trigger_type: string;
  enrollment_count: number;
  enrollment_threshold: number;
  is_triggered: boolean;
  triggered_at: string | null;
  batch_job_id: string | null;
  created_at: string;
}

// Fetch generation triggers for a course
export function useGenerationTriggers(instructorCourseId: string | undefined) {
  return useQuery({
    queryKey: ['generation-triggers', instructorCourseId],
    queryFn: async (): Promise<GenerationTrigger[]> => {
      if (!instructorCourseId) return [];

      const { data, error } = await supabase
        .from('generation_triggers')
        .select('*')
        .eq('instructor_course_id', instructorCourseId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!instructorCourseId,
  });
}

// Get summary stats for generation triggers
export function useGenerationStats(instructorCourseId: string | undefined) {
  const { data: triggers } = useGenerationTriggers(instructorCourseId);
  
  return {
    total: triggers?.length || 0,
    pending: triggers?.filter(t => !t.is_triggered).length || 0,
    triggered: triggers?.filter(t => t.is_triggered && !t.batch_job_id).length || 0,
    completed: triggers?.filter(t => t.batch_job_id).length || 0,
    enrollmentCount: triggers?.[0]?.enrollment_count || 0,
    threshold: triggers?.[0]?.enrollment_threshold || 10,
  };
}

// Initialize triggers for a course
export function useInitializeGenerationTriggers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (instructorCourseId: string) => {
      const { data, error } = await supabase.rpc('initialize_generation_triggers', {
        p_instructor_course_id: instructorCourseId,
      });

      if (error) throw error;
      return data as number;
    },
    onSuccess: (count, instructorCourseId) => {
      queryClient.invalidateQueries({ queryKey: ['generation-triggers', instructorCourseId] });
      if (count > 0) {
        toast({
          title: 'Generation triggers initialized',
          description: `${count} teaching units are now waiting for enrollment threshold.`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to initialize triggers',
        variant: 'destructive',
      });
    },
  });
}

// Manually trigger generation check
export function useCheckGenerationTriggers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (instructorCourseId: string) => {
      const { data, error } = await supabase.functions.invoke('trigger-progressive-generation', {
        body: { instructor_course_id: instructorCourseId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (result, instructorCourseId) => {
      queryClient.invalidateQueries({ queryKey: ['generation-triggers', instructorCourseId] });
      toast({
        title: 'Generation check complete',
        description: `${result.triggers_activated} triggers activated, ${result.generation_jobs_queued} jobs queued.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to check triggers',
        variant: 'destructive',
      });
    },
  });
}
