import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MASTER_SYSTEM_PROMPT, SYLLABUS_EXTRACTION_PROMPT } from "../_shared/prompts.ts";
import { trackAIUsage, createServiceClient } from "../_shared/ai-cache.ts";
import { SYLLABUS_EXTRACTION_SCHEMA, createToolDefinition, createToolChoice } from "../_shared/schemas.ts";
import { updateCourseKeywords } from "../_shared/similarity.ts";
import { generateKeywordVector } from "../_shared/ai-orchestrator.ts";
import { checkRateLimit, getUserLimits, createRateLimitResponse } from "../_shared/rate-limiter.ts";
import { createErrorResponse, handleAIGatewayError, createSuccessResponse, logInfo, logError } from "../_shared/error-handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { syllabusText, courseId } = await req.json();
    
    if (!syllabusText) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Syllabus text is required');
    }

    // Get user for rate limiting
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let supabase: any = null;

    if (authHeader) {
      supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!userError && user) {
        userId = user.id;

        // Check rate limits
        const serviceClient = createServiceClient();
        const limits = await getUserLimits(serviceClient, userId);
        const rateLimitResult = await checkRateLimit(serviceClient, userId, 'analyze-syllabus', limits);
        
        if (!rateLimitResult.allowed) {
          return createRateLimitResponse(rateLimitResult, corsHeaders);
        }

        logInfo('analyze-syllabus', 'rate_limit_check', { 
          userId, 
          remaining: rateLimitResult.remaining 
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return createErrorResponse('SERVICE_UNAVAILABLE', corsHeaders, 'AI service not configured');
    }

    logInfo('analyze-syllabus', 'processing', { courseId });

    const systemPrompt = `${MASTER_SYSTEM_PROMPT}

${SYLLABUS_EXTRACTION_PROMPT}`;

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
            content: systemPrompt
          },
          {
            role: "user",
            content: `Analyze this course syllabus and extract ALL marketable capabilities a student would develop.

SYLLABUS CONTENT:
${syllabusText}

EXTRACTION REQUIREMENTS:
1. Extract 5-15 distinct, marketable capabilities
2. Use the "Can do X" format for each capability name
3. Be specific - use industry terminology
4. Include both technical and soft skills
5. Consider what employers would actually value

For each capability, provide:
- name: Specific skill using "Can do X" format
- category: technical, analytical, communication, leadership, creative, research, or interpersonal
- proficiency_level: beginner, intermediate, advanced, or expert
- evidence_type: How a student could demonstrate this skill`
          }
        ],
        tools: [createToolDefinition(SYLLABUS_EXTRACTION_SCHEMA)],
        tool_choice: createToolChoice(SYLLABUS_EXTRACTION_SCHEMA)
      }),
    });

    // Handle AI gateway errors
    const gatewayError = handleAIGatewayError(response, corsHeaders);
    if (gatewayError) {
      logError('analyze-syllabus', new Error(`AI gateway error: ${response.status}`));
      return gatewayError;
    }

    const data = await response.json();
    logInfo('analyze-syllabus', 'ai_response_received', { hasToolCall: !!data.choices?.[0]?.message?.tool_calls });

    // Extract capabilities from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return createErrorResponse('AI_GATEWAY_ERROR', corsHeaders, 'Invalid AI response format');
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const capabilities = parsed.capabilities || [];
    const courseThemes = parsed.course_themes || [];
    const toolsLearned = parsed.tools_learned || [];

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

          await supabase
            .from("courses")
            .update({
              capability_text: capabilityText,
              key_capabilities: capabilities,
              evidence_types: evidenceTypes,
              tools_methods: toolsLearned,
              capability_keywords: allKeywords, // Store extracted keywords
              ai_model_used: "google/gemini-2.5-flash"
            })
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
            "google/gemini-2.5-flash",
            data.usage?.prompt_tokens,
            data.usage?.completion_tokens
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        capabilities,
        course_themes: courseThemes,
        tools_learned: toolsLearned
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-syllabus:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
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
