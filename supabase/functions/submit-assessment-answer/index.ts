import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { generateText, MODELS, parseJsonResponse } from "../_shared/unified-ai-client.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { logAssessmentResponse } from "../_shared/assessment-logger.ts";
import { validateRequest, assessmentAnswerSchema } from "../_shared/validators/index.ts";
import { checkRateLimit, getUserLimits, createRateLimitResponse } from "../_shared/rate-limiter.ts";

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');

  // Server-side timestamp for validation
  const serverReceivedAt = new Date();

  // Authenticate user with their auth token (not service role)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return createErrorResponse('UNAUTHORIZED', corsHeaders, 'No authorization header');
  }

  // Create client with user's auth context for proper RLS
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  // Validate token and get user
  const token = authHeader.replace('Bearer ', '');
  const { data, error: authError } = await supabase.auth.getClaims(token);

  if (authError || !data?.claims) {
    return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Invalid authentication token');
  }

  const userId = data.claims.sub as string;

  // Rate limit check
  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const limits = await getUserLimits(serviceClient, userId);
  const rateLimitResult = await checkRateLimit(serviceClient, userId, 'submit-assessment-answer', limits);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, corsHeaders);
  }

  // Validate request body with Zod schema
  const body = await req.json();
  const validation = validateRequest(assessmentAnswerSchema, body);
  if (!validation.success) {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
  }
  const {
    session_id,
    question_id,
    user_answer,
    client_question_served_at,
    client_answer_submitted_at,
  } = validation.data;

  logInfo('submit-assessment-answer', 'submitting', { sessionId: session_id, questionId: question_id });

  // Validate session exists and belongs to user
  const { data: session, error: sessionError } = await supabase
    .from('assessment_sessions')
    .select('*')
    .eq('id', session_id)
    .eq('user_id', userId)
    .single();

  if (sessionError || !session) {
    return createErrorResponse('NOT_FOUND', corsHeaders, 'Session not found or access denied');
  }

  // Validate session is still active
  if (session.status !== 'in_progress') {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Session is no longer active', { session_status: session.status });
  }

  // Check if session has timed out
  if (session.timeout_at && new Date(session.timeout_at) < serverReceivedAt) {
    // Mark session as abandoned
    await supabase
      .from('assessment_sessions')
      .update({ status: 'abandoned', completed_at: serverReceivedAt.toISOString() })
      .eq('id', session_id);

    return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Session has timed out', { timeout_at: session.timeout_at });
  }

  // Validate question is part of this session
  if (!session.question_ids.includes(question_id)) {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Question not part of this session');
  }

  // Check if question was already answered
  const { data: existingAnswer } = await supabase
    .from('assessment_answers')
    .select('id')
    .eq('session_id', session_id)
    .eq('question_id', question_id)
    .maybeSingle();

  if (existingAnswer) {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Question already answered');
  }

  // Fetch the question
  const { data: question, error: questionError } = await supabase
    .from('assessment_questions')
    .select('*')
    .eq('id', question_id)
    .single();

  if (questionError || !question) {
    return createErrorResponse('NOT_FOUND', corsHeaders, 'Question not found');
  }

  // Server-side timing validation
  const clientServed = new Date(client_question_served_at).getTime();
  const clientSubmitted = new Date(client_answer_submitted_at).getTime();
  const clientTimeTaken = (clientSubmitted - clientServed) / 1000;
  const serverTimeTaken = Math.round(clientTimeTaken);

  // Validate timing - check for impossibly fast answers
  const minTimeSeconds = 2;
  const maxTimeSeconds = question.time_limit_seconds ? question.time_limit_seconds * 2 : 300;

  const timingFlags: string[] = [];
  if (clientTimeTaken < minTimeSeconds) {
    timingFlags.push('suspiciously_fast');
  }
  if (clientTimeTaken > maxTimeSeconds) {
    timingFlags.push('exceeded_time_limit');
  }

  // Evaluate the answer
  let isCorrect = false;
  let evaluationMethod = 'exact_match';
  let evaluationDetails: Record<string, unknown> = {};

  if (question.question_type === 'mcq') {
    isCorrect = user_answer.toLowerCase().trim() === question.correct_answer?.toLowerCase().trim();
    evaluationMethod = 'exact_match';
    evaluationDetails = {
      user_answer,
      correct_answer: question.correct_answer,
    };
  } else if (question.question_type === 'true_false') {
    const normalizedAnswer = user_answer.toLowerCase().trim();
    const normalizedCorrect = question.correct_answer?.toLowerCase().trim();
    isCorrect = normalizedAnswer === normalizedCorrect;
    evaluationMethod = 'exact_match';
  } else if (question.question_type === 'short_answer') {
    // Check accepted answers first
    if (question.accepted_answers && question.accepted_answers.length > 0) {
      isCorrect = question.accepted_answers.some(
        (accepted: string) => user_answer.toLowerCase().trim() === accepted.toLowerCase().trim()
      );
      evaluationMethod = 'accepted_answers';
    }

    // Check required keywords
    if (!isCorrect && question.required_keywords && question.required_keywords.length > 0) {
      const userWords = user_answer.toLowerCase().split(/\s+/);
      const matchedKeywords = question.required_keywords.filter(
        (keyword: string) => userWords.some((w: string) => w.includes(keyword.toLowerCase()))
      );
      const matchRatio = matchedKeywords.length / question.required_keywords.length;

      if (matchRatio >= 0.7) {
        isCorrect = true;
        evaluationMethod = 'keyword_match';
        evaluationDetails = {
          matched_keywords: matchedKeywords,
          required_keywords: question.required_keywords,
          match_ratio: matchRatio,
        };
      }
    }

    // AI evaluation for complex short answers
    if (!isCorrect && user_answer.length > 10 && openRouterKey) {
      try {
        const aiPrompt = `Evaluate if this student answer is correct.

Question: ${question.question_text}
${question.scenario_context ? `Context: ${question.scenario_context}` : ''}
Expected Answer: ${question.correct_answer}
Student Answer: ${user_answer}

Consider:
1. The core concept must be present
2. Minor spelling/grammar errors are acceptable
3. Different wording conveying the same meaning is acceptable
4. Partial credit: mark correct if 70%+ of the key concepts are present

Respond with JSON only:
{"is_correct": true/false, "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

        const result = await generateText({
          prompt: aiPrompt,
          systemPrompt: 'You are an educational assessment evaluator. Return only valid JSON.',
          model: MODELS.FAST,
          logPrefix: '[submit-assessment-answer]'
        });

        if (result.content) {
          const aiResult = parseJsonResponse<{ is_correct: boolean; confidence: number; reasoning: string }>(result.content);
          isCorrect = aiResult.is_correct && aiResult.confidence >= 0.7;
          evaluationMethod = 'ai_evaluation';
          evaluationDetails = {
            ...aiResult,
            user_answer,
            correct_answer: question.correct_answer,
          };
        }
      } catch (aiError) {
        logError('submit-assessment-answer', aiError instanceof Error ? aiError : new Error(String(aiError)), { context: 'AI evaluation failed' });
        evaluationMethod = 'needs_manual_review';
      }
    }
  }

  // Add timing flags to evaluation details
  if (timingFlags.length > 0) {
    evaluationDetails.timing_flags = timingFlags;
  }

  // Save the answer
  const { data: savedAnswer, error: saveError } = await supabase
    .from('assessment_answers')
    .insert({
      session_id,
      question_id,
      user_answer,
      is_correct: isCorrect,
      time_taken_seconds: serverTimeTaken,
      question_served_at: client_question_served_at,
      answer_submitted_at: client_answer_submitted_at,
      server_received_at: serverReceivedAt.toISOString(),
      evaluation_method: evaluationMethod,
      evaluation_details: evaluationDetails,
    })
    .select()
    .single();

  if (saveError) {
    return createErrorResponse('DATABASE_ERROR', corsHeaders, 'Failed to save answer', { details: saveError.message });
  }

  // Update session progress
  const newQuestionsAnswered = (session.questions_answered || 0) + 1;
  const newQuestionsCorrect = (session.questions_correct || 0) + (isCorrect ? 1 : 0);
  const currentQuestionIdx = session.question_ids.indexOf(question_id);
  const nextQuestionIndex = Math.min(currentQuestionIdx + 1, session.question_ids.length - 1);

  await supabase
    .from('assessment_sessions')
    .update({
      questions_answered: newQuestionsAnswered,
      questions_correct: newQuestionsCorrect,
      current_question_index: nextQuestionIndex,
    })
    .eq('id', session_id);

  // Log response for IRT calibration (non-blocking)
  logAssessmentResponse(supabase, {
    session_id,
    question_id,
    user_id: userId,
    skill_name: question.skill_name || session.skill_name || 'unknown',
    is_correct: isCorrect,
    response_time_ms: serverTimeTaken * 1000,
    bloom_level: question.bloom_level,
    estimated_difficulty: question.difficulty,
  }).catch((err) => {
    // Non-blocking - just log the error
    logError('submit-assessment-answer', new Error(`Assessment logging failed: ${err}`));
  });

  // Check if assessment is complete
  const isComplete = newQuestionsAnswered >= session.question_ids.length;
  const currentScore = (newQuestionsCorrect / newQuestionsAnswered) * 100;

  logInfo('submit-assessment-answer', 'saved', {
    sessionId: session_id,
    progress: `${newQuestionsAnswered}/${session.question_ids.length}`,
    isCorrect
  });

  return createSuccessResponse({
    success: true,
    is_correct: isCorrect,
    evaluation_method: evaluationMethod,
    time_taken_seconds: serverTimeTaken,
    timing_flags: timingFlags,
    correct_answer: isCorrect ? null : question.correct_answer,
    answer_id: savedAnswer?.id,
    session_progress: {
      questions_answered: newQuestionsAnswered,
      questions_correct: newQuestionsCorrect,
      total_questions: session.question_ids.length,
      current_score: Math.round(currentScore),
      is_complete: isComplete,
    },
  }, corsHeaders);
};

serve(withErrorHandling(handler, getCorsHeaders));
