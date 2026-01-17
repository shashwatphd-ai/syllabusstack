import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types
interface LearningObjective {
  id: string;
  text: string;
  core_concept: string | null;
  bloom_level: string | null;
  expected_duration_minutes: number | null;
  module_id: string | null;
}

interface ModuleContext {
  id: string;
  title: string;
  description: string | null;
}

interface CourseContext {
  id: string;
  title: string;
  description: string | null;
  syllabus_text: string | null;
  detected_domain: string | null;
}

interface TeachingUnit {
  sequence_order: number;
  title: string;
  description: string;
  what_to_teach: string;
  why_this_matters: string;
  how_to_teach: string;
  common_misconceptions: string[];
  prerequisites: string[];
  enables: string[];
  target_video_type: 'explainer' | 'tutorial' | 'case_study' | 'worked_example' | 'lecture' | 'demonstration';
  target_duration_minutes: number;
  search_queries: string[];
  required_concepts: string[];
  avoid_terms: string[];
}

interface DecomposeRequest {
  learning_objective_id: string;
}

interface DecomposeResponse {
  teaching_units: TeachingUnit[];
  reasoning_chain: string;
  total_estimated_time_minutes: number;
  domain_context: string;
}

// Google Cloud API configuration
const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const SYSTEM_PROMPT = `You are an expert curriculum designer with deep expertise in pedagogical sequencing, instructional design, and Bloom's Taxonomy. Your task is to decompose high-level learning objectives into teachable micro-concepts that can be taught through individual videos.

CRITICAL RULES:
1. Each teaching unit should represent ONE focused concept that can be taught in a single 5-15 minute video
2. Units must be ordered by prerequisite dependencies - foundational concepts FIRST
3. Search queries must be HIGHLY SPECIFIC to find the exact teaching content needed
4. Think about what a student ACTUALLY needs to learn to achieve the learning objective

OUTPUT FORMAT: Return valid JSON only, no markdown or explanations outside the JSON.`;

