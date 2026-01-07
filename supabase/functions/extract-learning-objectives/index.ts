import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { syllabus_text, course_id, module_id } = await req.json();
    
    // course_id here refers to instructor_course_id
    const instructorCourseId = course_id;
    
    if (!syllabus_text) {
      throw new Error("syllabus_text is required");
    }

    console.log("Extracting learning objectives from syllabus...");

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

Return a JSON array of learning objectives with this exact structure:
[
  {
    "text": "Full text of the learning objective",
    "core_concept": "Main topic in 2-4 words",
    "action_verb": "The Bloom's taxonomy verb (e.g., analyze, apply, evaluate)",
    "bloom_level": "remember|understand|apply|analyze|evaluate|create",
    "domain": "business|science|humanities|technical|arts|other",
    "specificity": "introductory|intermediate|advanced",
    "search_keywords": ["keyword1", "keyword2", "keyword3"]
  }
]

If no explicit learning objectives are found, infer them from course topics and assignments. Extract at least 3 and at most 15 learning objectives.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from AI");
    }

    // Parse the JSON response
    let learningObjectives: LearningObjective[];
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
      learningObjectives = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse learning objectives from AI response");
    }

    // Calculate expected duration for each LO and save to database
    const savedLOs = [];
    for (const lo of learningObjectives) {
      const bloomLevel = lo.bloom_level || "understand";
      const specificity = lo.specificity || "intermediate";
      const expectedDuration = DURATION_MATRIX[bloomLevel]?.[specificity] || 15;

      const loData = {
        user_id: user.id,
        instructor_course_id: instructorCourseId || null,
        module_id: module_id || null,
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

      const { data: savedLO, error: saveError } = await supabaseClient
        .from("learning_objectives")
        .insert(loData)
        .select()
        .single();

      if (saveError) {
        console.error("Error saving learning objective:", saveError);
      } else {
        savedLOs.push(savedLO);
      }
    }

    console.log(`Extracted and saved ${savedLOs.length} learning objectives`);

    return new Response(
      JSON.stringify({
        success: true,
        learning_objectives: savedLOs,
        count: savedLOs.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in extract-learning-objectives:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
