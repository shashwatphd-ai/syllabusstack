import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import {
  validateSubmitResponseRequest,
  corsPreflightResponse,
  successResponse,
  validationErrorResponse,
  authErrorResponse,
  notFoundResponse,
  internalErrorResponse,
  generateRequestId,
  PipelineLogger,
  authenticateRequest,
  checkRateLimit,
  getUserLimits,
  rateLimitResponse,
  ErrorCodes,
} from "../_shared/skills-pipeline/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AssessmentItem {
  id: string;
  question_text: string;
  question_type: string;
  framework: string;
  measures_dimension: string;
  response_options: Record<string, unknown> | null;
  sequence_order: number | null;
}

serve(async (req) => {
  const requestId = generateRequestId();
  const logger = new PipelineLogger('submit-skills-response', requestId);
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse([{
        code: ErrorCodes.VALIDATION_REQUIRED_FIELD,
        field: 'body',
        message: 'Request body is required',
      }], requestId);
    }

    const validation = validateSubmitResponseRequest(body);
    if (!validation.success) {
      logger.warn('Validation failed', { errors: validation.errors });
      return validationErrorResponse(validation.errors!, requestId);
    }

    const { session_id, question_id, response_value, response_time_ms } = validation.data!;

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return authErrorResponse(ErrorCodes.AUTH_MISSING_HEADER, 'Authorization header required', requestId);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const authResult = await authenticateRequest(req, supabase, requestId);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    // Rate limiting (lighter weight for response submissions)
    const limits = await getUserLimits(supabase, userId);
    const rateLimitResult = await checkRateLimit(supabase, userId, 'submit-skills-response', limits);
    
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', { remaining: rateLimitResult.remaining });
      return rateLimitResponse(
        rateLimitResult.reason || 'Rate limit exceeded',
        rateLimitResult.retryAfter || 3600,
        requestId,
        rateLimitResult.remaining
      );
    }

    logger.info('Processing response', { session_id, question_id, response_value });

    // Validate session belongs to user and is in progress
    const { data: session, error: sessionError } = await supabase
      .from('skills_assessment_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      logger.warn('Session not found', { session_id, userId });
      return notFoundResponse('Assessment session', requestId);
    }

    if (session.status !== 'in_progress') {
      logger.warn('Session not in progress', { session_id, status: session.status });
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: ErrorCodes.SESSION_NOT_IN_PROGRESS,
          message: 'Assessment session is not in progress',
        },
        meta: { request_id: requestId },
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate question exists
    const { data: question, error: questionError } = await supabase
      .from('assessment_item_bank')
      .select('*')
      .eq('id', question_id)
      .single();

    if (questionError || !question) {
      logger.warn('Question not found', { question_id });
      return notFoundResponse('Assessment question', requestId);
    }

    // Check if already answered (upsert to handle duplicates)
    const { data: existingResponse } = await supabase
      .from('skills_assessment_responses')
      .select('id')
      .eq('session_id', session_id)
      .eq('question_id', question_id)
      .maybeSingle();

    if (existingResponse) {
      // Update existing response
      const { error: updateError } = await supabase
        .from('skills_assessment_responses')
        .update({
          response_value,
          response_time_ms,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingResponse.id);

      if (updateError) {
        logger.error('Failed to update response', updateError);
        throw updateError;
      }
      logger.info('Updated existing response', { responseId: existingResponse.id });
    } else {
      // Insert new response
      const { error: insertError } = await supabase
        .from('skills_assessment_responses')
        .insert({
          session_id,
          question_id,
          response_value,
          response_time_ms,
        });

      if (insertError) {
        logger.error('Failed to insert response', insertError);
        throw insertError;
      }
      logger.info('Inserted new response');
    }

    // Count total responses
    const { count: answeredCount } = await supabase
      .from('skills_assessment_responses')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session_id);

    // Update session progress
    await supabase
      .from('skills_assessment_sessions')
      .update({
        questions_answered: answeredCount || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    // Check if assessment is complete
    const isComplete = (answeredCount || 0) >= session.total_questions;

    // Get next batch of unanswered questions
    let nextBatch: AssessmentItem[] = [];
    if (!isComplete) {
      // Get all answered question IDs
      const { data: allResponses } = await supabase
        .from('skills_assessment_responses')
        .select('question_id')
        .eq('session_id', session_id);

      const answeredIds = new Set(allResponses?.map((r: { question_id: string }) => r.question_id) || []);

      // Get remaining questions
      const isQuick = session.session_type === 'quick';
      let query = supabase
        .from('assessment_item_bank')
        .select('*')
        .order('framework')
        .order('sequence_order');

      if (isQuick) {
        query = query.eq('is_quick_assessment', true);
      }

      const { data: allQuestions } = await query;
      const remainingQuestions = (allQuestions || []).filter(
        (q: AssessmentItem) => !answeredIds.has(q.id)
      );

      const batchSize = 10;
      nextBatch = remainingQuestions.slice(0, batchSize);
    }

    const progress = {
      answered: answeredCount || 0,
      total: session.total_questions,
      percentage: Math.round(((answeredCount || 0) / session.total_questions) * 100),
    };

    logger.complete('success', { progress, isComplete });

    return successResponse({
      progress,
      next_batch: nextBatch,
      is_complete: isComplete,
    }, requestId, startTime);

  } catch (error) {
    logger.error('Unhandled error', error);
    return internalErrorResponse(error, requestId);
  }
});
