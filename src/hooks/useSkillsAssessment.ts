import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState, useCallback } from 'react';

// Types
export interface AssessmentQuestion {
  id: string;
  question_text: string;
  question_type: 'likert_5' | 'likert_7' | 'slider_100' | 'forced_choice';
  framework: 'holland_riasec' | 'onet_skills' | 'work_values';
  measures_dimension: string;
  response_options: Record<string, unknown> | null;
  sequence_order: number | null;
}

export interface SkillsAssessmentSession {
  id: string;
  user_id: string;
  session_type: 'standard' | 'quick';
  status: 'in_progress' | 'completed' | 'abandoned' | 'expired';
  total_questions: number;
  questions_answered: number;
  current_section?: string;
  started_at: string;
  completed_at?: string;
  expires_at: string;
}

export interface SubmitResponseResult {
  success: boolean;
  progress: {
    answered: number;
    total: number;
    percentage: number;
  };
  next_batch?: AssessmentQuestion[];
  is_complete: boolean;
  current_section?: string;
}

export interface SkillProfile {
  id: string;
  user_id: string;
  holland_code: string | null;
  holland_scores: Record<string, number>;
  technical_skills: Record<string, number>;
  work_values: Record<string, number>;
  assessment_version: string;
  completed_at: string | null;
}

export interface StartAssessmentResult {
  success: boolean;
  session_id: string;
  session_type: 'standard' | 'quick';
  total_questions: number;
  questions_answered: number;
  first_batch: AssessmentQuestion[];
  is_resumed: boolean;
}

// Hook: Start or resume a skills assessment session
export function useStartSkillsAssessment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ sessionType = 'standard' }: { sessionType?: 'standard' | 'quick' }) => {
      const { data, error } = await supabase.functions.invoke('start-skills-assessment', {
        body: { session_type: sessionType },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as StartAssessmentResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['skills-assessment-session'] });
      
      if (data.is_resumed) {
        toast({
          title: 'Assessment Resumed',
          description: `Continuing from question ${data.questions_answered + 1} of ${data.total_questions}`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Failed to start assessment',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}

// Hook: Submit a single response
export function useSubmitSkillsResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      questionId,
      responseValue,
      responseTimeMs,
    }: {
      sessionId: string;
      questionId: string;
      responseValue: number;
      responseTimeMs?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('submit-skills-response', {
        body: {
          session_id: sessionId,
          question_id: questionId,
          response_value: responseValue,
          response_time_ms: responseTimeMs,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as SubmitResponseResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills-assessment-session'] });
    },
  });
}

// Hook: Complete assessment and compute skill profile
export function useCompleteSkillsAssessment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      const { data, error } = await supabase.functions.invoke('complete-skills-assessment', {
        body: { session_id: sessionId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as {
        success: boolean;
        skill_profile: SkillProfile;
        session_id: string;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['skills-assessment-session'] });
      queryClient.invalidateQueries({ queryKey: ['skill-profile'] });
      
      toast({
        title: 'Assessment Complete! 🎉',
        description: `Your Holland Code is ${data.skill_profile.holland_code}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to complete assessment',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}

// Hook: Get active assessment session
export function useActiveSkillsSession() {
  return useQuery({
    queryKey: ['skills-assessment-session', 'active'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('skills_assessment_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as SkillsAssessmentSession | null;
    },
  });
}

// Composite hook for managing assessment state
export function useSkillsAssessmentWizard() {
  const [currentQuestions, setCurrentQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ answered: 0, total: 0, percentage: 0 });
  const [isComplete, setIsComplete] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());

  const startAssessment = useStartSkillsAssessment();
  const submitResponse = useSubmitSkillsResponse();
  const completeAssessment = useCompleteSkillsAssessment();

  const start = useCallback(async (sessionType: 'standard' | 'quick' = 'standard') => {
    const result = await startAssessment.mutateAsync({ sessionType });
    setSessionId(result.session_id);
    setCurrentQuestions(result.first_batch);
    setCurrentQuestionIndex(0);
    setProgress({
      answered: result.questions_answered,
      total: result.total_questions,
      percentage: Math.round((result.questions_answered / result.total_questions) * 100),
    });
    setQuestionStartTime(Date.now());
    return result;
  }, [startAssessment]);

  const submitAnswer = useCallback(async (responseValue: number) => {
    if (!sessionId || !currentQuestions[currentQuestionIndex]) return;

    const responseTimeMs = Date.now() - questionStartTime;
    const question = currentQuestions[currentQuestionIndex];

    const result = await submitResponse.mutateAsync({
      sessionId,
      questionId: question.id,
      responseValue,
      responseTimeMs,
    });

    setProgress({
      answered: result.progress.answered,
      total: result.progress.total,
      percentage: result.progress.percentage,
    });

    if (result.is_complete) {
      setIsComplete(true);
    } else if (result.next_batch && result.next_batch.length > 0) {
      // Got new batch - reset to first question of new batch
      setCurrentQuestions(result.next_batch);
      setCurrentQuestionIndex(0);
    } else {
      // Move to next question in current batch
      setCurrentQuestionIndex(prev => prev + 1);
    }

    setQuestionStartTime(Date.now());
    return result;
  }, [sessionId, currentQuestions, currentQuestionIndex, questionStartTime, submitResponse]);

  const complete = useCallback(async () => {
    if (!sessionId) return;
    return await completeAssessment.mutateAsync({ sessionId });
  }, [sessionId, completeAssessment]);

  const currentQuestion = currentQuestions[currentQuestionIndex] || null;
  const isLoading = startAssessment.isPending || submitResponse.isPending || completeAssessment.isPending;

  return {
    // State
    sessionId,
    currentQuestion,
    currentQuestionIndex,
    questionsInBatch: currentQuestions.length,
    progress,
    isComplete,
    isLoading,
    
    // Actions
    start,
    submitAnswer,
    complete,
    
    // Mutation states
    isStarting: startAssessment.isPending,
    isSubmitting: submitResponse.isPending,
    isCompleting: completeAssessment.isPending,
  };
}
