import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AssessmentSession {
  id: string;
  user_id: string;
  learning_objective_id: string;
  question_ids: string[];
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
  completed_at: string | null;
  timeout_at: string | null;
  current_question_index: number;
  questions_answered: number;
  questions_correct: number;
  total_score: number | null;
  passed: boolean | null;
  attempt_number: number;
}

export interface AssessmentQuestion {
  id: string;
  learning_objective_id: string;
  question_text: string;
  question_type: string;
  options: unknown;
  correct_answer: string | null;
  accepted_answers: string[] | null;
  required_keywords: string[] | null;
  difficulty: string | null;
  bloom_level: string | null;
  time_limit_seconds: number | null;
  scenario_context: string | null;
}

export interface AssessmentAnswer {
  id: string;
  session_id: string;
  question_id: string;
  user_answer: string | null;
  is_correct: boolean | null;
  time_taken_seconds: number | null;
  question_served_at: string | null;
  answer_submitted_at: string | null;
  evaluation_details?: Record<string, unknown>;
}

export interface SessionProgress {
  questions_answered: number;
  questions_correct: number;
  total_questions: number;
  current_score: number;
  is_complete: boolean;
}

export interface PerformanceSummary {
  total_questions: number;
  questions_answered: number;
  questions_correct: number;
  questions_incorrect: number;
  questions_skipped: number;
  total_score: number;
  passed: boolean;
  passing_threshold: number;
  total_time_seconds: number;
  avg_time_per_question: number;
  timing_anomalies: number;
  attempt_number: number;
}

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

// Start a new assessment session via edge function
export function useStartAssessment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      learningObjectiveId, 
      numQuestions = 5,
    }: { 
      learningObjectiveId: string; 
      numQuestions?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('start-assessment', {
        body: {
          learning_objective_id: learningObjectiveId,
          num_questions: numQuestions,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data as {
        success: boolean;
        session: AssessmentSession;
        questions: AssessmentQuestion[];
        is_resumed: boolean;
        timeout_minutes?: number;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['active-session', data.session.learning_objective_id] });
      
      if (data.is_resumed) {
        toast({
          title: 'Assessment Resumed',
          description: 'Continuing your previous session',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start assessment',
        variant: 'destructive',
      });
    },
  });
}

// Submit an answer via edge function with server-side validation
export function useSubmitAssessmentAnswer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      questionId,
      userAnswer,
      questionServedAt,
    }: {
      sessionId: string;
      questionId: string;
      userAnswer: string;
      questionServedAt: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('submit-assessment-answer', {
        body: {
          session_id: sessionId,
          question_id: questionId,
          user_answer: userAnswer,
          client_question_served_at: questionServedAt,
          client_answer_submitted_at: new Date().toISOString(),
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data as {
        success: boolean;
        is_correct: boolean;
        evaluation_method: string;
        time_taken_seconds: number;
        timing_flags: string[];
        correct_answer: string | null;
        answer_id: string;
        session_progress: SessionProgress;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-session'] });
    },
  });
}

// Complete assessment via edge function
export function useCompleteAssessment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      const { data, error } = await supabase.functions.invoke('complete-assessment', {
        body: { session_id: sessionId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data as {
        success: boolean;
        session: AssessmentSession;
        performance: PerformanceSummary;
        correct_answers: string[];
        incorrect_answers: Array<{
          question_id: string;
          user_answer: string;
          evaluation_details: Record<string, unknown>;
        }>;
        learning_objective_verified: boolean;
        already_completed?: boolean;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['active-session'] });
      queryClient.invalidateQueries({ queryKey: ['session-history'] });
      queryClient.invalidateQueries({ queryKey: ['learning-objectives'] });
      
      if (data.already_completed) {
        return;
      }

      if (data.performance.passed) {
        toast({
          title: 'Assessment Passed! 🎉',
          description: `You scored ${Math.round(data.performance.total_score)}%`,
        });
      } else {
        toast({
          title: 'Assessment Complete',
          description: `You scored ${Math.round(data.performance.total_score)}%. Keep practicing!`,
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to complete assessment',
        variant: 'destructive',
      });
    },
  });
}

// Legacy hooks for backward compatibility
export function useStartSession() {
  return useStartAssessment();
}

export function useSubmitAnswer() {
  return useSubmitAssessmentAnswer();
}

export function useCompleteSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const completeAssessment = useCompleteAssessment();

  return useMutation({
    mutationFn: async ({
      sessionId,
      passed,
    }: {
      sessionId: string;
      passed: boolean;
    }) => {
      const result = await completeAssessment.mutateAsync({ sessionId });
      return result.session;
    },
  });
}

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

// Fetch micro-checks for content
export function useMicroChecks(contentId?: string) {
  return useQuery({
    queryKey: ['micro-checks', contentId],
    queryFn: async () => {
      if (!contentId) return [];

      const { data, error } = await supabase
        .from('micro_checks')
        .select('*')
        .eq('content_id', contentId)
        .order('trigger_time_seconds', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!contentId,
  });
}

// Generate assessment questions for a learning objective using AI
export function useGenerateAssessmentQuestions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      learningObjectiveId,
      learningObjectiveText,
      contentContext,
    }: {
      learningObjectiveId?: string;
      learningObjectiveText?: string;
      contentContext?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-assessment-questions', {
        body: {
          learning_objective_id: learningObjectiveId,
          learning_objective_text: learningObjectiveText,
          content_context: contentContext,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      if (variables.learningObjectiveId) {
        queryClient.invalidateQueries({ 
          queryKey: ['assessment-questions', variables.learningObjectiveId] 
        });
      }
      toast({
        title: 'Questions Generated',
        description: `Created ${data.count} assessment questions`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate questions',
        variant: 'destructive',
      });
    },
  });
}