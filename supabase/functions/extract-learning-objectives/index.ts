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
  // NEW: Source tracking for transparency
  source_type?: 'explicit' | 'inferred_from_topics' | 'inferred_from_assignments' | 'inferred_from_readings';
  source_text?: string;  // The syllabus text this was derived from
  confidence?: 'high' | 'medium' | 'low';
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

Your task is to INTELLIGENTLY extract learning objectives from course syllabi by:
1. Finding EXPLICIT learning objectives (clearly stated "Students will be able to...")
2. INFERRING implicit learning objectives from course content (topics, assignments, readings)

For EVERY learning objective, you MUST classify:
- Bloom's Taxonomy level (remember, understand, apply, analyze, evaluate, create)
- Domain (business, science, humanities, technical, arts, other)
- Specificity (introductory, intermediate, advanced)
- SOURCE TYPE (explicit, inferred_from_topics, inferred_from_assignments, inferred_from_readings)
- SOURCE TEXT (the actual syllabus text that this objective comes from)
- CONFIDENCE (high, medium, low)

Return ONLY valid JSON, no markdown formatting.`;

    const userPrompt = `Analyze this syllabus and extract ALL learning objectives - both explicit and inferred:

${syllabus_text}

EXTRACTION STRATEGY:

1. EXPLICIT OBJECTIVES (source_type: "explicit", confidence: "high")
   Look for clearly stated objectives:
   - "Students will be able to..."
   - "By the end of this course, learners will..."
   - "Learning Outcomes:" or "Objectives:" sections
   - Numbered lists under "Goals"

2. INFERRED FROM TOPICS (source_type: "inferred_from_topics", confidence: "medium")
   For each topic/week in the schedule, infer what students should learn:
   - "Week 3: Supply and Demand" → "Understand the principles of supply and demand and their effect on market prices"
   - "Module 2: Regression Analysis" → "Apply regression analysis techniques to predict outcomes"

3. INFERRED FROM ASSIGNMENTS (source_type: "inferred_from_assignments", confidence: "medium")
   Derive objectives from what students must DO:
   - "Midterm: Case study analysis" → "Analyze real-world case studies using course frameworks"
   - "Project: Build a web application" → "Create a functional web application using [technology]"

4. INFERRED FROM READINGS (source_type: "inferred_from_readings", confidence: "low")
   Derive objectives from required readings:
   - "Required: Chapter 5 - Neural Networks" → "Understand the architecture and function of neural networks"

CRITICAL RULES:
- Every inferred objective MUST include source_text showing the EXACT syllabus text it came from
- Use appropriate Bloom's verbs: topics → "understand/explain", assignments → "apply/analyze/create"
- Confidence: explicit=high, topics/assignments=medium, readings=low
- Maximum 20 total objectives (prioritize explicit, then assignments, then topics)

