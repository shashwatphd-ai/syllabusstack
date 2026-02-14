import { createClient } from "@supabase/supabase-js";
import { trackAIUsage, createServiceClient } from "../_shared/ai-cache.ts";
import { generateStructured, MODELS } from "../_shared/unified-ai-client.ts";
import { checkRateLimit, getUserLimits, createRateLimitResponse } from "../_shared/rate-limiter.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo
} from "../_shared/error-handler.ts";
import { validateRequest, generateAssessmentQuestionsSchema } from "../_shared/validators/index.ts";

/**
 * Assessment Question Generation Schema
 * Generates MCQ and short answer questions from learning objectives
 */
const QUESTION_GENERATION_SCHEMA = {
  name: "generate_questions",
  description: "Generate assessment questions for a learning objective",
  parameters: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question_type: {
              type: "string",
              enum: ["mcq", "short_answer", "true_false"],
              description: "Type of question"
            },
            question_text: {
              type: "string",
              description: "The question to ask the student"
            },
            difficulty: {
              type: "string",
              enum: ["easy", "medium", "hard"],
              description: "Question difficulty level"
            },
            bloom_level: {
              type: "string",
              enum: ["remember", "understand", "apply", "analyze", "evaluate", "create"],
              description: "Bloom's taxonomy level"
            },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string", description: "Option label (A, B, C, D)" },
                  text: { type: "string", description: "Option text" },
                  is_correct: { type: "boolean", description: "Whether this is the correct answer" }
                },
                required: ["label", "text", "is_correct"]
              },
              description: "Options for multiple choice questions (4 options)"
            },
            correct_answer: {
              type: "string",
              description: "The correct answer (for short answer) or correct option label (for MCQ)"
            },
            accepted_answers: {
              type: "array",
              items: { type: "string" },
              description: "Alternative accepted answers for short answer questions"
            },
            required_keywords: {
              type: "array",
              items: { type: "string" },
              description: "Keywords that must appear in short answer responses"
            },
            scenario_context: {
              type: "string",
              description: "Optional scenario or context for application questions"
            },
            explanation: {
              type: "string",
              description: "Explanation of why the answer is correct"
            }
          },
          required: ["question_type", "question_text", "difficulty", "bloom_level", "correct_answer"]
        }
      }
    },
    required: ["questions"]
  }
};

