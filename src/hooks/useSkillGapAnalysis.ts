/**
 * Skill Gap Analyzer Hook
 * Invokes the skill-gap-analyzer edge function for a given project.
 */

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useSkillGapAnalysis() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.functions.invoke('skill-gap-analyzer', {
        body: { project_id: projectId },
      });
      if (error) throw error;
      return data;
    },
    onError: (error: Error) => {
      toast({
        title: 'Skill Gap Analysis Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
