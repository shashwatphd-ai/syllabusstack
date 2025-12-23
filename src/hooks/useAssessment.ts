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

// Start a new assessment session
export function useStartSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      learningObjectiveId, 
      questionIds 
    }: { 
      learningObjectiveId: string; 
      questionIds: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get attempt number
      const { count } = await supabase
        .from('assessment_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('learning_objective_id', learningObjectiveId)
        .eq('user_id', user.id);

      const { data, error } = await supabase
        .from('assessment_sessions')
        .insert({
          user_id: user.id,
          learning_objective_id: learningObjectiveId,
          question_ids: questionIds,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          current_question_index: 0,
          questions_answered: 0,
          questions_correct: 0,
          attempt_number: (count || 0) + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data as AssessmentSession;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['active-session', data.learning_objective_id] });
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

// Submit an answer
export function useSubmitAnswer() {
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
      const { data, error } = await supabase.functions.invoke('evaluate-answer', {
        body: {
          session_id: sessionId,
          question_id: questionId,
          user_answer: userAnswer,
          question_served_at: questionServedAt,
          answer_submitted_at: new Date().toISOString(),
        },
      });

      if (error) throw error;
      return data as {
        success: boolean;
        is_correct: boolean;
        evaluation_method: string;
        time_taken_seconds: number;
        correct_answer: string | null;
        answer_id: string;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-session'] });
    },
  });
}

// Complete a session
export function useCompleteSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      sessionId,
      passed,
    }: {
      sessionId: string;
      passed: boolean;
    }) => {
      // Get session stats
      const { data: session } = await supabase
        .from('assessment_sessions')
        .select('questions_answered, questions_correct')
        .eq('id', sessionId)
        .single();

      const totalScore = session && session.questions_answered > 0
        ? (session.questions_correct / session.questions_answered) * 100
        : 0;

      const { data, error } = await supabase
        .from('assessment_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_score: totalScore,
          passed,
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data as AssessmentSession;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['active-session'] });
      queryClient.invalidateQueries({ queryKey: ['session-history'] });
      
      if (data.passed) {
        toast({
          title: 'Assessment Passed!',
          description: `You scored ${Math.round(data.total_score || 0)}%`,
        });
      } else {
        toast({
          title: 'Assessment Complete',
          description: `You scored ${Math.round(data.total_score || 0)}%. Keep practicing!`,
          variant: 'destructive',
        });
      }
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