/**
 * Assessment Mutation Hooks
 *
 * Contains hooks for starting, answering, and completing assessments.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type {
  StartAssessmentResponse,
  SubmitAnswerResponse,
  CompleteAssessmentResponse,
} from './types';

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

      return data as StartAssessmentResponse;
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

      return data as SubmitAnswerResponse;
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

      return data as CompleteAssessmentResponse;
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
          title: 'Assessment Passed!',
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

// Generate assessment questions for a learning objective using AI
export function useGenerateAssessmentQuestions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      learningObjectiveId,
      learningObjectiveText,
      contentContext,
      existingQuestions,
    }: {
      learningObjectiveId?: string;
      learningObjectiveText?: string;
      contentContext?: string;
      existingQuestions?: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-assessment-questions', {
        body: {
          learning_objective_id: learningObjectiveId,
          learning_objective_text: learningObjectiveText,
          content_context: contentContext,
          existing_questions: existingQuestions,
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

// Delete an individual assessment question
export function useDeleteAssessmentQuestion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ questionId, learningObjectiveId }: { questionId: string; learningObjectiveId: string }) => {
      const { error } = await supabase
        .from('assessment_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;
      return { questionId, learningObjectiveId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['assessment-questions', data.learningObjectiveId]
      });
      toast({
        title: 'Question Removed',
        description: 'The question has been deleted.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete question',
        variant: 'destructive',
      });
    },
  });
}
