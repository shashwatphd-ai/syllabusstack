/**
 * Salary ROI Calculator Hook
 * Invokes the salary-roi-calculator edge function for a given project.
 */

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useSalaryROI() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.functions.invoke('salary-roi-calculator', {
        body: { project_id: projectId },
      });
      if (error) throw error;
      return data;
    },
    onError: (error: Error) => {
      toast({
        title: 'Salary ROI Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
