/**
 * Student Project Recommendations Hook
 * Queries the student-project-matcher edge function for personalized recommendations.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useStudentProjectRecommendations() {
  return useQuery({
    queryKey: ['student-project-recommendations'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('student-project-matcher');
      if (error) throw error;
      return data?.recommendations || [];
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}
