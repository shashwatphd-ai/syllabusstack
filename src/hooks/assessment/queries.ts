/**
 * Assessment Query Hooks
 *
 * Contains hooks for fetching assessment questions, sessions, and history.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AssessmentQuestion, AssessmentSession } from './types';

// Fetch assessment questions for a learning objective
export function useAssessmentQuestions(learningObjectiveId?: string) {
  return useQuery({
    queryKey: ['assessment-questions', learningObjectiveId],
    queryFn: async () => {
      if (!learningObjectiveId) return [];

      const { data, error } = await supabase
        .from('assessment_questions')
        .select('*')
        .eq('learning_objective_id', learningObjectiveId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as AssessmentQuestion[];
    },
    enabled: !!learningObjectiveId,
  });
}

// Fetch active assessment session
export function useActiveSession(learningObjectiveId?: string) {
  return useQuery({
    queryKey: ['active-session', learningObjectiveId],
    queryFn: async () => {
      if (!learningObjectiveId) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('assessment_sessions')
        .select('*')
        .eq('learning_objective_id', learningObjectiveId)
        .eq('user_id', user.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as AssessmentSession | null;
    },
    enabled: !!learningObjectiveId,
  });
}

// Fetch session history for a learning objective
export function useSessionHistory(learningObjectiveId?: string) {
  return useQuery({
    queryKey: ['session-history', learningObjectiveId],
    queryFn: async () => {
      if (!learningObjectiveId) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('assessment_sessions')
        .select('*')
        .eq('learning_objective_id', learningObjectiveId)
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data as AssessmentSession[];
    },
    enabled: !!learningObjectiveId,
  });
}
