/**
 * Admin Regenerate Projects Hook
 * Invokes the admin-regenerate-projects edge function and invalidates related caches.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useAdminRegenerate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (instructorCourseId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-regenerate-projects', {
        body: { instructor_course_id: instructorCourseId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, instructorCourseId) => {
      queryClient.invalidateQueries({ queryKey: ['capstone-projects', instructorCourseId] });
      queryClient.invalidateQueries({ queryKey: ['capstone-companies', instructorCourseId] });
      toast({
        title: 'Projects Regenerated',
        description: `Successfully regenerated capstone projects.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Regeneration Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