const QUESTION_GENERATION_PROMPT = `You are an expert assessment designer creating questions that test deep understanding, not just surface recall.

CRITICAL RULES FOR CORRECT ANSWERS:
- For MCQ: correct_answer MUST be the label of the correct option (e.g. "A", "B", "C", or "D")
- For short_answer: correct_answer MUST be a complete, substantive model answer (2-4 sentences) that a student could compare against
- For true_false: correct_answer MUST be exactly "True" or "False"
- NEVER use source names, citations, brand names, or placeholder text as answers
- NEVER output "CliffsNotes", "Wikipedia", "Textbook", or any reference source as an answer

QUESTION DESIGN PRINCIPLES:
1. Test UNDERSTANDING and APPLICATION, not memorization
2. Use real-world scenarios that require students to apply concepts
3. For MCQ: All distractors must be plausible and based on common misconceptions
4. For short_answer: Provide a detailed model answer AND required_keywords for grading
5. Include at least 2 scenario/application questions
6. Every question must have a clear, defensible correct answer

QUESTION MIX:
- 2-3 MCQ questions testing conceptual understanding
- 1-2 scenario-based MCQ questions (apply concepts to a situation)
- 1-2 short_answer questions requiring explanation/analysis
- 0-1 true_false questions (use sparingly)

DIFFICULTY DISTRIBUTION: 2 easy, 2-3 medium, 1-2 hard

BLOOM'S TAXONOMY COVERAGE:
- Easy: remember/understand level
- Medium: apply/analyze level  
- Hard: evaluate/create level

MCQ DISTRACTOR RULES:
1. Each distractor should be grammatically similar to the correct answer
2. Similar length to correct answer
3. At least one distractor should be a common misconception
4. No "all of the above" or "none of the above"
5. Distractors must be clearly wrong to an expert, but tempting to a novice

SHORT ANSWER RULES:
1. correct_answer must contain the FULL MODEL ANSWER (2-4 sentences)
2. accepted_answers should list 3-5 alternative phrasings
3. required_keywords should list 3-6 key terms that indicate understanding
4. Ask students to explain WHY or HOW, not just WHAT

OUTPUT 5-7 QUESTIONS per learning objective.`;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check rate limits (Task 2.1.3 from MASTER_IMPLEMENTATION_PLAN_V2.md)
    const serviceClient = createServiceClient();
    const userLimits = await getUserLimits(serviceClient, user.id);
    const rateLimitResult = await checkRateLimit(serviceClient, user.id, 'generate-assessment-questions', userLimits);

    if (!rateLimitResult.allowed) {
      logInfo('generate-assessment-questions', 'rate_limit_exceeded', {
        userId: user.id,
        remaining: rateLimitResult.remaining,
      });
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    logInfo('generate-assessment-questions', 'rate_limit_passed', { userId: user.id });

    // Validate request body
    const body = await req.json();
    const validation = validateRequest(generateAssessmentQuestionsSchema, body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
    }

    const { learning_objective_id, learning_objective_text, content_context, existing_questions } = validation.data;

    let objectiveText = learning_objective_text;
    let loId = learning_objective_id;

    // If ID provided, fetch the learning objective
    if (learning_objective_id && !learning_objective_text) {
      const { data: lo, error: loError } = await supabase
        .from("learning_objectives")
        .select("text, core_concept, action_verb, bloom_level")
        .eq("id", learning_objective_id)
        .single();

      if (loError || !lo) {
        throw new Error("Learning objective not found");
      }
      objectiveText = lo.text;
    }

    console.log(`Generating questions for LO: ${loId || 'custom'}`);

    // Build prompt with context
    let userPrompt = `Generate assessment questions for this learning objective:

LEARNING OBJECTIVE:
${objectiveText}`;

    if (content_context) {
      userPrompt += `

CONTENT CONTEXT (from video/reading material):
${content_context}`;
    }

    // Add existing questions context to avoid duplicates
    if (existing_questions && Array.isArray(existing_questions) && existing_questions.length > 0) {
      userPrompt += `

EXISTING QUESTIONS (DO NOT repeat or rephrase these — generate COMPLETELY DIFFERENT questions covering different aspects, scenarios, or difficulty levels):
${existing_questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}`;
    }

    userPrompt += `

Generate 5-7 questions that effectively test whether a student has achieved this learning objective.
${existing_questions?.length ? `IMPORTANT: You MUST generate entirely new questions that are different from the ${existing_questions.length} existing ones listed above. Cover different concepts, use different scenarios, and test different cognitive levels.` : ''}
Include a mix of:
- 3-4 multiple choice questions at different difficulty levels
- 1-2 short answer questions requiring explanation
- At least 1 application/scenario question

For each multiple choice question, provide exactly 4 options with one correct answer.
For short answer questions, include keywords that indicate correct understanding.`;

    // Use gemini-3-flash-preview for better reasoning quality (flash-lite produced garbage answers)
    const result = await generateStructured<{ questions: any[] }>({
      prompt: userPrompt,
      systemPrompt: QUESTION_GENERATION_PROMPT,
      schema: QUESTION_GENERATION_SCHEMA,
      model: MODELS.PROFESSOR_AI,
      fallbacks: [MODELS.GEMINI_FLASH],
      logPrefix: '[generate-assessment-questions]'
    });
    const parsed = result.data;

    // Validate and sanitize generated questions
    const GARBAGE_ANSWERS = ['cliffsnotes', 'wikipedia', 'textbook', 'n/a', 'see above', 'refer to'];
    const questions = (parsed.questions || []).filter((q: any) => {
      // Reject questions with garbage/placeholder answers
      const answer = (q.correct_answer || '').toLowerCase().trim();
      if (!answer || answer.length < 3) return false;
      if (GARBAGE_ANSWERS.some(g => answer.includes(g))) {
        console.warn(`Filtered garbage answer: "${q.correct_answer}" for Q: "${q.question_text?.slice(0, 50)}"`);
        return false;
      }
      // For short_answer, ensure answer is substantive (>20 chars)
      if (q.question_type === 'short_answer' && answer.length < 20) {
        console.warn(`Filtered too-short answer for short_answer Q: "${q.correct_answer}"`);
        return false;
      }
      return true;
    });

    console.log(`Generated ${parsed.questions?.length || 0} questions, ${questions.length} passed validation`);

    // If learning_objective_id provided, save questions to database
    if (loId) {
      const questionsToInsert = questions.map((q: any) => {
        // Normalize question types: AI may still output 'multiple_choice' -> map to 'mcq'
        let questionType = q.question_type;
        if (questionType === 'multiple_choice') questionType = 'mcq';
        
        return {
          learning_objective_id: loId,
          question_type: questionType,
          question_text: q.question_text,
          difficulty: q.difficulty,
          bloom_level: q.bloom_level,
          options: q.options || null,
          correct_answer: q.correct_answer,
          accepted_answers: q.accepted_answers || null,
          required_keywords: q.required_keywords || null,
          scenario_context: q.scenario_context || null,
          is_ai_generated: true,
          ai_reviewed: false,
          created_by: user.id
        };
      });

      const { data: inserted, error: insertError } = await supabase
        .from("assessment_questions")
        .insert(questionsToInsert)
        .select();

      if (insertError) {
        console.error("Error inserting questions:", insertError);
        // Don't fail - return the generated questions anyway
      } else {
        console.log(`Saved ${inserted?.length || 0} questions to database`);
      }
    }

    // Track AI usage
    const usageClient = createServiceClient();
    await trackAIUsage(
      usageClient,
      user.id,
      "generate-assessment-questions",
      "openrouter/gpt-4o-mini"
    );

    return new Response(
      JSON.stringify({
        success: true,
        questions,
        count: questions.length,
        learning_objective_id: loId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in generate-assessment-questions:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
