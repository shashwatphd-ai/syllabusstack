import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { generateText, MODELS, parseJsonResponse } from "../_shared/unified-ai-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";
import { checkRateLimit, getUserLimits, createRateLimitResponse } from "../_shared/rate-limiter.ts";

// Duration matrix: Bloom level x Specificity (in minutes)
const DURATION_MATRIX: Record<string, Record<string, number>> = {
  remember: { introductory: 5, intermediate: 8, advanced: 12 },
  understand: { introductory: 8, intermediate: 12, advanced: 18 },
  apply: { introductory: 12, intermediate: 18, advanced: 25 },
  analyze: { introductory: 15, intermediate: 22, advanced: 30 },
  evaluate: { introductory: 18, intermediate: 25, advanced: 35 },
  create: { introductory: 20, intermediate: 30, advanced: 40 },
};

interface LearningObjective {
  text: string;
  core_concept: string;
  action_verb: string;
  bloom_level: string;
  domain: string;
  specificity: string;
  search_keywords: string[];
  expected_duration_minutes: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Rate limit check
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const limits = await getUserLimits(serviceClient, user.id);
    const rateLimitResult = await checkRateLimit(serviceClient, user.id, 'extract-learning-objectives', limits);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const { syllabus_text, course_id, module_id } = await req.json();

    // course_id here refers to instructor_course_id
    const instructorCourseId = course_id;

    if (!syllabus_text) {
      throw new Error("syllabus_text is required");
    }

    console.log("Extracting learning objectives from syllabus...");

    // Auto-create or find default module if none specified but course exists
    let targetModuleId = module_id;
    if (!targetModuleId && instructorCourseId) {
      console.log("No module specified, checking for default module...");

      // Check if default "Syllabus Objectives" module exists
      const { data: existingModule } = await supabaseClient
        .from("modules")
        .select("id")
        .eq("instructor_course_id", instructorCourseId)
        .eq("title", "Syllabus Objectives")
        .maybeSingle();

      if (existingModule) {
        targetModuleId = existingModule.id;
        console.log("Using existing default module:", targetModuleId);
      } else {
        // Create default module for syllabus-extracted objectives
        const { data: newModule, error: moduleError } = await supabaseClient
          .from("modules")
          .insert({
            instructor_course_id: instructorCourseId,
            title: "Syllabus Objectives",
            description: "Learning objectives extracted from the course syllabus",
            sequence_order: 0,
          })
          .select()
          .single();

        if (moduleError) {
          console.error("Error creating default module:", moduleError);
          // Continue without module - LOs will be created but not visible to students
        } else {
          targetModuleId = newModule.id;
          console.log("Created default module:", targetModuleId);
        }
      }
    }

    const systemPrompt = `You are an expert educational analyst specializing in learning objective extraction and Bloom's Taxonomy classification.

Your task is to extract learning objectives from course syllabi and classify them according to:
1. Bloom's Taxonomy level (remember, understand, apply, analyze, evaluate, create)
2. Domain (business, science, humanities, technical, arts, other)
3. Specificity (introductory, intermediate, advanced)

For each learning objective, identify:
- The core concept in 2-4 words
- The action verb (Bloom's taxonomy verb)
- 3 search keywords that would find relevant educational content

Return ONLY valid JSON array, no markdown formatting.`;