function buildUserPrompt(lo: LearningObjective, module: ModuleContext | null, course: CourseContext): string {
  return `TASK: Decompose this learning objective into 3-8 teachable micro-concepts.

LEARNING OBJECTIVE:
"${lo.text}"
${lo.core_concept ? `Core Concept: ${lo.core_concept}` : ''}
${lo.bloom_level ? `Bloom's Level: ${lo.bloom_level}` : ''}
${lo.expected_duration_minutes ? `Expected Duration: ${lo.expected_duration_minutes} minutes` : ''}

${module ? `MODULE CONTEXT:
Title: ${module.title}
${module.description ? `Description: ${module.description}` : ''}` : ''}

COURSE CONTEXT:
Title: ${course.title}
${course.description ? `Description: ${course.description}` : ''}
${course.detected_domain ? `Domain: ${course.detected_domain}` : ''}
${course.syllabus_text ? `\nSYLLABUS EXCERPT (for context):\n${course.syllabus_text.substring(0, 3000)}` : ''}

CHAIN OF THOUGHT PROCESS:
1. First, identify the END STATE - what should students be able to DO after mastering this LO?
2. Work BACKWARDS - what prerequisite knowledge is absolutely needed?
3. Identify EACH discrete concept that must be taught separately
4. Order them by prerequisite dependencies (foundational → advanced)
5. For each concept, determine the ideal video type and specific search queries

VIDEO TYPES:
- "explainer": Conceptual explanations, theory, "what is X?"
- "tutorial": Step-by-step how-to, practical application
- "worked_example": Solving specific problems with full walkthrough
- "case_study": Real-world application and analysis
- "lecture": Academic deep-dive, comprehensive coverage
- "demonstration": Visual showing of process or technique

SEARCH QUERY GUIDELINES:
- Be SPECIFIC: "Boolean algebra AND OR NOT gates tutorial" NOT "logic explained"
- Include domain context: "fsQCA truth table construction political science"
- Target specific video types: "Venn diagram set operations visual explanation"
- Avoid generic terms alone: "tutorial", "course", "introduction"

RESPONSE FORMAT (JSON only):
{
  "reasoning_chain": "Step-by-step explanation of your decomposition logic",
  "domain_context": "Identified domain/field for this content",
  "total_estimated_time_minutes": <number>,
  "teaching_units": [
    {
      "sequence_order": 1,
      "title": "Clear, specific title",
      "description": "Brief description of what this unit covers",
      "what_to_teach": "Specific concepts and skills to be taught",
      "why_this_matters": "Why this is important for the overall LO",
      "how_to_teach": "Pedagogical approach - visual, hands-on, conceptual",
      "common_misconceptions": ["List of common student misunderstandings"],
      "prerequisites": ["Concepts that must be understood first"],
      "enables": ["What concepts this unit unlocks"],
      "target_video_type": "explainer|tutorial|worked_example|case_study|lecture|demonstration",
      "target_duration_minutes": <5-15>,
      "search_queries": ["query1", "query2", "query3", "query4", "query5"],
      "required_concepts": ["Must be mentioned in video"],
      "avoid_terms": ["Terms that indicate wrong content"]
    }
  ]
}`;
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<DecomposeResponse> {
  const googleApiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');

  if (!googleApiKey) {
    throw new Error('GOOGLE_CLOUD_API_KEY not configured');
  }

  console.log('[curriculum-reasoning-agent] Calling Google Cloud API for decomposition...');

  // Using gemini-3-pro-preview (mapped from openai/gpt-5.2) for complex curriculum decomposition
  const url = `${GOOGLE_API_BASE}/models/gemini-3-pro-preview:generateContent?key=${googleApiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[curriculum-reasoning-agent] Google Cloud API error:', error);

    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 403) {
      // Google Cloud returns 403 for billing/quota issues
      throw new Error('API quota exceeded or billing issue. Please check your Google Cloud account.');
    }

    throw new Error(`Google Cloud API error: ${response.status}`);
  }

  // Safer JSON parsing - handle truncated/empty responses from rate limiting
  const responseText = await response.text();

  if (!responseText || responseText.trim() === '') {
    console.error('[curriculum-reasoning-agent] Empty response from AI gateway - possible rate limit');
    throw new Error('Empty response from AI gateway - possible rate limit. Please try again.');
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error('[curriculum-reasoning-agent] Failed to parse gateway response:', responseText.substring(0, 500));
    throw new Error('Invalid JSON from AI gateway - response may have been truncated');
  }

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('No content in AI response');
  }

  console.log('[curriculum-reasoning-agent] Raw AI response length:', content.length);

  // Try to extract JSON from the response (may be wrapped in markdown)
  let jsonContent = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonContent = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonContent);
    return parsed as DecomposeResponse;
  } catch (e) {
    console.error('[curriculum-reasoning-agent] Failed to parse AI response:', content.substring(0, 500));
    throw new Error('Failed to parse AI response as JSON');
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { learning_objective_id } = await req.json() as DecomposeRequest;

    if (!learning_objective_id) {
      throw new Error('learning_objective_id is required');
    }

    console.log('[curriculum-reasoning-agent] Decomposing LO:', learning_objective_id);

    // Fetch the learning objective with module and course context
    const { data: lo, error: loError } = await supabase
      .from('learning_objectives')
      .select(`
        *,
        module:module_id(id, title, description),
        instructor_course:instructor_course_id(id, title, description, syllabus_text, detected_domain)
      `)
      .eq('id', learning_objective_id)
      .single();

    if (loError || !lo) {
      console.error('[curriculum-reasoning-agent] Error fetching LO:', loError);
      throw new Error(`Learning objective not found: ${learning_objective_id}`);
    }

    // Update status to in_progress
    await supabase
      .from('learning_objectives')
      .update({ decomposition_status: 'in_progress' })
      .eq('id', learning_objective_id);

    // Build prompts and call AI
    const moduleContext = lo.module as ModuleContext | null;
    const courseContext = lo.instructor_course as CourseContext;

    if (!courseContext) {
      throw new Error('Learning objective must belong to a course');
    }

    const userPrompt = buildUserPrompt(lo as LearningObjective, moduleContext, courseContext);
    
    let result: DecomposeResponse;
    try {
      result = await callAI(SYSTEM_PROMPT, userPrompt);
    } catch (aiError) {
      // Update status to failed
      await supabase
        .from('learning_objectives')
        .update({ decomposition_status: 'failed' })
        .eq('id', learning_objective_id);
      throw aiError;
    }

    console.log('[curriculum-reasoning-agent] Generated', result.teaching_units?.length || 0, 'teaching units');

    // Validate teaching units
    if (!result.teaching_units || result.teaching_units.length === 0) {
      throw new Error('AI returned no teaching units');
    }

    // Ensure valid video types
    const validVideoTypes = ['explainer', 'tutorial', 'case_study', 'worked_example', 'lecture', 'demonstration'];
    result.teaching_units = result.teaching_units.map(unit => ({
      ...unit,
      target_video_type: validVideoTypes.includes(unit.target_video_type) 
        ? unit.target_video_type 
        : 'explainer',
      search_queries: unit.search_queries?.slice(0, 5) || [],
      common_misconceptions: unit.common_misconceptions || [],
      prerequisites: unit.prerequisites || [],
      enables: unit.enables || [],
      required_concepts: unit.required_concepts || [],
      avoid_terms: unit.avoid_terms || [],
    }));

    // Insert teaching units into database
    const unitsToInsert = result.teaching_units.map(unit => ({
      learning_objective_id,
      sequence_order: unit.sequence_order,
      title: unit.title,
      description: unit.description,
      what_to_teach: unit.what_to_teach,
      why_this_matters: unit.why_this_matters,
      how_to_teach: unit.how_to_teach,
      common_misconceptions: unit.common_misconceptions,
      prerequisites: unit.prerequisites,
      enables: unit.enables,
      target_video_type: unit.target_video_type,
      target_duration_minutes: unit.target_duration_minutes || 10,
      search_queries: unit.search_queries,
      required_concepts: unit.required_concepts,
      avoid_terms: unit.avoid_terms,
      status: 'pending',
    }));

    const { data: insertedUnits, error: insertError } = await supabase
      .from('teaching_units')
      .insert(unitsToInsert)
      .select();

    if (insertError) {
      console.error('[curriculum-reasoning-agent] Error inserting teaching units:', insertError);
      await supabase
        .from('learning_objectives')
        .update({ decomposition_status: 'failed' })
        .eq('id', learning_objective_id);
      throw insertError;
    }

    // Update LO status to completed
    await supabase
      .from('learning_objectives')
      .update({ decomposition_status: 'completed' })
      .eq('id', learning_objective_id);

    console.log('[curriculum-reasoning-agent] Successfully created', insertedUnits?.length, 'teaching units');

    return new Response(
      JSON.stringify({
        success: true,
        teaching_units: insertedUnits,
        reasoning_chain: result.reasoning_chain,
        total_estimated_time_minutes: result.total_estimated_time_minutes,
        domain_context: result.domain_context,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    console.error('[curriculum-reasoning-agent] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
