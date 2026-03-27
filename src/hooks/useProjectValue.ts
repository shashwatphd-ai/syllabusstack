/**
 * Project Value Analyzer Hook
 * Invokes the analyze-project-value edge function for a given project.
 */

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useProjectValue() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.functions.invoke('analyze-project-value', {
        body: { project_id: projectId },
      });
      if (error) throw error;
      return data;
    },
    onError: (error: Error) => {
      toast({
        title: 'Project Value Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
