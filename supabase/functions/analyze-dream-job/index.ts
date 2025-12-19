import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MASTER_SYSTEM_PROMPT, JOB_REQUIREMENTS_PROMPT, createJobRequirementsCacheKey } from "../_shared/prompts.ts";
import { getCachedResponse, setCachedResponse, trackAIUsage, createServiceClient, CACHE_TTL } from "../_shared/ai-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing dream job:", jobTitle);

    // Check cache first
    const serviceClient = createServiceClient();
    const cacheKey = createJobRequirementsCacheKey(jobTitle, companyType);
    const cachedData = await getCachedResponse(serviceClient, cacheKey);

    let requirements, description, salaryRange, dayOneCapabilities, differentiators, commonMisconceptions, realisticBar;

    if (cachedData) {
      console.log("Using cached job requirements");
      requirements = cachedData.requirements;
      description = cachedData.description;
      salaryRange = cachedData.salary_range;
      dayOneCapabilities = cachedData.day_one_capabilities;
      differentiators = cachedData.differentiators;
      commonMisconceptions = cachedData.common_misconceptions;
      realisticBar = cachedData.realistic_bar;
    } else {
      // No cache - call AI
      const systemPrompt = `${MASTER_SYSTEM_PROMPT}

${JOB_REQUIREMENTS_PROMPT}`;

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
              content: `Analyze this dream job and provide REALISTIC requirements that employers actually look for:

JOB TITLE: ${jobTitle}
${companyType ? `COMPANY TYPE: ${companyType}` : ""}
${location ? `LOCATION: ${location}` : ""}

Provide a comprehensive analysis including:
1. All requirements categorized by importance (critical, important, nice_to_have)
2. Day-one capabilities - what must they do on their FIRST DAY
3. Differentiators - what sets top candidates apart
4. Common misconceptions - what students think matters but doesn't
5. Realistic bar - the minimum viable candidate profile

Be specific to this role and company type. Use real industry knowledge.`
            }
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_requirements",
                description: "Extract comprehensive job requirements",
                parameters: {
                  type: "object",
                  properties: {
                    requirements: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          skill_name: { type: "string", description: "The skill or requirement name" },
                          importance: { 
                            type: "string", 
                            enum: ["critical", "important", "nice_to_have"]
                          },
                          category: { 
                            type: "string", 
                            enum: ["technical", "analytical", "communication", "leadership", "creative", "research", "interpersonal", "certification", "education"]
                          }
                        },
                        required: ["skill_name", "importance", "category"]
                      }
                    },
                    description: { type: "string", description: "Brief description of this role" },
                    salary_range: { type: "string", description: "Typical salary range for this role" },
                    day_one_capabilities: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          requirement: { type: "string" },
                          importance: { type: "string", enum: ["critical", "important", "nice_to_have"] }
                        },
                        required: ["requirement", "importance"]
                      },
                      description: "What someone needs to be productive on day one"
                    },
                    differentiators: {
                      type: "array",
                      items: { type: "string" },
                      description: "What sets top candidates apart"
                    },
                    common_misconceptions: {
                      type: "array",
                      items: { type: "string" },
                      description: "What students wrongly think matters"
                    },
                    realistic_bar: {
                      type: "string",
                      description: "Honest description of minimum viable candidate"
                    }
                  },
                  required: ["requirements", "day_one_capabilities"]
                }
              }
            }
          ],
          tool_choice: { type: "function", function: { name: "extract_requirements" } }
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
            JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      console.log("AI response received");

      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        throw new Error("Invalid AI response format");
      }

      const parsed = JSON.parse(toolCall.function.arguments);
      requirements = parsed.requirements || [];
      description = parsed.description || null;
      salaryRange = parsed.salary_range || null;
      dayOneCapabilities = parsed.day_one_capabilities || [];
      differentiators = parsed.differentiators || [];
      commonMisconceptions = parsed.common_misconceptions || [];
      realisticBar = parsed.realistic_bar || null;

      // Cache the response
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
          realistic_bar: realisticBar
        },
        "google/gemini-2.5-flash",
        CACHE_TTL.job_requirements
      );
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

        // Update dream job with all new fields
        const { error: updateError } = await supabase
          .from("dream_jobs")
          .update({ 
            description: description,
            salary_range: salaryRange,
            day_one_capabilities: dayOneCapabilities,
            differentiators: differentiators,
            common_misconceptions: commonMisconceptions,
            realistic_bar: realisticBar
          })
          .eq("id", dreamJobId);

        if (updateError) {
          console.error("Error updating dream job:", updateError);
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
        realistic_bar: realisticBar
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
