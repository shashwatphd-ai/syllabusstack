import { createClient } from "@supabase/supabase-js";
import {
  validateStartAssessmentRequest,
  successResponse,
  validationErrorResponse,
  authErrorResponse,
  internalErrorResponse,
  generateRequestId,
  PipelineLogger,
  authenticateRequest,
  checkRateLimit,
  getUserLimits,
  rateLimitResponse,
  ErrorCodes,
} from "../_shared/skills-pipeline/index.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

interface AssessmentItem {
  id: string;
  question_text: string;
  question_type: string;
  framework: string;
  measures_dimension: string;
  response_options: Record<string, unknown> | null;
  sequence_order: number | null;
}

Deno.serve(async (req) => {
  const requestId = generateRequestId();
  const logger = new PipelineLogger('start-skills-assessment', requestId);
  const startTime = Date.now();

  // Handle CORS preflight with environment-based origins
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const validation = validateStartAssessmentRequest(body);
    if (!validation.success) {
      logger.warn('Validation failed', { errors: validation.errors });
      return validationErrorResponse(validation.errors!, requestId, corsHeaders);
    }

    const { session_type } = validation.data!;
    logger.info('Starting assessment', { session_type });

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return authErrorResponse(ErrorCodes.AUTH_MISSING_HEADER, 'Authorization header required', requestId, corsHeaders);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const authResult = await authenticateRequest(req, supabase, requestId, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    // Check rate limits
    const limits = await getUserLimits(supabase, userId);
    const rateLimitResult = await checkRateLimit(supabase, userId, 'start-skills-assessment', limits);

    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', { remaining: rateLimitResult.remaining });
      return rateLimitResponse(
        rateLimitResult.reason || 'Rate limit exceeded',
        rateLimitResult.retryAfter || 3600,
        requestId,
        rateLimitResult.remaining,
        corsHeaders
      );
    }

    logger.info('User authenticated', { userId, session_type });

    // Check for existing in-progress session
    const { data: existingSession, error: existingError } = await supabase
      .from('skills_assessment_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (existingError) {
      logger.error('Failed to check existing session', existingError);
    }

    if (existingSession) {
      logger.info('Resuming existing session', { sessionId: existingSession.id });

      // Get answered question IDs
      const { data: responses } = await supabase
        .from('skills_assessment_responses')
        .select('question_id')
        .eq('session_id', existingSession.id);

      const answeredIds = new Set(responses?.map((r: { question_id: string }) => r.question_id) || []);

      // Get remaining questions
      const isQuick = existingSession.session_type === 'quick';
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

      // Return first batch of remaining questions
      const batchSize = 10;
      const firstBatch = remainingQuestions.slice(0, batchSize);

      logger.complete('success', {
        sessionId: existingSession.id,
        resumed: true,
        questionsRemaining: remainingQuestions.length
      });

      return successResponse({
        session_id: existingSession.id,
        session_type: existingSession.session_type,
        total_questions: (allQuestions || []).length,
        questions_answered: answeredIds.size,
        first_batch: firstBatch,
        is_resumed: true,
      }, requestId, startTime, corsHeaders);
    }

    // Fetch questions based on session type
    const isQuick = session_type === 'quick';
    let query = supabase
      .from('assessment_item_bank')
      .select('*')
      .order('framework')
      .order('sequence_order');

    if (isQuick) {
      query = query.eq('is_quick_assessment', true);
    }

    const { data: questions, error: questionsError } = await query;

    if (questionsError || !questions || questions.length === 0) {
      logger.error('Failed to fetch questions', questionsError);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: ErrorCodes.RESOURCE_NOT_FOUND,
          message: 'No assessment questions available',
        },
        meta: { request_id: requestId },
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create new session
    const { data: session, error: sessionError } = await supabase
      .from('skills_assessment_sessions')
      .insert({
        user_id: userId,
        session_type,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        total_questions: questions.length,
        questions_answered: 0,
      })
      .select()
      .single();

    if (sessionError) {
      logger.error('Failed to create session', sessionError);
      throw sessionError;
    }

    logger.info('Session created', { sessionId: session.id, totalQuestions: questions.length });

    // Return first batch
    const batchSize = 10;
    const firstBatch = questions.slice(0, batchSize);

    logger.complete('success', { sessionId: session.id, totalQuestions: questions.length });

    return successResponse({
      session_id: session.id,
      session_type,
      total_questions: questions.length,
      questions_answered: 0,
      first_batch: firstBatch,
      is_resumed: false,
    }, requestId, startTime, corsHeaders);

  } catch (error) {
    logger.error('Unhandled error', error);
    return internalErrorResponse(error, requestId, corsHeaders);
  }
});
