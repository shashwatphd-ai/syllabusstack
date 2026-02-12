import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.12';
import { generateText, MODELS } from "../_shared/unified-ai-client.ts";
import { parseJsonFromAI } from "../_shared/slide-prompts.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo
} from "../_shared/error-handler.ts";
import { checkRateLimit, getUserLimits, createRateLimitResponse } from "../_shared/rate-limiter.ts";

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

const SYSTEM_PROMPT = `You are an expert curriculum designer with deep expertise in pedagogical sequencing, instructional design, Bloom's Taxonomy, and Understanding by Design (UbD) framework.

YOUR APPROACH - BACKWARD DESIGN (Wiggins & McTighe):
1. START WITH THE END: What should students be able to DO after mastering this learning objective?
2. DETERMINE EVIDENCE: How will we know they've achieved it? What observable behaviors demonstrate mastery?
3. DESIGN LEARNING: Work backward to identify the discrete micro-concepts that build toward that end state.

CRITICAL PEDAGOGICAL PRINCIPLES:
1. MICROLEARNING: Each teaching unit = ONE focused concept, 5-15 minutes, single video
2. PREREQUISITE MAPPING: Foundational concepts FIRST - never assume prior knowledge
3. COGNITIVE SCAFFOLDING: Progress from Remember → Understand → Apply → Analyze → Evaluate → Create
4. SPECIFICITY: Search queries must be HIGHLY SPECIFIC to find exact teaching content
5. REAL-WORLD RELEVANCE: Every unit should connect abstract concepts to practical application

USE YOUR SEARCH CAPABILITY to verify:
1. Current real-world applications and case studies from the last 2 years for this domain
2. Authoritative definitions of domain-specific terms — do not guess terminology
3. Current best practices in pedagogy for this specific subject area
4. Whether prerequisite concepts you identify are accurate for the field

SEARCH QUERY GENERATION: For each teaching unit, your search queries should be informed by what you found during your research — use verified terminology, not guesses. Include specific names, frameworks, tools, or methods you discovered through search.

QUALITY MARKERS FOR TEACHING UNITS:
- Clear, measurable learning outcome per unit
- Explicit prerequisite dependencies
- Common misconceptions identified proactively
- Multiple varied search queries for content discovery
- Appropriate video type matched to cognitive level (explainer for concepts, tutorial for procedures)

2025-2026 BEST PRACTICES:
- Active learning emphasis over passive consumption
- Spaced repetition and retrieval practice integration
- Inclusive design considering diverse learner needs
- Real-world case studies from the last 2 years
- Evidence-based pedagogical strategies verified through current research

OUTPUT FORMAT: Return valid JSON only, no markdown or explanations outside the JSON.`;

