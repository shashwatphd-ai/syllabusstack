import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useProjectFeedback(projectId?: string) {
  return useQuery({
    queryKey: ['project-feedback', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('project_feedback')
        .select('*')
        .eq('capstone_project_id', projectId)
        .eq('instructor_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useSubmitProjectFeedback() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (params: {
      capstone_project_id: string;
      rating: number;
      feedback_text?: string;
      tags?: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('project_feedback').upsert({
        ...params,
        instructor_id: user.id,
      }, { onConflict: 'capstone_project_id,instructor_id' });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['project-feedback', vars.capstone_project_id] });
      toast({ title: 'Feedback Saved' });
    },
    onError: (e: Error) => {
      toast({ title: 'Feedback Failed', description: e.message, variant: 'destructive' });
    },
  });
}
