/**
 * Assessment Response Logger
 *
 * Logs individual question responses for IRT parameter calibration.
 * This data enables the adaptive assessment system to improve over time.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AssessmentResponseLog {
  session_id: string;
  question_id: string;
  user_id: string;
  skill_name: string;
  is_correct: boolean;
  response_time_ms?: number;
  confidence_level?: number; // 1-5 scale
  bloom_level?: string;
  estimated_difficulty?: number;
}

/**
 * Log a single assessment response
 * Non-blocking - errors are logged but don't break the flow
 */
export async function logAssessmentResponse(
  supabase: SupabaseClient,
  response: AssessmentResponseLog
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('assessment_responses')
      .insert({
        session_id: response.session_id,
        question_id: response.question_id,
        user_id: response.user_id,
        skill_name: response.skill_name,
        is_correct: response.is_correct,
        response_time_ms: response.response_time_ms,
        confidence_level: response.confidence_level,
        bloom_level: response.bloom_level,
        estimated_difficulty: response.estimated_difficulty,
        responded_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[AssessmentLogger] Failed to log response:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[AssessmentLogger] Exception:', message);
    return { success: false, error: message };
  }
}

/**
 * Log multiple assessment responses in a batch
 * More efficient for end-of-session logging
 */
export async function logBatchResponses(
  supabase: SupabaseClient,
  responses: AssessmentResponseLog[]
): Promise<{ success: boolean; logged: number; error?: string }> {
  if (responses.length === 0) {
    return { success: true, logged: 0 };
  }

  try {
    const records = responses.map(r => ({
      session_id: r.session_id,
      question_id: r.question_id,
      user_id: r.user_id,
      skill_name: r.skill_name,
      is_correct: r.is_correct,
      response_time_ms: r.response_time_ms,
      confidence_level: r.confidence_level,
      bloom_level: r.bloom_level,
      estimated_difficulty: r.estimated_difficulty,
      responded_at: new Date().toISOString(),
    }));

    const { error, count } = await supabase
      .from('assessment_responses')
      .insert(records);

    if (error) {
      console.error('[AssessmentLogger] Failed to log batch:', error.message);
      return { success: false, logged: 0, error: error.message };
    }

    return { success: true, logged: count || responses.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[AssessmentLogger] Batch exception:', message);
    return { success: false, logged: 0, error: message };
  }
}

/**
 * Get response statistics for a question (for IRT calibration)
 */
export async function getQuestionStats(
  supabase: SupabaseClient,
  questionId: string
): Promise<{
  total_responses: number;
  correct_count: number;
  avg_response_time_ms: number;
  difficulty_estimate: number;
}> {
  const { data, error } = await supabase
    .from('assessment_responses')
    .select('is_correct, response_time_ms')
    .eq('question_id', questionId);

  if (error || !data || data.length === 0) {
    return {
      total_responses: 0,
      correct_count: 0,
      avg_response_time_ms: 0,
      difficulty_estimate: 0, // neutral difficulty
    };
  }

  const total = data.length;
  const correct = data.filter(r => r.is_correct).length;
  const times = data
    .filter(r => r.response_time_ms != null)
    .map(r => r.response_time_ms as number);
  const avgTime = times.length > 0
    ? times.reduce((a, b) => a + b, 0) / times.length
    : 0;

  // Simple difficulty estimate from proportion correct
  // Higher proportion correct = easier = lower difficulty
  const pCorrect = correct / total;
  // Map to theta scale: 50% correct = 0, 90% = -2, 10% = +2
  const difficulty = -2 * (2 * pCorrect - 1);

  return {
    total_responses: total,
    correct_count: correct,
    avg_response_time_ms: avgTime,
    difficulty_estimate: Math.max(-3, Math.min(3, difficulty)),
  };
}

/**
 * Get user's response history for a skill (for ability estimation)
 */
export async function getUserSkillResponses(
  supabase: SupabaseClient,
  userId: string,
  skillName: string,
  limit: number = 50
): Promise<Array<{
  question_id: string;
  is_correct: boolean;
  difficulty: number;
  responded_at: string;
}>> {
  const { data, error } = await supabase
    .from('assessment_responses')
    .select('question_id, is_correct, estimated_difficulty, responded_at')
    .eq('user_id', userId)
    .eq('skill_name', skillName)
    .order('responded_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map(r => ({
    question_id: r.question_id,
    is_correct: r.is_correct,
    difficulty: r.estimated_difficulty || 0,
    responded_at: r.responded_at,
  }));
}
