import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { MASTER_SYSTEM_PROMPT, SYLLABUS_EXTRACTION_PROMPT } from "../_shared/prompts.ts";
import { trackAIUsage, createServiceClient } from "../_shared/ai-cache.ts";
import { SYLLABUS_EXTRACTION_SCHEMA } from "../_shared/schemas.ts";
import { updateCourseKeywords } from "../_shared/similarity.ts";
import { generateKeywordVector } from "../_shared/ai-orchestrator.ts";
import { checkRateLimit, getUserLimits, createRateLimitResponse } from "../_shared/rate-limiter.ts";
import { createErrorResponse, handleAIGatewayError, createSuccessResponse, logInfo, logError } from "../_shared/error-handler.ts";
import { generateStructured, MODELS } from "../_shared/unified-ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Store these at function level for access in catch block
  let parsedCourseId: string | undefined;
  let supabaseClient: any = null;
  const authHeader = req.headers.get("Authorization");

  try {
    const { syllabusText, courseId } = await req.json();
    parsedCourseId = courseId;

    if (!syllabusText) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Syllabus text is required');
    }

    // Get user for rate limiting
    let userId: string | null = null;
    let supabase: any = null;

    if (authHeader) {
      supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      supabaseClient = supabase; // Store for catch block access
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!userError && user) {
        userId = user.id;

        // Check rate limits
        const serviceClient = createServiceClient();
        const limits = await getUserLimits(serviceClient, user.id);
        const rateLimitResult = await checkRateLimit(serviceClient, user.id, 'analyze-syllabus', limits);
        
        if (!rateLimitResult.allowed) {
          return createRateLimitResponse(rateLimitResult, corsHeaders);
        }

        logInfo('analyze-syllabus', 'rate_limit_check', { 
          userId, 
          remaining: rateLimitResult.remaining 
        });
      }
    }

    logInfo('analyze-syllabus', 'processing', { courseId });

    // Set analysis status to 'analyzing' if we have a courseId and supabase client
    if (courseId && supabase) {
      await supabase
        .from("courses")
        .update({ analysis_status: "analyzing", analysis_error: null })
        .eq("id", courseId);
    }

    const systemPrompt = `${MASTER_SYSTEM_PROMPT}

${SYLLABUS_EXTRACTION_PROMPT}`;

    const userContent = `Analyze this course syllabus and extract course information and marketable capabilities.

SYLLABUS CONTENT:
${syllabusText}

EXTRACTION REQUIREMENTS:

1. COURSE METADATA (extract these FIRST):
   - course_title: The OFFICIAL course name (e.g., "Introduction to Machine Learning", "Strategic Management").
     NOT random sentences, instructions, or book text.
   - course_code: Academic code in format like "CS 101", "MGT 471", "ENT 315" (2-4 letters + 3-4 digits).
     NOT ISBN numbers, book codes, or phone numbers.
   - semester: If mentioned (e.g., "Fall 2024", "Spring 2023")
   - credits: Credit hours if mentioned (typically 1-4)

2. CAPABILITIES (5-15 distinct skills):
   - Use "Can do X" format for each capability name
   - Be specific with industry terminology
   - Include both technical AND soft skills
   - Consider what employers would value

For each capability, provide:
- name: Specific skill using "Can do X" format
- category: technical, analytical, communication, leadership, creative, research, or interpersonal
- proficiency_level: beginner, intermediate, advanced, or expert
- evidence_type: How a student could demonstrate this skill

IMPORTANT:
- course_title should be the OFFICIAL name, not random text from the document
- If you can't find a clear title, use the course code + main topic

Return your response using the extract_syllabus_data function.`;

    // Use unified AI client for structured extraction
    const result = await generateStructured<{
      capabilities: any[];
      course_themes: string[];
      tools_learned: string[];
      course_title: string | null;
      course_code: string | null;
      semester: string | null;
      credits: number | null;
    }>({
      prompt: userContent,
      systemPrompt: systemPrompt,
      schema: SYLLABUS_EXTRACTION_SCHEMA,
      model: MODELS.FAST,
      fallbacks: [MODELS.GEMINI_FLASH],
      logPrefix: '[analyze-syllabus]'
    });
    const parsed = result.data;

    logInfo('analyze-syllabus', 'ai_response_received', { hasCapabilities: !!parsed.capabilities?.length });

    const capabilities = parsed.capabilities || [];
    const courseThemes = parsed.course_themes || [];
    const toolsLearned = parsed.tools_learned || [];
    
    // NEW: Extract course metadata
    const courseTitle = parsed.course_title || null;
    const courseCode = parsed.course_code || null;
    const semester = parsed.semester || null;
    const credits = parsed.credits || null;

    // If courseId provided, save capabilities to database
    if (courseId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { global: { headers: { Authorization: authHeader } } }
        );

        // Get user from auth
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error("Auth error:", userError);
        } else if (user) {
          // Update course with AI-generated fields
          const capabilityText = capabilities.map((c: any) => c.name).join("; ");
          const evidenceTypes = capabilities
            .filter((c: any) => c.evidence_type)
            .map((c: any) => ({ capability: c.name, evidence: c.evidence_type }));

          // Generate keywords from capabilities and tools
          const capabilityKeywords = generateKeywordVector(capabilityText);
          const toolKeywords = toolsLearned.flatMap((t: string) => generateKeywordVector(t));
          const themeKeywords = courseThemes.flatMap((t: string) => generateKeywordVector(t));
          const allKeywords = [...new Set([...capabilityKeywords, ...toolKeywords, ...themeKeywords])];

          // Fetch current course to check if metadata fields need updating
          const { data: existingCourse } = await supabase
            .from("courses")
            .select("title, code, semester, credits")
            .eq("id", courseId)
            .single();

          // Build update object with all AI fields
          const updateData: Record<string, any> = {
            capability_text: capabilityText,
            key_capabilities: capabilities,
            evidence_types: evidenceTypes,
            tools_methods: toolsLearned,
            capability_keywords: allKeywords,
            ai_model_used: "openrouter/gpt-4o-mini",
            analysis_status: "completed",
            analysis_error: null
          };

          // Also update course metadata if AI extracted it and current values are empty/generic
          if (courseTitle && existingCourse) {
            const currentTitle = existingCourse.title?.toLowerCase() || "";
            // Update title if it's generic (like "Syllabus", "Untitled", or matches filename pattern)
            if (!currentTitle || currentTitle === "syllabus" || currentTitle === "untitled" || currentTitle === "untitled course") {
              updateData.title = courseTitle;
            }
          }
          if (courseCode && existingCourse && !existingCourse.code) {
            updateData.code = courseCode;
          }
          if (semester && existingCourse && !existingCourse.semester) {
            updateData.semester = semester;
          }
          if (credits && existingCourse && !existingCourse.credits) {
            updateData.credits = credits;
          }

          await supabase
            .from("courses")
            .update(updateData)
            .eq("id", courseId);

          console.log(`Updated course ${courseId} with ${allKeywords.length} keywords`);

          // Insert capabilities
          const capabilitiesToInsert = capabilities.map((cap: any) => ({
            user_id: user.id,
            course_id: courseId,
            name: cap.name,
            category: cap.category,
            proficiency_level: cap.proficiency_level,
            source: "course"
          }));

          const { error: insertError } = await supabase
            .from("capabilities")
            .insert(capabilitiesToInsert);

          if (insertError) {
            console.error("Error inserting capabilities:", insertError);
          } else {
            console.log(`Inserted ${capabilities.length} capabilities for course ${courseId}`);
          }

          // Update capability profile
          await updateCapabilityProfile(supabase, user.id);

          // Track AI usage
          const serviceClient = createServiceClient();
          await trackAIUsage(
            serviceClient,
            user.id,
            "analyze-syllabus",
            "openrouter/gpt-4o-mini"
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        capabilities,
        course_themes: courseThemes,
        tools_learned: toolsLearned,
        course_title: courseTitle,
        course_code: courseCode,
        semester: semester,
        credits: credits
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-syllabus:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Set the course status to failed if we have the context
    if (parsedCourseId && supabaseClient) {
      try {
        await supabaseClient
          .from("courses")
          .update({
            analysis_status: "failed",
            analysis_error: errorMessage
          })
          .eq("id", parsedCourseId);
      } catch (updateError) {
        console.error("Failed to update course status to failed:", updateError);
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to update aggregated capability profile
async function updateCapabilityProfile(supabase: any, userId: string) {
  try {
    // Get all user capabilities
    const { data: capabilities } = await supabase
      .from("capabilities")
      .select("name, category, proficiency_level")
      .eq("user_id", userId);

    if (!capabilities || capabilities.length === 0) return;

    // Group by theme/category
    const byTheme: Record<string, string[]> = {};
    capabilities.forEach((cap: any) => {
      if (!byTheme[cap.category]) {
        byTheme[cap.category] = [];
      }
      byTheme[cap.category].push(cap.name);
    });

    // Count courses
    const { count: courseCount } = await supabase
      .from("courses")
      .select("id", { count: "exact" })
      .eq("user_id", userId);

    // Combine all capabilities into text
    const combinedText = capabilities.map((c: any) => c.name).join("; ");

    // Upsert capability profile
    await supabase
      .from("capability_profiles")
      .upsert({
        user_id: userId,
        combined_capability_text: combinedText,
        capabilities_by_theme: byTheme,
        course_count: courseCount || 0,
        last_updated: new Date().toISOString()
      }, { onConflict: "user_id" });

    console.log("Updated capability profile for user:", userId);
  } catch (e) {
    console.error("Error updating capability profile:", e);
  }
}