Return JSON in this exact structure:
{
  "explicit_objectives": [
    {
      "text": "The learning objective text",
      "core_concept": "Main topic in 2-4 words",
      "action_verb": "Bloom's taxonomy verb",
      "bloom_level": "understand",
      "domain": "business",
      "specificity": "intermediate",
      "search_keywords": ["keyword1", "keyword2", "keyword3"],
      "source_type": "explicit",
      "source_text": "The exact syllabus text this came from",
      "confidence": "high"
    }
  ],
  "inferred_objectives": [
    {
      "text": "Inferred learning objective",
      "core_concept": "Main topic",
      "action_verb": "apply",
      "bloom_level": "apply",
      "domain": "technical",
      "specificity": "intermediate",
      "search_keywords": ["keyword1", "keyword2"],
      "source_type": "inferred_from_assignments",
      "source_text": "Midterm Project: Build a REST API",
      "confidence": "medium"
    }
  ],
  "extraction_summary": {
    "explicit_count": 5,
    "inferred_count": 8,
    "topics_found": ["Week 1: Intro", "Week 2: Basics"],
    "assignments_found": ["Midterm", "Final Project"],
    "readings_found": ["Chapter 1-5"]
  }
}`;

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

    // Parse the JSON response - now expecting structured object with explicit + inferred
    interface SmartExtractionResponse {
      explicit_objectives: LearningObjective[];
      inferred_objectives: LearningObjective[];
      extraction_summary: {
        explicit_count: number;
        inferred_count: number;
        topics_found: string[];
        assignments_found: string[];
        readings_found: string[];
      };
    }

    // Legacy format for backwards compatibility
    interface LegacyExtractionResponse {
      learning_objectives: LearningObjective[];
      explicit_objectives_found?: boolean;
    }

    let explicitObjectives: LearningObjective[] = [];
    let inferredObjectives: LearningObjective[] = [];
    let extractionSummary: SmartExtractionResponse['extraction_summary'] | null = null;

    try {
      const parsed = parseJsonResponse<SmartExtractionResponse | LegacyExtractionResponse | LearningObjective[]>(result.content);

      if (Array.isArray(parsed)) {
        // Old array format - treat all as explicit
        explicitObjectives = parsed.map(lo => ({ ...lo, source_type: 'explicit' as const, confidence: 'high' as const }));
      } else if ('explicit_objectives' in parsed) {
        // New smart format
        explicitObjectives = (parsed.explicit_objectives || []).map(lo => ({
          ...lo,
          source_type: lo.source_type || 'explicit',
          confidence: lo.confidence || 'high'
        }));
        inferredObjectives = (parsed.inferred_objectives || []).map(lo => ({
          ...lo,
          source_type: lo.source_type || 'inferred_from_topics',
          confidence: lo.confidence || 'medium'
        }));
        extractionSummary = parsed.extraction_summary;
      } else if ('learning_objectives' in parsed) {
        // Legacy object format
        explicitObjectives = (parsed.learning_objectives || []).map(lo => ({
          ...lo,
          source_type: 'explicit' as const,
          confidence: 'high' as const
        }));
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", result.content);
      throw new Error("Failed to parse learning objectives from AI response");
    }

    const totalObjectives = explicitObjectives.length + inferredObjectives.length;

    logInfo('extract-learning-objectives', 'extraction_complete', {
      explicit_count: explicitObjectives.length,
      inferred_count: inferredObjectives.length,
      total: totalObjectives
    });

    // If absolutely nothing found, provide guidance
    if (totalObjectives === 0) {
      return createSuccessResponse({
        success: true,
        explicit_objectives: [],
        inferred_objectives: [],
        count: 0,
        recommendation: 'No learning objectives could be extracted. The syllabus may be too brief or lacks course content details. Please add objectives manually.',
      }, corsHeaders);
    }

    // Helper to build LO data for database (core fields that always exist)
    const buildCoreLoData = (lo: LearningObjective) => {
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
    };

    // New fields for source tracking (added by migration 20260203100000)
    const buildSourceFields = (lo: LearningObjective, isAutoApproved: boolean) => ({
      source_type: lo.source_type || 'explicit',
      source_text: lo.source_text || null,
      confidence: lo.confidence || 'high',
      approval_status: isAutoApproved ? 'approved' : 'pending_review',
    });

    // Try insert with new fields, fallback to core fields if migration hasn't run
    const insertLOs = async (los: LearningObjective[], isAutoApproved: boolean) => {
      if (los.length === 0) return [];

      // First try with all fields (including new source tracking columns)
      const fullData = los.map(lo => ({
        ...buildCoreLoData(lo),
        ...buildSourceFields(lo, isAutoApproved),
      }));

      const { data, error } = await supabaseClient
        .from("learning_objectives")
        .insert(fullData)
        .select();

      if (!error) {
        return data || [];
      }

      // If error mentions unknown column, retry without new fields (migration not yet run)
      if (error.message?.includes('column') || error.code === '42703') {
        console.warn('[extract-learning-objectives] New columns not available, using core fields only');
        const coreData = los.map(lo => buildCoreLoData(lo));
        const { data: fallbackData, error: fallbackError } = await supabaseClient
          .from("learning_objectives")
          .insert(coreData)
          .select();

        if (fallbackError) {
          console.error("Error saving learning objectives (fallback):", fallbackError);
          return [];
        }

        // Add source metadata to returned objects for response (even if not in DB)
        return (fallbackData || []).map((savedLo, idx) => ({
          ...savedLo,
          ...buildSourceFields(los[idx], isAutoApproved),
        }));
      }

      console.error("Error saving learning objectives:", error);
      return [];
    };

    // SAVE EXPLICIT OBJECTIVES (auto-approved)
    const savedExplicitLOs = await insertLOs(explicitObjectives, true);

    // SAVE INFERRED OBJECTIVES (pending review - instructor must approve)
    const savedInferredLOs = await insertLOs(inferredObjectives, false);

    const totalSaved = savedExplicitLOs.length + savedInferredLOs.length;
    logInfo('extract-learning-objectives', 'complete', {
      explicit_saved: savedExplicitLOs.length,
      inferred_saved: savedInferredLOs.length,
      total: totalSaved
    });

    return createSuccessResponse({
      success: true,
      // Separate explicit and inferred for frontend to handle differently
      explicit_objectives: savedExplicitLOs,
      inferred_objectives: savedInferredLOs,
      // Combined for backwards compatibility
      learning_objectives: [...savedExplicitLOs, ...savedInferredLOs],
      count: totalSaved,
      extraction_summary: extractionSummary || {
        explicit_count: savedExplicitLOs.length,
        inferred_count: savedInferredLOs.length,
        topics_found: [],
        assignments_found: [],
        readings_found: []
      },
      // Guidance for the user
      review_required: savedInferredLOs.length > 0,
      review_message: savedInferredLOs.length > 0
        ? `Found ${savedExplicitLOs.length} explicit and ${savedInferredLOs.length} inferred learning objectives. Please review the inferred objectives to ensure they match your course intent.`
        : null,
    }, corsHeaders);
  } catch (error: unknown) {
    logError('extract-learning-objectives', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
