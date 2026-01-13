import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TeachingUnit {
  id: string;
  learning_objective_id: string;
  sequence_order: number;
  title: string;
  description: string | null;
  what_to_teach: string;
  why_this_matters: string | null;
  how_to_teach: string | null;
  common_misconceptions: string[] | null;
  prerequisites: string[] | null;
  enables: string[] | null;
  target_video_type: 'explainer' | 'tutorial' | 'case_study' | 'worked_example' | 'lecture' | 'demonstration';
  target_duration_minutes: number;
  search_queries: string[];
  required_concepts: string[] | null;
  avoid_terms: string[] | null;
  status: 'pending' | 'searching' | 'found' | 'approved' | 'failed';
  videos_found_count: number;
  created_at: string;
  updated_at: string;
}

export function useTeachingUnits(learningObjectiveId?: string) {
  return useQuery({
    queryKey: ['teaching-units', learningObjectiveId],
    queryFn: async () => {
      if (!learningObjectiveId) return [];
      
      const { data, error } = await supabase
        .from('teaching_units')
        .select('*')
        .eq('learning_objective_id', learningObjectiveId)
        .order('sequence_order');
      
      if (error) throw error;
      return data as TeachingUnit[];
    },
    enabled: !!learningObjectiveId,
  });
}

export function useDecomposeLearningObjective() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (learningObjectiveId: string) => {
      const { data, error } = await supabase.functions.invoke('curriculum-reasoning-agent', {
        body: { learning_objective_id: learningObjectiveId }
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Decomposition failed');
      
      return data;
    },
    onSuccess: (data, learningObjectiveId) => {
      queryClient.invalidateQueries({ queryKey: ['teaching-units', learningObjectiveId] });
      queryClient.invalidateQueries({ queryKey: ['learning-objectives'] });
      toast({
        title: 'Learning Objective Analyzed',
        description: `Created ${data.teaching_units?.length || 0} teaching units`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Analysis Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateTeachingUnitStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      unitId, 
      status, 
      videosFoundCount 
    }: { 
      unitId: string; 
      status: TeachingUnit['status']; 
      videosFoundCount?: number;
    }) => {
      const updateData: Partial<TeachingUnit> = { status };
      if (videosFoundCount !== undefined) {
        updateData.videos_found_count = videosFoundCount;
      }
      
      const { data, error } = await supabase
        .from('teaching_units')
        .update(updateData)
        .eq('id', unitId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['teaching-units', data.learning_objective_id] 
      });
    },
  });
}

export function useSearchForTeachingUnit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (teachingUnitId: string) => {
      // First get the teaching unit to get its LO id
      const { data: unit, error: unitError } = await supabase
        .from('teaching_units')
        .select('*, learning_objective:learning_objective_id(*)')
        .eq('id', teachingUnitId)
        .single();
      
      if (unitError || !unit) throw new Error('Teaching unit not found');
      
      // Update status to searching
      await supabase
        .from('teaching_units')
        .update({ status: 'searching' })
        .eq('id', teachingUnitId);
      
      // Call search with teaching unit context
      const { data, error } = await supabase.functions.invoke('search-youtube-content', {
        body: { 
          learning_objective_id: unit.learning_objective_id,
          teaching_unit_id: teachingUnitId 
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, teachingUnitId) => {
      queryClient.invalidateQueries({ queryKey: ['teaching-units'] });
      queryClient.invalidateQueries({ queryKey: ['content-matches'] });
      toast({
        title: 'Search Complete',
        description: `Found ${data?.videos_found || 0} videos for this concept`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Search Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
