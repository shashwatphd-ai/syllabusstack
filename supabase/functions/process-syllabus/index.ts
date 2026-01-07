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

interface Module {
  title: string;
  description: string;
  learning_objectives: LearningObjective[];
}

interface LearningObjective {
  text: string;
  core_concept: string;
  action_verb: string;
  bloom_level: string;
  domain: string;
  specificity: string;
  search_keywords: string[];
}

interface CourseStructure {
  course_title?: string;
  course_description?: string;
  modules: Module[];
  unassigned_objectives: LearningObjective[];
}

/**
 * Unified syllabus processor that:
 * 1. Extracts text from PDF using Gemini
 * 2. Analyzes structure to generate modules
 * 3. Extracts learning objectives and assigns to modules
 * 4. Saves everything to the database
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_CLOUD_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!GOOGLE_CLOUD_API_KEY) {
      throw new Error("GOOGLE_CLOUD_API_KEY is not configured");
    }
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

    const { document_base64, document_url, instructor_course_id, file_name } = await req.json();

    if (!document_base64 && !document_url) {
      throw new Error("Either document_base64 or document_url is required");
    }
    if (!instructor_course_id) {
      throw new Error("instructor_course_id is required");
    }

    console.log(`Processing syllabus for course ${instructor_course_id}`);

    // ========== STEP 1: Extract text from PDF ==========
    let base64Content: string;
    let mimeType = "application/pdf";

    if (document_base64) {
      base64Content = document_base64;
      if (file_name) {
        const ext = file_name.toLowerCase().split('.').pop();
        if (ext === 'docx') mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        else if (ext === 'doc') mimeType = "application/msword";
        else if (ext === 'png') mimeType = "image/png";
        else if (ext === 'jpg' || ext === 'jpeg') mimeType = "image/jpeg";
      }
    } else {
      const docResponse = await fetch(document_url);
      if (!docResponse.ok) {
        throw new Error(`Failed to fetch document: ${docResponse.status}`);
      }
      
      const contentType = docResponse.headers.get("content-type");
      if (contentType) mimeType = contentType;
      
      const buffer = await docResponse.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64Content = btoa(binary);
    }

    // Use Gemini for PDF text extraction
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_CLOUD_API_KEY}`;
    
    const extractionResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Content
              }
            },
            {
              text: `Extract ALL text content from this syllabus document. 
              
Include:
- Course title and code
- Instructor information
- Course description and objectives
- Weekly schedule and topics
- Assignments and grading criteria
- Required textbooks and materials
- Learning outcomes

Format the extracted text clearly, preserving the document structure.
Do NOT summarize - extract the complete text content.`
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 16384,
        }
      })
    });

    if (!extractionResponse.ok) {
      const errorText = await extractionResponse.text();
      console.error("Gemini extraction error:", errorText);
      throw new Error(`Failed to extract text from PDF: ${extractionResponse.status}`);
    }

    const extractionData = await extractionResponse.json();
    const extractedText = extractionData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    console.log(`Extracted ${extractedText.length} characters from PDF`);

    if (!extractedText || extractedText.length < 50) {
      throw new Error("Could not extract sufficient text from the document");
    }

    // ========== STEP 2: Analyze structure and generate modules + LOs ==========
    const structurePrompt = `You are an expert educational analyst. Analyze this course syllabus and extract:
1. The course structure (modules/units/weeks)
2. Learning objectives for each module
3. Any learning objectives that don't fit into a specific module

SYLLABUS TEXT:
${extractedText}

Return a JSON object with this EXACT structure (no markdown, just raw JSON):
{
  "course_title": "Optional: Extracted course title if found",
  "course_description": "Optional: Brief course description if found",
  "modules": [
    {
      "title": "Module 1: Introduction to...",
      "description": "Brief description of this module",
      "learning_objectives": [
        {
          "text": "Full learning objective text",
          "core_concept": "Main topic in 2-4 words",
          "action_verb": "Bloom's taxonomy verb (e.g., analyze, apply)",
          "bloom_level": "remember|understand|apply|analyze|evaluate|create",
          "domain": "business|science|humanities|technical|arts|other",
          "specificity": "introductory|intermediate|advanced",
          "search_keywords": ["keyword1", "keyword2", "keyword3"]
        }
      ]
    }
  ],
  "unassigned_objectives": [
    {
      "text": "Learning objective that doesn't fit a specific module",
      "core_concept": "...",
      "action_verb": "...",
      "bloom_level": "...",
      "domain": "...",
      "specificity": "...",
      "search_keywords": ["..."]
    }
  ]
}

RULES:
1. Create 3-8 modules based on the syllabus structure (weeks, units, chapters)
2. Extract 2-6 learning objectives per module
3. If explicit learning objectives aren't found, infer them from topics and assignments
4. Use action verbs that match Bloom's taxonomy levels
5. Search keywords should help find relevant educational YouTube videos`;

    const structureResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: structurePrompt },
        ],
      }),
    });

    if (!structureResponse.ok) {
      if (structureResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again in a moment.");
      }
      if (structureResponse.status === 402) {
        throw new Error("AI credits exhausted. Please add credits to continue.");
      }
      const errorText = await structureResponse.text();
      console.error("AI gateway error:", structureResponse.status, errorText);
      throw new Error(`AI analysis failed: ${structureResponse.status}`);
    }

    const structureData = await structureResponse.json();
    const content = structureData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from AI");
    }

    // Parse the JSON response
    let courseStructure: CourseStructure;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
      courseStructure = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse course structure from AI response");
    }

    // ========== STEP 3: Save modules and learning objectives to database ==========
    const savedModules = [];
    const savedLOs = [];
    let sequenceOrder = 1;

    // Save modules with their LOs
    for (let i = 0; i < courseStructure.modules.length; i++) {
      const module = courseStructure.modules[i];
      
      // Create module
      const { data: savedModule, error: moduleError } = await supabaseClient
        .from("modules")
        .insert({
          instructor_course_id: instructor_course_id,
          title: module.title,
          description: module.description || null,
          sequence_order: i + 1,
        })
        .select()
        .single();

      if (moduleError) {
        console.error("Error saving module:", moduleError);
        continue;
      }

      savedModules.push(savedModule);

      // Save learning objectives for this module
      for (const lo of module.learning_objectives) {
        const bloomLevel = lo.bloom_level || "understand";
        const specificity = lo.specificity || "intermediate";
        const expectedDuration = DURATION_MATRIX[bloomLevel]?.[specificity] || 15;

        const { data: savedLO, error: loError } = await supabaseClient
          .from("learning_objectives")
          .insert({
            user_id: user.id,
            instructor_course_id: instructor_course_id,
            module_id: savedModule.id,
            text: lo.text,
            core_concept: lo.core_concept,
            action_verb: lo.action_verb,
            bloom_level: bloomLevel,
            domain: lo.domain || "other",
            specificity: specificity,
            search_keywords: lo.search_keywords || [],
            expected_duration_minutes: expectedDuration,
            verification_state: "unstarted",
            sequence_order: sequenceOrder++,
          })
          .select()
          .single();

        if (loError) {
          console.error("Error saving LO:", loError);
        } else {
          savedLOs.push({ ...savedLO, module_title: savedModule.title });
        }
      }
    }

    // Save unassigned learning objectives (course-level)
    for (const lo of courseStructure.unassigned_objectives || []) {
      const bloomLevel = lo.bloom_level || "understand";
      const specificity = lo.specificity || "intermediate";
      const expectedDuration = DURATION_MATRIX[bloomLevel]?.[specificity] || 15;

      const { data: savedLO, error: loError } = await supabaseClient
        .from("learning_objectives")
        .insert({
          user_id: user.id,
          instructor_course_id: instructor_course_id,
          module_id: null,
          text: lo.text,
          core_concept: lo.core_concept,
          action_verb: lo.action_verb,
          bloom_level: bloomLevel,
          domain: lo.domain || "other",
          specificity: specificity,
          search_keywords: lo.search_keywords || [],
          expected_duration_minutes: expectedDuration,
          verification_state: "unstarted",
          sequence_order: sequenceOrder++,
        })
        .select()
        .single();

      if (loError) {
        console.error("Error saving unassigned LO:", loError);
      } else {
        savedLOs.push({ ...savedLO, module_title: null });
      }
    }

    console.log(`Created ${savedModules.length} modules and ${savedLOs.length} learning objectives`);

    return new Response(
      JSON.stringify({
        success: true,
        extracted_text_length: extractedText.length,
        course_title: courseStructure.course_title,
        course_description: courseStructure.course_description,
        modules: savedModules,
        learning_objectives: savedLOs,
        module_count: savedModules.length,
        lo_count: savedLOs.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in process-syllabus:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
