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
    const { syllabusText, courseId } = await req.json();
    
    if (!syllabusText) {
      return new Response(
        JSON.stringify({ error: "Syllabus text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing syllabus for course:", courseId);

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
            content: `You are an expert academic advisor and career counselor. Analyze course syllabi to extract marketable skills and capabilities that employers value.

For each capability you identify, determine:
1. The skill name (use industry-standard terminology)
2. Category (one of: technical, analytical, communication, leadership, creative, research, interpersonal)
3. Proficiency level based on course depth (beginner, intermediate, advanced, expert)

Focus on skills that are transferable and valued in the job market. Be specific - instead of "communication skills", say "technical writing" or "presentation skills".`
          },
          {
            role: "user",
            content: `Analyze this course syllabus and extract the key capabilities/skills a student would develop:

${syllabusText}

Return a JSON array of capabilities in this exact format:
[
  {
    "name": "Skill Name",
    "category": "technical|analytical|communication|leadership|creative|research|interpersonal",
    "proficiency_level": "beginner|intermediate|advanced|expert"
  }
]

Extract 5-15 distinct, marketable capabilities.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_capabilities",
              description: "Extract capabilities from a course syllabus",
              parameters: {
                type: "object",
                properties: {
                  capabilities: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "The skill or capability name" },
                        category: { 
                          type: "string", 
                          enum: ["technical", "analytical", "communication", "leadership", "creative", "research", "interpersonal"]
                        },
                        proficiency_level: { 
                          type: "string", 
                          enum: ["beginner", "intermediate", "advanced", "expert"]
                        }
                      },
                      required: ["name", "category", "proficiency_level"]
                    }
                  }
                },
                required: ["capabilities"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_capabilities" } }
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

    // Extract capabilities from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response format");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const capabilities = parsed.capabilities || [];

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
        }
      }
    }

    return new Response(
      JSON.stringify({ capabilities }),
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
