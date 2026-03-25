/**
 * Project Metadata Hook
 * Fetches extended project data (value analysis, skill gaps, discovery quality, etc.)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query-keys';

export interface ProjectMetadata {
  id: string;
  project_id: string;
  ai_model_version: string | null;
  market_alignment_score: number | null;
  estimated_roi: any | null;
  pricing_breakdown: any | null;
  lo_alignment_detail: any | null;
  lo_mapping_tasks: any | null;
  lo_mapping_deliverables: any | null;
  market_signals_used: any | null;
  value_analysis: any | null;
  stakeholder_insights: any | null;
  partnership_quality_score: number | null;
  synergistic_value_index: number | null;
  skill_gap_analysis: any | null;
  salary_projections: any | null;
  discovery_quality: any | null;
  algorithm_transparency: any | null;
  verification_checks: any | null;
  enhanced_market_intel: any | null;
  created_at: string;
  updated_at: string;
}

export function useProjectMetadata(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.capstone.metadata(projectId || ''),
    queryFn: async () => {
      if (!projectId) return null;

      const { data, error } = await (supabase as any)
        .from('project_metadata')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (error) throw error;
      return data as ProjectMetadata | null;
    },
    enabled: !!projectId,
  });
}

export function useGenerateValueAnalysis() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-value-analysis', {
        body: { project_id: projectId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capstone.metadata(projectId) });
      toast({ title: 'Analysis Generated', description: 'Value analysis has been generated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Generation Failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useGeneratePremiumInsights() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-premium-insights', {
        body: { project_id: projectId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capstone.metadata(projectId) });
      toast({ title: 'Insights Generated', description: 'Premium insights have been generated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Generation Failed', description: error.message, variant: 'destructive' });
    },
  });
}
