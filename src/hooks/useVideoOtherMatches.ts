import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OtherMatch {
  learningObjectiveId: string;
  learningObjectiveText: string;
  moduleTitle: string | null;
}

export function useVideoOtherMatches(contentId: string | undefined, currentLearningObjectiveId: string) {
  return useQuery({
    queryKey: ['video-other-matches', contentId, currentLearningObjectiveId],
    queryFn: async (): Promise<OtherMatch[]> => {
      if (!contentId) return [];
      
      // Get all matches for this content that aren't the current LO
      const { data: matches, error } = await supabase
        .from('content_matches')
        .select(`
          learning_objective_id,
          learning_objectives!inner(
            id,
            text,
            module_id
          )
        `)
        .eq('content_id', contentId)
        .neq('learning_objective_id', currentLearningObjectiveId)
        .in('status', ['approved', 'auto_approved']);
      
      if (error || !matches) return [];
      
      // Get module info for each match
      const moduleIds = matches
        .map(m => (m.learning_objectives as any)?.module_id)
        .filter(Boolean);
      
      let moduleMap: Record<string, string> = {};
      if (moduleIds.length > 0) {
        const { data: modules } = await supabase
          .from('modules')
          .select('id, title')
          .in('id', moduleIds);
        
        if (modules) {
          moduleMap = Object.fromEntries(modules.map(m => [m.id, m.title]));
        }
      }
      
      return matches.map(m => ({
        learningObjectiveId: (m.learning_objectives as any)?.id,
        learningObjectiveText: (m.learning_objectives as any)?.text || 'Unknown',
        moduleTitle: moduleMap[(m.learning_objectives as any)?.module_id] || null,
      }));
    },
    enabled: !!contentId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