    const userPrompt = `Analyze this syllabus and extract all learning objectives:

${syllabus_text}

IMPORTANT: Only extract learning objectives that are EXPLICITLY stated in the syllabus.
Look for phrases like:
- "Students will be able to..."
- "By the end of this course..."
- "Learning outcomes:"
- "Objectives:"
- Numbered lists under "Goals" or "Outcomes" sections

DO NOT invent, infer, or create learning objectives. Only extract what is explicitly written.

Return a JSON object with this exact structure:
{
  "learning_objectives": [
    {
      "text": "Full text of the learning objective",
      "core_concept": "Main topic in 2-4 words",
      "action_verb": "The Bloom's taxonomy verb (e.g., analyze, apply, evaluate)",
      "bloom_level": "remember|understand|apply|analyze|evaluate|create",
      "domain": "business|science|humanities|technical|arts|other",
      "specificity": "introductory|intermediate|advanced",
      "search_keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ],
  "explicit_objectives_found": true or false,
  "potential_sections": ["Section names that might contain implicit LOs if none were found"],
  "recommendation": "Message if no explicit LOs found"
}

If NO explicit learning objectives are found:
1. Return an EMPTY array for learning_objectives
2. Set explicit_objectives_found to false
3. List section titles that might contain objectives in potential_sections
4. Provide a helpful recommendation message

Extract at most 15 learning objectives if explicit ones are found.`;

    // Call AI via OpenRouter (unified-ai-client)
    const result = await generateText({
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      model: MODELS.GEMINI_FLASH,
      logPrefix: '[extract-learning-objectives]'
    });

    if (!result.content) {
      throw new Error("No content returned from AI");
    }

    // Parse the JSON response - now expecting structured object
    interface ExtractionResponse {
      learning_objectives: LearningObjective[];
      explicit_objectives_found: boolean;
      potential_sections?: string[];
      recommendation?: string;
    }

    let extractionResult: ExtractionResponse;
    try {
      const parsed = parseJsonResponse<ExtractionResponse | LearningObjective[]>(result.content);
      // Handle both old array format and new object format for backwards compatibility
      if (Array.isArray(parsed)) {
        extractionResult = {
          learning_objectives: parsed,
          explicit_objectives_found: parsed.length > 0,
        };
      } else {
        extractionResult = parsed;
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", result.content);
      throw new Error("Failed to parse learning objectives from AI response");
    }

    const learningObjectives = extractionResult.learning_objectives || [];

    // If no explicit LOs found, return early with warning (don't save hallucinated content)
    if (!extractionResult.explicit_objectives_found || learningObjectives.length === 0) {
      logInfo('extract-learning-objectives', 'no_explicit_los_found', {
        potential_sections: extractionResult.potential_sections,
        recommendation: extractionResult.recommendation
      });

      return createSuccessResponse({
        success: true,
        learning_objectives: [],
        count: 0,
        explicit_objectives_found: false,
        potential_sections: extractionResult.potential_sections || [],
        recommendation: extractionResult.recommendation ||
          'No explicit learning objectives found in the syllabus. Please add them manually or upload a more detailed syllabus.',
        warning: 'No explicit learning objectives were found. The system does not infer or create objectives to ensure accuracy.'
      }, corsHeaders);
    }

    // BATCHED APPROACH: Build all LOs and insert in one query (15x faster)
    const losData = learningObjectives.map(lo => {
      const bloomLevel = lo.bloom_level || "understand";
      const specificity = lo.specificity || "intermediate";
      const expectedDuration = DURATION_MATRIX[bloomLevel]?.[specificity] || 15;

      return {
        user_id: user.id,
        instructor_course_id: instructorCourseId || null,
        module_id: targetModuleId || null,
        text: lo.text,
        core_concept: lo.core_concept,
        action_verb: lo.action_verb,
        bloom_level: bloomLevel,
        domain: lo.domain || "other",
        specificity: specificity,
        search_keywords: lo.search_keywords || [],
        expected_duration_minutes: expectedDuration,
        verification_state: "unstarted",
      };
    });

    const { data: savedLOs, error: saveError } = await supabaseClient
      .from("learning_objectives")
      .insert(losData)
      .select();

    if (saveError) {
      console.error("Error batch saving learning objectives:", saveError);
    }

    logInfo('extract-learning-objectives', 'complete', { count: savedLOs?.length || 0 });

    return createSuccessResponse({
      success: true,
      learning_objectives: savedLOs || [],
      count: savedLOs?.length || 0,
      explicit_objectives_found: true,
    }, corsHeaders);
  } catch (error: unknown) {
    logError('extract-learning-objectives', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
