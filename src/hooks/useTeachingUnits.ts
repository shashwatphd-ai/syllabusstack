import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query-keys';

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
    queryKey: queryKeys.teachingUnits.list(learningObjectiveId),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.teachingUnits.list(learningObjectiveId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.learningObjectives.all });
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
        queryKey: queryKeys.teachingUnits.list(data.learning_objective_id) 
      });
    },
  });
}

/**
 * Hook for searching content for a specific teaching unit.
 * Returns per-unit loading state so only the clicked button shows spinner.
 */
export function useSearchForTeachingUnit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchingUnitId, setSearchingUnitId] = useState<string | null>(null);
  
  const searchForUnit = useCallback(async (teachingUnitId: string) => {
    if (searchingUnitId) {
      toast({
        title: 'Search in progress',
        description: 'Please wait for the current search to complete.',
        variant: 'destructive',
      });
      return;
    }
    
    setSearchingUnitId(teachingUnitId);
    
    try {
      // Get teaching unit with LO data
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
      
      // Invalidate to show searching status immediately
      queryClient.invalidateQueries({ queryKey: queryKeys.teachingUnits.all });
      
      const lo = unit.learning_objective as any;
      
      // Call search with timeout protection
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      
      const { data, error } = await supabase.functions.invoke('search-youtube-content', {
        body: { 
          learning_objective_id: unit.learning_objective_id,
          teaching_unit_id: teachingUnitId,
          lo_text: lo?.text,
          core_concept: lo?.core_concept,
          bloom_level: lo?.bloom_level,
          domain: lo?.domain,
          search_keywords: lo?.search_keywords,
          expected_duration_minutes: lo?.expected_duration_minutes,
          instructor_course_id: lo?.instructor_course_id,
          use_ai_evaluation: true,
          force_sync: true,
          enrich_metadata: true, // Enable metadata enrichment to get proper titles
        }
      });
      
      clearTimeout(timeoutId);
      
      if (error) {
        throw error;
      }
      
      // Update status based on actually saved matches (not total_found which is pre-filter count)
      const videosFound = data?.content_matches?.length || 0;
      await supabase
        .from('teaching_units')
        .update({ 
          status: videosFound > 0 ? 'found' : 'pending',
          videos_found_count: videosFound
        })
        .eq('id', teachingUnitId);
      
      queryClient.invalidateQueries({ queryKey: queryKeys.teachingUnits.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.contentMatches.all });
      
      toast({
        title: 'Search Complete',
        description: videosFound > 0 
          ? `Found ${videosFound} videos for this concept`
          : 'No matching videos found. Try searching manually.',
      });
      
      return data;
    } catch (err) {
      // Reset status on error
      await supabase
        .from('teaching_units')
        .update({ status: 'pending' })
        .eq('id', teachingUnitId);
      
      queryClient.invalidateQueries({ queryKey: queryKeys.teachingUnits.all });
      
      const message = err instanceof Error 
        ? (err.name === 'AbortError' ? 'Search timed out. Please try again.' : err.message)
        : 'Search failed';
      
      toast({
        title: 'Search Failed',
        description: message,
        variant: 'destructive',
      });
      
      throw err;
    } finally {
      setSearchingUnitId(null);
    }
  }, [searchingUnitId, queryClient, toast]);

  return {
    mutate: searchForUnit,
    searchingUnitId,
    isSearching: (unitId: string) => searchingUnitId === unitId,
    isPending: searchingUnitId !== null,
  };
}
