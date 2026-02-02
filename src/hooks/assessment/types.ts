/**
 * Assessment Types
 *
 * Type definitions for assessment sessions, questions, and answers.
 */

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

export interface MicroCheck {
  id: string;
  content_id: string;
  question_text: string;
  question_type: string;
  options: unknown;
  trigger_time_seconds: number;
  rewind_target_seconds: number | null;
  time_limit_seconds: number | null;
}

export interface MicroCheckResult {
  id: string;
  consumption_record_id: string;
  micro_check_id: string;
  user_answer: string | null;
  selected_option_index: number | null;
  is_correct: boolean;
  attempt_number: number;
  created_at: string;
  micro_check?: {
    question_text: string;
    correct_answer: string;
    trigger_time_seconds: number;
  };
}

export interface StartAssessmentResponse {
  success: boolean;
  session: AssessmentSession;
  questions: AssessmentQuestion[];
  is_resumed: boolean;
  timeout_minutes?: number;
}

export interface SubmitAnswerResponse {
  success: boolean;
  is_correct: boolean;
  evaluation_method: string;
  time_taken_seconds: number;
  timing_flags: string[];
  correct_answer: string | null;
  answer_id: string;
  session_progress: SessionProgress;
}

export interface CompleteAssessmentResponse {
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
}

export interface ValidateMicroCheckResponse {
  is_correct: boolean;
  attempt_number: number;
  rewind_target_seconds: number | null;
  trigger_time_seconds: number;
}
