import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { MASTER_SYSTEM_PROMPT, JOB_REQUIREMENTS_PROMPT, createJobRequirementsCacheKey } from "../_shared/prompts.ts";
import { getCachedResponse, setCachedResponse, trackAIUsage, createServiceClient, CACHE_TTL } from "../_shared/ai-cache.ts";
import { JOB_REQUIREMENTS_SCHEMA, createToolDefinition, createToolChoice } from "../_shared/schemas.ts";
import { generateKeywordVector } from "../_shared/ai-orchestrator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Cloud API configuration
const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobTitle, companyType, location, dreamJobId } = await req.json();
    
    if (!jobTitle) {
      return new Response(
        JSON.stringify({ error: "Job title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GOOGLE_CLOUD_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");
    if (!GOOGLE_CLOUD_API_KEY) {
      throw new Error("GOOGLE_CLOUD_API_KEY is not configured");
    }

    console.log("Analyzing dream job:", jobTitle);

    // Check cache first
    const serviceClient = createServiceClient();
    const cacheKey = createJobRequirementsCacheKey(jobTitle, companyType);
    const cachedData = await getCachedResponse(serviceClient, cacheKey);

    let requirements, description, salaryRange, dayOneCapabilities, differentiators, commonMisconceptions, realisticBar;
    let requirementsKeywords: string[] = [];

    if (cachedData) {
      console.log("Using cached job requirements");
      requirements = cachedData.requirements;
      description = cachedData.description;
      salaryRange = cachedData.salary_range;
      dayOneCapabilities = cachedData.day_one_capabilities;
      differentiators = cachedData.differentiators;
      commonMisconceptions = cachedData.common_misconceptions;
      realisticBar = cachedData.realistic_bar;
      requirementsKeywords = cachedData.requirements_keywords || [];
    } else {
      // Check job_requirements_cache table for common queries
      const normalizedQuery = jobTitle.toLowerCase().trim();
      const { data: tableCache } = await serviceClient
        .from("job_requirements_cache")
        .select("*")
        .eq("job_query_normalized", normalizedQuery)
        .single();

      if (tableCache) {
        console.log("Using job_requirements_cache table");
        // Update query count
        await serviceClient
          .from("job_requirements_cache")
          .update({ 
            query_count: (tableCache.query_count || 1) + 1, 
            last_queried_at: new Date().toISOString() 
          })
          .eq("id", tableCache.id);

        requirements = [];
        description = tableCache.requirements_text;
        salaryRange = null;
        dayOneCapabilities = tableCache.day_one_capabilities;
        differentiators = tableCache.differentiators;
        commonMisconceptions = tableCache.common_misconceptions;
        realisticBar = tableCache.realistic_bar;
        requirementsKeywords = tableCache.keywords || [];
      } else {
        // No cache - call AI
        const systemPrompt = `${MASTER_SYSTEM_PROMPT}

${JOB_REQUIREMENTS_PROMPT}`;

        const userContent = `Analyze this dream job and provide REALISTIC requirements that employers actually look for:

JOB TITLE: ${jobTitle}
${companyType ? `COMPANY TYPE: ${companyType}` : ""}
${location ? `LOCATION: ${location}` : ""}

Provide a comprehensive analysis including:
1. All requirements categorized by importance (critical, important, nice_to_have)
2. Day-one capabilities - what must they do on their FIRST DAY
3. Differentiators - what sets top candidates apart
4. Common misconceptions - what students think matters but doesn't
5. Realistic bar - the minimum viable candidate profile

Be specific to this role and company type. Use real industry knowledge.

Return your response using the generate_job_requirements function.`;

        const url = `${GOOGLE_API_BASE}/models/gemini-2.5-flash:generateContent?key=${GOOGLE_CLOUD_API_KEY}`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: userContent }] }
            ],
            systemInstruction: {
              parts: [{ text: systemPrompt }]
            },
            tools: [{
              functionDeclarations: [JOB_REQUIREMENTS_SCHEMA]
            }],
            toolConfig: {
              functionCallingConfig: {
                mode: "ANY",
                allowedFunctionNames: [JOB_REQUIREMENTS_SCHEMA.name]
              }
            }
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Google Cloud API error:", response.status, errorText);

          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (response.status === 403) {
            // Google Cloud returns 403 for billing/quota issues
            return new Response(
              JSON.stringify({ error: "API quota exceeded or billing issue. Please check your Google Cloud account." }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw new Error(`Google Cloud API error: ${response.status}`);
        }

        const data = await response.json();
        console.log("AI response received");

        const functionCall = data.candidates?.[0]?.content?.parts?.[0]?.functionCall;
        if (!functionCall?.args) {
          throw new Error("Invalid AI response format");
        }
        const parsed = functionCall.args;

        requirements = parsed.requirements || [];
        description = parsed.description || null;
        salaryRange = parsed.salary_range || null;
        dayOneCapabilities = parsed.day_one_capabilities || [];
        differentiators = parsed.differentiators || [];
        commonMisconceptions = parsed.common_misconceptions || [];
        realisticBar = parsed.realistic_bar || null;

        // Generate keywords from all job-related text for similarity matching
        const titleKeywords = generateKeywordVector(jobTitle);
        const descKeywords = description ? generateKeywordVector(description) : [];
        const reqKeywords = requirements.flatMap((r: any) => 
          generateKeywordVector(`${r.skill_name} ${r.category || ''}`)
        );
        const dayOneKeywords = dayOneCapabilities.flatMap((d: any) => 
          generateKeywordVector(d.requirement || d)
        );
        const diffKeywords = differentiators.flatMap((d: any) => 
          generateKeywordVector(d.skill || d)
        );
        
        requirementsKeywords = [...new Set([
          ...titleKeywords,
          ...descKeywords,
          ...reqKeywords,
          ...dayOneKeywords,
          ...diffKeywords
        ])];

        console.log(`Generated ${requirementsKeywords.length} keywords for job: ${jobTitle}`);

        // Save to job_requirements_cache table for future queries
        await serviceClient.from("job_requirements_cache").upsert({
          job_query_normalized: normalizedQuery,
          requirements_text: description || `Requirements for ${jobTitle}`,
          day_one_capabilities: dayOneCapabilities,
          differentiators: differentiators,
          common_misconceptions: commonMisconceptions,
          realistic_bar: realisticBar,
          keywords: requirementsKeywords, // Store keywords for similarity matching
          query_count: 1,
          last_queried_at: new Date().toISOString()
        }, { onConflict: "job_query_normalized" });

        // Also cache in ai_cache for faster lookups
        await setCachedResponse(
          serviceClient,
          cacheKey,
          "job_requirements",
          {
            requirements,
            description,
            salary_range: salaryRange,
            day_one_capabilities: dayOneCapabilities,
            differentiators,
            common_misconceptions: commonMisconceptions,
            realistic_bar: realisticBar,
            requirements_keywords: requirementsKeywords
          },
          "google/gemini-2.5-flash",
          CACHE_TTL.job_requirements
        );
      }
    }

    // If dreamJobId provided, save requirements to database
    if (dreamJobId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();

        // Update dream job with all new fields including keywords
        const { error: updateError } = await supabase
          .from("dream_jobs")
          .update({ 
            description: description,
            salary_range: salaryRange,
            day_one_capabilities: dayOneCapabilities,
            differentiators: differentiators,
            common_misconceptions: commonMisconceptions,
            realistic_bar: realisticBar,
            requirements_keywords: requirementsKeywords // Store for gap analysis
          })
          .eq("id", dreamJobId);

        if (updateError) {
          console.error("Error updating dream job:", updateError);
        } else {
          console.log(`Updated dream job ${dreamJobId} with ${requirementsKeywords.length} keywords`);
        }

        // Delete existing requirements
        await supabase
          .from("job_requirements")
          .delete()
          .eq("dream_job_id", dreamJobId);

        // Insert new requirements
        const requirementsToInsert = requirements.map((req: any) => ({
          dream_job_id: dreamJobId,
          skill_name: req.skill_name,
          importance: req.importance,
          category: req.category
        }));

        const { error: insertError } = await supabase
          .from("job_requirements")
          .insert(requirementsToInsert);

        if (insertError) {
          console.error("Error inserting requirements:", insertError);
        } else {
          console.log(`Inserted ${requirements.length} requirements for job ${dreamJobId}`);
        }

        // Track AI usage if we made a new AI call
        if (!cachedData && user) {
          await trackAIUsage(
            serviceClient,
            user.id,
            "analyze-dream-job",
            "google/gemini-2.5-flash"
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        requirements, 
        description, 
        salary_range: salaryRange,
        day_one_capabilities: dayOneCapabilities,
        differentiators,
        common_misconceptions: commonMisconceptions,
        realistic_bar: realisticBar,
        keywords_count: requirementsKeywords.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-dream-job:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
