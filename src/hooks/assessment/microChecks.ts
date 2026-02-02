/**
 * Micro-Checks Hooks
 *
 * Contains hooks for generating, fetching, and validating micro-checks.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { MicroCheck, MicroCheckResult, ValidateMicroCheckResponse } from './types';

// Generate micro-checks for content
export function useGenerateMicroChecks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      contentId,
      learningObjectiveId,
      contentTitle,
      contentDescription,
      durationSeconds,
      learningObjectiveText,
      numChecks = 3,
    }: {
      contentId: string;
      learningObjectiveId: string;
      contentTitle: string;
      contentDescription?: string;
      durationSeconds: number;
      learningObjectiveText: string;
      numChecks?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-micro-checks', {
        body: {
          content_id: contentId,
          learning_objective_id: learningObjectiveId,
          content_title: contentTitle,
          content_description: contentDescription,
          duration_seconds: durationSeconds,
          learning_objective_text: learningObjectiveText,
          num_checks: numChecks,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['micro-checks', variables.contentId] });
      toast({
        title: 'Micro-Checks Generated',
        description: `Created ${data.count} verification questions`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate micro-checks',
        variant: 'destructive',
      });
    },
  });
}

// Fetch micro-checks for content (uses secure view that hides answers)
export function useMicroChecks(contentId?: string) {
  return useQuery({
    queryKey: ['micro-checks', contentId],
    queryFn: async () => {
      if (!contentId) return [];

      // Use the student-safe view that excludes correct_answer and is_correct from options
      const { data, error } = await supabase
        .from('micro_checks_student')
        .select('*')
        .eq('content_id', contentId)
        .order('trigger_time_seconds', { ascending: true });

      if (error) throw error;
      return data as MicroCheck[];
    },
    enabled: !!contentId,
  });
}

// Server-side validation of micro-check answers
export async function validateMicroCheckAnswer(
  microCheckId: string,
  userAnswer?: string,
  selectedOptionIndex?: number
): Promise<ValidateMicroCheckResponse> {
  const { data, error } = await supabase.rpc('validate_micro_check_answer', {
    p_micro_check_id: microCheckId,
    p_user_answer: userAnswer || null,
    p_selected_option_index: selectedOptionIndex ?? null,
  });

  if (error) throw error;
  return data as ValidateMicroCheckResponse;
}

// Fetch micro-check results for a consumption record
export function useMicroCheckResults(consumptionRecordId?: string) {
  return useQuery({
    queryKey: ['micro-check-results', consumptionRecordId],
    queryFn: async () => {
      if (!consumptionRecordId) return [];

      const { data, error } = await supabase
        .from('micro_check_results')
        .select(`
          *,
          micro_check:micro_checks(
            question_text,
            correct_answer,
            trigger_time_seconds
          )
        `)
        .eq('consumption_record_id', consumptionRecordId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as MicroCheckResult[];
    },
    enabled: !!consumptionRecordId,
  });
}
