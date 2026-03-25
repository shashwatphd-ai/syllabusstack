/**
 * Project Metadata Hook
 * Fetches extended project data (value analysis, skill gaps, discovery quality, etc.)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query-keys';

// ── Typed JSONB field interfaces ──

export interface StakeholderValue {
  score: number;
  key_benefits?: string[];
  insights?: string;
  [key: string]: unknown;
}

export interface ValueAnalysis {
  students?: StakeholderValue;
  university?: StakeholderValue;
  industry?: StakeholderValue;
  synergistic_value?: { index: number; key_synergies?: string[]; [key: string]: unknown };
  problem_validation?: { validated_challenges?: string[]; alignment_score?: number; [key: string]: unknown };
  generated_at?: string;
}

export interface StakeholderInsights {
  faculty_recommendations?: string[];
  risk_factors?: string[];
  opportunity_highlights?: string[];
  overall_assessment?: string;
}

export interface SkillGap {
  skill: string;
  current_level: number;
  target_level: number;
  gap: number;
  in_project?: boolean;
  in_company_stack?: boolean;
  demand_level?: string;
  posting_count?: number;
}

export interface SalaryProjection {
  skill?: string;
  role?: string;
  title?: string;
  salary_range?: string;
  median_salary?: number;
  growth_rate?: number;
  growth?: number;
  demand_level?: string;
  posting_count?: number;
}

export interface LOAlignmentDetail {
  objective?: string;
  coverage?: number;
  score?: number;
  tasks?: string[];
}

export interface VerificationCheck {
  label: string;
  status: 'pass' | 'warning' | 'fail';
  value: string;
  detail: string;
}

export interface PricingBreakdown {
  [key: string]: number | string;
}

export interface EstimatedROI {
  [key: string]: number | string;
}

// ── Main interface ──

export interface ProjectMetadata {
  id: string;
  project_id: string;
  ai_model_version: string | null;
  market_alignment_score: number | null;
  estimated_roi: EstimatedROI | null;
  pricing_breakdown: PricingBreakdown | null;
  lo_alignment_detail: LOAlignmentDetail[] | null;
  lo_mapping_tasks: Record<string, string[]> | null;
  lo_mapping_deliverables: Record<string, string[]> | null;
  market_signals_used: string[] | Record<string, unknown> | null;
  value_analysis: ValueAnalysis | null;
  stakeholder_insights: StakeholderInsights | string[] | null;
  partnership_quality_score: number | null;
  synergistic_value_index: number | null;
  skill_gap_analysis: SkillGap[] | Record<string, unknown> | null;
  salary_projections: SalaryProjection[] | Record<string, unknown> | null;
  discovery_quality: Record<string, unknown> | null;
  algorithm_transparency: Record<string, unknown> | null;
  verification_checks: VerificationCheck[] | null;
  enhanced_market_intel: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ── Query Hooks ──

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
