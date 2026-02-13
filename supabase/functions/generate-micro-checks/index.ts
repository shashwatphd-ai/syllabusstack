import { createClient } from "@supabase/supabase-js";
import { generateText, MODELS, parseJsonResponse } from "../_shared/unified-ai-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
} from "../_shared/error-handler.ts";
import { checkRateLimit, getUserLimits, createRateLimitResponse } from "../_shared/rate-limiter.ts";
import { validateRequest, generateMicroChecksSchema } from "../_shared/validators/index.ts";

interface GeneratedMicroCheck {
  trigger_time_seconds: number;
  question_text: string;
  question_type: 'recall' | 'mcq';
  correct_answer: string;
  options?: { text: string; is_correct: boolean }[];
  rewind_target_seconds: number;
}

const handler = async (req: Request): Promise<Response> => {
  // CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return createErrorResponse('UNAUTHORIZED', corsHeaders, 'No authorization header');
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (authError || !user) {
    return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Unauthorized');
  }

  // Rate limit check
  const limits = await getUserLimits(supabase, user.id);
  const rateLimitResult = await checkRateLimit(supabase, user.id, 'generate-micro-checks', limits);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, corsHeaders);
  }

  // Validate request body
  const body = await req.json();
  const validation = validateRequest(generateMicroChecksSchema, body);
  if (!validation.success) {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
  }

  const {
    content_id,
    learning_objective_id,
    content_title,
    content_description,
    duration_seconds,
    learning_objective_text,
    num_checks,
  } = validation.data;

  logInfo('generate-micro-checks', 'starting', { 
    userId: user.id, 
    contentId: content_id,
    numChecks: num_checks
  });

  // Calculate check intervals (evenly distributed)
  const numChecksValue = num_checks ?? 3;
  const checkInterval = Math.floor(duration_seconds / (numChecksValue + 1));
  const checkTimes = Array.from({ length: numChecksValue }, (_, i) => 
    checkInterval * (i + 1)
  );

  const systemPrompt = 'You are an educational assessment expert. Generate micro-check questions in valid JSON format only.';

  const userPrompt = `You are an educational assessment expert. Generate ${numChecksValue} micro-check questions for a video about "${content_title}".

Learning Objective: ${learning_objective_text}

Video Description: ${content_description || 'No description available'}
Video Duration: ${Math.floor(duration_seconds / 60)} minutes ${duration_seconds % 60} seconds

Generate questions that will appear at these timestamps (in seconds): ${checkTimes.join(', ')}

For each micro-check, provide:
1. A question that tests comprehension of content up to that point
2. Either a "recall" question (short answer, 1-3 words) or "mcq" (multiple choice with 4 options)
3. The correct answer
4. For MCQ, provide 4 options with one correct answer
5. A rewind target (where to send the student if they answer incorrectly, typically 20-30 seconds before the question)

Mix question types - use recall for simple facts and MCQ for conceptual understanding.

Return a JSON array with exactly ${num_checks} objects in this format:
[
  {
    "trigger_time_seconds": <number>,
    "question_text": "<question>",
    "question_type": "recall" | "mcq",
    "correct_answer": "<answer>",
    "options": [{"text": "<option>", "is_correct": true/false}, ...] // only for mcq
    "rewind_target_seconds": <number>
  }
]

Return ONLY the JSON array, no other text.`;

  // Use unified AI client for text generation
  const result = await generateText({
    prompt: userPrompt,
    systemPrompt: systemPrompt,
    model: MODELS.FAST,
    temperature: 0.7,
    fallbacks: [MODELS.GEMINI_FLASH],
    logPrefix: '[generate-micro-checks]'
  });
  const content = result.content;

  if (!content) {
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, 'No response from AI');
  }

  // Parse the JSON response
  let microChecks: GeneratedMicroCheck[];
  try {
    // Extract JSON from the response (in case there's extra text)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    microChecks = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    console.error('Failed to parse AI response:', content);
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, 'Failed to parse micro-checks from AI response');
  }

  // Validate and fix micro-checks before storing
  const validatedChecks = microChecks.map(check => {
    // For MCQ, extract correct answer from options if missing
    let correctAnswer = check.correct_answer;
    if (!correctAnswer && check.options && check.question_type === 'mcq') {
      const correctOption = check.options.find(opt => opt.is_correct);
      correctAnswer = correctOption?.text || 'See options';
    }
    // For recall, provide default if missing
    if (!correctAnswer) {
      correctAnswer = 'Answer not specified';
    }
    
    return {
      content_id,
      trigger_time_seconds: check.trigger_time_seconds || 60,
      question_text: check.question_text || 'Check your understanding',
      question_type: check.question_type || 'recall',
      correct_answer: correctAnswer,
      options: check.options || null,
      rewind_target_seconds: check.rewind_target_seconds || Math.max(0, (check.trigger_time_seconds || 60) - 30),
      created_by: user.id,
    };
  });
  
  const insertData = validatedChecks;

  const { data: savedChecks, error: insertError } = await supabase
    .from('micro_checks')
    .insert(insertData)
    .select();

  if (insertError) {
    console.error('Error saving micro-checks:', insertError);
    return createErrorResponse('DATABASE_ERROR', corsHeaders, insertError.message);
  }

  // Track AI usage
  await supabase.from('ai_usage').insert({
    user_id: user.id,
    function_name: 'generate-micro-checks',
    model_used: 'openrouter/gpt-4o-mini',
  });

  logInfo('generate-micro-checks', 'complete', { 
    userId: user.id, 
    checkCount: savedChecks?.length || 0
  });

  return createSuccessResponse({ 
    success: true,
    micro_checks: savedChecks,
    count: savedChecks?.length || 0,
  }, corsHeaders);
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