function buildUserPrompt(lo: LearningObjective, module: ModuleContext | null, course: CourseContext): string {
  return `TASK: Decompose this learning objective into 3-5 teachable micro-concepts using backward design. Aim for 5 units for comprehensive topics, but use fewer (3-4) if the concept is focused or simple.

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
${course.syllabus_text ? `\nSYLLABUS EXCERPT (for deeper context):\n${course.syllabus_text.substring(0, 15000)}` : ''}

BACKWARD DESIGN PROCESS (Wiggins & McTighe UbD Framework):

STAGE 1 - IDENTIFY DESIRED RESULTS:
Ask yourself: After completing this learning objective, what should students be able to DO that they couldn't do before?
- What are the enduring understandings they will gain?
- What essential questions will they be able to answer?
- What knowledge and skills are explicit in this LO?

STAGE 2 - DETERMINE ACCEPTABLE EVIDENCE:
Ask yourself: How would I know a student has achieved this?
- What would demonstrate true understanding vs. surface familiarity?
- What real-world task or problem should they be able to solve?

STAGE 3 - PLAN LEARNING EXPERIENCES (YOUR OUTPUT):
Work BACKWARD from the end state:
- What foundational concepts must be established first?
- What is the logical progression from novice to competent?
- Where do students typically struggle or form misconceptions?

VIDEO TYPES (Match to Bloom's Level):
- "explainer": Conceptual explanations, theory (Remember/Understand)
- "tutorial": Step-by-step how-to (Apply)
- "worked_example": Problem solving with walkthrough (Apply/Analyze)
- "case_study": Real-world analysis (Analyze/Evaluate)
- "lecture": Academic deep-dive (Understand/Analyze)
- "demonstration": Visual process showing (Apply)

SEARCH QUERY BEST PRACTICES:
- SPECIFIC: "Boolean algebra AND OR NOT gates tutorial" NOT "logic explained"
- DOMAIN-AWARE: "fsQCA truth table construction political science"
- PLATFORM-TARGETED: Include "tutorial", "explained", "walkthrough" appropriately
- NEGATIVE FILTERS (in avoid_terms): Terms that would find wrong content level

QUALITY CRITERIA FOR EACH TEACHING UNIT:
✓ Single focused concept (5-15 min video)
✓ Clear measurable outcome
✓ Explicit prerequisite chain
✓ At least one common misconception identified
✓ 4-5 highly specific search queries
✓ Appropriate video type for cognitive level

RESPONSE FORMAT (JSON only):
{
  "reasoning_chain": "Detailed backward design thinking: END STATE → EVIDENCE → SEQUENCE",
  "domain_context": "Identified domain/field for this content",
  "total_estimated_time_minutes": <number>,
  "teaching_units": [
    {
      "sequence_order": 1,
      "title": "Clear, specific title",
      "description": "Brief description of what this unit covers",
      "what_to_teach": "Specific concepts and skills to be taught",
      "why_this_matters": "Why this is important for the overall LO and real-world application",
      "how_to_teach": "Pedagogical approach with specific techniques (worked example, comparison, analogy, etc.)",
      "common_misconceptions": ["Specific misunderstandings students often have"],
      "prerequisites": ["Concepts that MUST be understood first (be specific)"],
      "enables": ["What learning this unit unlocks"],
      "target_video_type": "explainer|tutorial|worked_example|case_study|lecture|demonstration",
      "target_duration_minutes": <5-15>,
      "search_queries": ["highly specific query 1", "query with domain terms 2", "query with action verbs 3", "alternative phrasing 4", "authoritative source query 5"],
      "required_concepts": ["Key terms that MUST be covered in the video"],
      "avoid_terms": ["Terms indicating wrong level or off-topic content"]
    }
  ]
}`;
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<DecomposeResponse> {
  console.log('[curriculum-reasoning-agent] Calling Gemini 3 Pro with thinking + search...');

  const GOOGLE_CLOUD_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");
  if (!GOOGLE_CLOUD_API_KEY) {
    throw new Error("GOOGLE_CLOUD_API_KEY not configured");
  }

  const model = 'gemini-3-pro-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_CLOUD_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 65536,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: "high" },
        },
        tools: [{
          googleSearch: {}
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[curriculum-reasoning-agent] Gemini API error:', response.status, err.substring(0, 500));
      throw new Error(`Gemini API error ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      ?.map((p: any) => p.text)
      ?.join("") || "";

    if (!text) throw new Error('No content in Gemini response');

    console.log('[curriculum-reasoning-agent] Response:', text.length, 'chars');
    return parseJsonFromAI(text) as DecomposeResponse;
  } catch (directError) {
    console.error('[curriculum-reasoning-agent] Direct Gemini failed, falling back to OpenRouter:', directError);

    const fallbackResult = await generateText({
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      model: MODELS.GEMINI_PRO,
      fallbacks: [MODELS.GEMINI_FLASH, MODELS.FAST],
      logPrefix: '[curriculum-reasoning-agent-fallback]'
    });
    if (!fallbackResult.content) throw new Error('No content from fallback');
    return parseJsonFromAI(fallbackResult.content) as DecomposeResponse;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from auth header if present
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        if (token !== supabaseServiceKey) {
          const { data: { user } } = await supabase.auth.getUser(token);
          userId = user?.id || null;
        }
      } catch {
        // Continue without user ID
      }
    }

    // Rate limit check (only if user is authenticated)
    if (userId) {
      const limits = await getUserLimits(supabase, userId);
      const rateLimitResult = await checkRateLimit(supabase, userId, 'curriculum-reasoning-agent', limits);
      if (!rateLimitResult.allowed) {
        return createRateLimitResponse(rateLimitResult, corsHeaders);
      }
    }

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

    // IDEMPOTENCY CHECK: Prevent duplicate processing
    if (lo.decomposition_status === 'in_progress') {
      console.log('[curriculum-reasoning-agent] Analysis already in progress for LO:', learning_objective_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Analysis already in progress',
          already_in_progress: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409 // Conflict
        }
      );
    }

    if (lo.decomposition_status === 'completed') {
      // Return existing teaching units instead of regenerating
      const { data: existingUnits } = await supabase
        .from('teaching_units')
        .select('*')
        .eq('learning_objective_id', learning_objective_id)
        .order('sequence_order', { ascending: true });

      if (existingUnits && existingUnits.length > 0) {
        console.log('[curriculum-reasoning-agent] Returning existing units for completed LO:', learning_objective_id);
        return new Response(
          JSON.stringify({
            success: true,
            teaching_units: existingUnits,
            already_exists: true,
            message: 'Teaching units already exist for this learning objective'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }
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

    // Log quality warning if fewer than 3 units (may indicate oversimplification)
    if (result.teaching_units.length < 3) {
      console.warn(`[curriculum-reasoning-agent] LOW UNIT COUNT WARNING: Only ${result.teaching_units.length} units generated for LO ${learning_objective_id}. ` +
        `LO text: "${(lo as LearningObjective).text?.substring(0, 100)}..." - Consider reviewing if decomposition is sufficient.`);
    }

    // ENFORCE MAX 5 TEACHING UNITS PER LO (Phase 1 constraint)
    if (result.teaching_units.length > 5) {
      console.warn(`[curriculum-reasoning-agent] TRUNCATING: AI generated ${result.teaching_units.length} units for LO ${learning_objective_id}, ` +
        `keeping first 5. Discarded units: ${result.teaching_units.slice(5).map(u => u.title).join(', ')}`);
      result.teaching_units = result.teaching_units.slice(0, 5);
    }

    // Ensure valid video types
    const validVideoTypes = ['explainer', 'tutorial', 'case_study', 'worked_example', 'lecture', 'demonstration'];
    result.teaching_units = result.teaching_units.map((unit, index) => ({
      ...unit,
      sequence_order: index + 1, // Ensure proper ordering after potential truncation
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
      target_duration_minutes: Math.round(unit.target_duration_minutes || 10),
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
