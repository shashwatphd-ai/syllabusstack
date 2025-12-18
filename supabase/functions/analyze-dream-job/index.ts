import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
            content: `You are an expert career advisor with deep knowledge of job market requirements. Analyze job titles to identify the key skills and qualifications employers typically require.

For each requirement, determine:
1. The skill name (use industry-standard terminology)
2. Importance level (required, preferred, or nice_to_have)
3. Category (technical, analytical, communication, leadership, creative, research, interpersonal, certification, education)

Be realistic about what employers actually look for. Consider the company type and location context if provided.`
          },
          {
            role: "user",
            content: `Analyze this dream job and identify the typical requirements:

Job Title: ${jobTitle}
${companyType ? `Company Type: ${companyType}` : ""}
${location ? `Location: ${location}` : ""}

Return the key requirements employers typically look for in this role. Include a mix of hard skills, soft skills, certifications, and educational requirements where relevant.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_requirements",
              description: "Extract job requirements for a dream job",
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
                          enum: ["required", "preferred", "nice_to_have"]
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
                  salary_range: { type: "string", description: "Typical salary range for this role" }
                },
                required: ["requirements"]
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
    const requirements = parsed.requirements || [];
    const description = parsed.description || null;
    const salaryRange = parsed.salary_range || null;

    // If dreamJobId provided, save requirements to database
    if (dreamJobId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { global: { headers: { Authorization: authHeader } } }
        );

        // Update dream job with description and salary range
        const { error: updateError } = await supabase
          .from("dream_jobs")
          .update({ 
            description: description,
            salary_range: salaryRange
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
      }
    }

    return new Response(
      JSON.stringify({ requirements, description, salary_range: salaryRange }),
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
