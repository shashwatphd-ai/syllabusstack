/**
 * Career Pathway Mapper Hook
 * Invokes the career-pathway-mapper edge function for a given project.
 */

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useCareerPathway() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.functions.invoke('career-pathway-mapper', {
        body: { project_id: projectId },
      });
      if (error) throw error;
      return data;
    },
    onError: (error: Error) => {
      toast({
        title: 'Career Pathway Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
