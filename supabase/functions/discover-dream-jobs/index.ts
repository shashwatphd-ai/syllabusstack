import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Cloud API configuration
const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface DiscoveredJob {
  title: string;
  description: string;
  whyItFits: string;
  salaryRange: string;
  growthOutlook: string;
  keySkills: string[];
  dayInLife: string;
  companyTypes: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { interests, skills, major, careerGoals, workStyle } = await req.json();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Failed to authenticate user" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's existing capabilities
    const { data: capabilities } = await supabase
      .from("capabilities")
      .select("name, category, proficiency_level")
      .eq("user_id", user.id);

    // Get user's courses for context
    const { data: courses } = await supabase
      .from("courses")
      .select("title")
      .eq("user_id", user.id)
      .limit(10);

    const GOOGLE_CLOUD_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");
    if (!GOOGLE_CLOUD_API_KEY) {
      throw new Error("GOOGLE_CLOUD_API_KEY is not configured");
    }

    console.log("Discovering dream jobs for user with context:", {
      interests,
      skills,
      major,
      capabilitiesCount: capabilities?.length || 0,
      coursesCount: courses?.length || 0,
    });

    const capabilitiesText = capabilities?.map(c => 
      `- ${c.name} (${c.proficiency_level || 'developing'})`
    ).join("\n") || "No capabilities recorded yet";

    const coursesText = courses?.map(c => `- ${c.title}`).join("\n") || "No courses added yet";

    const systemPrompt = `You are a career discovery AI helping students find careers they might not know exist.

Your job is to suggest 5-8 DIVERSE career paths that match the student's profile. Include:
1. Some obvious matches they might already know
2. Some emerging roles they probably haven't heard of
3. Some interdisciplinary roles that combine their interests

Be SPECIFIC with job titles (not just "engineer" but "Machine Learning Engineer at a Health Tech Startup").
Be HONEST about salary ranges and growth outlook.
Focus on roles that are actually HIRING and have good prospects.

Return JSON in this exact format:
{
  "discoveredJobs": [
    {
      "title": "Specific Job Title",
      "description": "2-3 sentence description of what this role does",
      "whyItFits": "Why this matches the student's profile",
      "salaryRange": "$X - $Y (entry level to senior)",
      "growthOutlook": "High/Medium/Low with brief explanation",
      "keySkills": ["skill1", "skill2", "skill3"],
      "dayInLife": "Brief description of typical day",
      "companyTypes": ["startup", "tech", "consulting"]
    }
  ],
  "careerInsights": "Overall insights about the student's career potential and recommendations"
}`;

    const userContent = `Help this student discover career paths they might not know about:

STUDENT INTERESTS: ${interests || "Not specified"}
SKILLS/STRENGTHS: ${skills || "Not specified"}
MAJOR/FIELD: ${major || "Not specified"}
CAREER GOALS: ${careerGoals || "Open to discovering options"}
WORK STYLE PREFERENCE: ${workStyle || "Not specified"}

CURRENT CAPABILITIES:
${capabilitiesText}

COURSES TAKEN:
${coursesText}

Based on this profile, suggest 5-8 diverse career paths including:
- Roles they might already know
- Emerging roles they probably haven't heard of
- Interdisciplinary roles combining their interests
- Both traditional and non-traditional paths`;

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
        generationConfig: {
          temperature: 0.7,
        },
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
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse JSON from response
    let parsed;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse career suggestions");
    }

    console.log(`Discovered ${parsed.discoveredJobs?.length || 0} career paths`);

    return new Response(
      JSON.stringify({
        success: true,
        jobs: parsed.discoveredJobs || [],
        insights: parsed.careerInsights || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in discover-dream-jobs:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
