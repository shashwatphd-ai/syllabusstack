import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { trackAIUsage, createServiceClient } from "../_shared/ai-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
              enum: ["multiple_choice", "short_answer", "true_false"],
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

const QUESTION_GENERATION_PROMPT = `You are an expert educator creating assessment questions to verify student learning.

QUESTION DESIGN RULES:
1. Create questions that TEST understanding, not just recall
2. For multiple choice: All distractors should be plausible but clearly wrong
3. For short answer: Be specific about expected answer format
4. Mix difficulty levels: 2 easy, 3 medium, 1-2 hard
5. Cover different Bloom's taxonomy levels
6. Include at least one application/scenario question

QUESTION TYPES:
- multiple_choice: 4 options (A, B, C, D), only one correct
- short_answer: Open response with required keywords for grading
- true_false: Statement to evaluate (use sparingly)

QUALITY STANDARDS:
- Clear, unambiguous wording
- No trick questions or wordplay
- Distractors based on common misconceptions
- Time-appropriate (30-60 seconds per question)

OUTPUT 5-7 QUESTIONS per learning objective.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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

    const { learning_objective_id, learning_objective_text, content_context } = await req.json();

    if (!learning_objective_id && !learning_objective_text) {
      throw new Error("Either learning_objective_id or learning_objective_text is required");
    }

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

    userPrompt += `

Generate 5-7 questions that effectively test whether a student has achieved this learning objective.
Include a mix of:
- 3-4 multiple choice questions at different difficulty levels
- 1-2 short answer questions requiring explanation
- At least 1 application/scenario question

For each multiple choice question, provide exactly 4 options with one correct answer.
For short answer questions, include keywords that indicate correct understanding.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: QUESTION_GENERATION_PROMPT
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: QUESTION_GENERATION_SCHEMA.name,
            description: QUESTION_GENERATION_SCHEMA.description,
            parameters: QUESTION_GENERATION_SCHEMA.parameters
          }
        }],
        tool_choice: { 
          type: "function", 
          function: { name: QUESTION_GENERATION_SCHEMA.name } 
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received");

    // Extract questions from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response format");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const questions = parsed.questions || [];

    console.log(`Generated ${questions.length} questions`);

    // If learning_objective_id provided, save questions to database
    if (loId) {
      const questionsToInsert = questions.map((q: any) => ({
        learning_objective_id: loId,
        question_type: q.question_type,
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
      }));

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
    const serviceClient = createServiceClient();
    await trackAIUsage(
      serviceClient,
      user.id,
      "generate-assessment-questions",
      "google/gemini-2.5-flash",
      data.usage?.prompt_tokens,
      data.usage?.completion_tokens
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
