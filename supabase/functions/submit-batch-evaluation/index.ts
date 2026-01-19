// ============================================================================
// SUBMIT BATCH EVALUATION - Batch Video Evaluation via Vertex AI
// ============================================================================
//
// PURPOSE: Submit all pending video evaluations for a course to Vertex AI
// batch prediction for scoring and ranking.
//
// TRIGGER: Called by QuickCourseSetup after content discovery completes
//
// FLOW:
//   1. Validate input and permissions
//   2. Fetch all content_matches with status='pending_evaluation'
//   3. Group by LO/teaching unit for context
//   4. Build JSONL batch request
//   5. Upload to GCS
//   6. Create Vertex AI batch job
//   7. Update content_matches with batch job reference
//   8. Return batch job ID
//
// FALLBACK: If this fails, videos can be evaluated individually
//
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createVertexAIAuth } from '../_shared/vertex-ai-auth.ts';
import { createGCSClient } from '../_shared/gcs-client.ts';
import { createVertexAIBatchClient, VertexAIBatchClient } from '../_shared/vertex-ai-batch.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const MODEL_CONFIG = {
  // Use gemini-2.5-flash for evaluation (consistent with current evaluate-content-batch)
  EVALUATION_MODEL: 'gemini-2.5-flash-preview-05-20',
};

const BATCH_CONFIG = {
  // Minimum videos to justify batch (below this, use sync)
  MIN_BATCH_SIZE: 10,
  // Maximum videos per batch
  MAX_BATCH_SIZE: 2000,
  // GCS path prefix
  GCS_PREFIX: 'evaluation-batch',
  // Maximum videos per request (to manage token limits)
  MAX_VIDEOS_PER_REQUEST: 15,
};

// ============================================================================
// COMPREHENSIVE BLOOM'S TAXONOMY EVALUATION FRAMEWORK
// ============================================================================

interface BloomLevelConfig {
  description: string;
  idealVideoTypes: string[];
  evaluationFocus: string[];
  redFlags: string[];
  scoringEmphasis: {
    relevance: number;
    pedagogy: number;
    quality: number;
  };
}

const BLOOM_EVALUATION_FRAMEWORK: Record<string, BloomLevelConfig> = {
  remember: {
    description: "Students need to acquire and retain factual knowledge - the foundation for higher-order thinking.",
    idealVideoTypes: ['explainer', 'summary', 'overview', 'introduction', 'definitions'],
    evaluationFocus: [
      "Does the video present information clearly and memorably?",
      "Are key terms defined explicitly and precisely?",
      "Does it use repetition, mnemonics, or memorable examples?",
      "Is the pacing appropriate for note-taking and retention?",
      "Are facts presented in a structured, organized manner?"
    ],
    redFlags: [
      "Jumps to complex application without building foundation",
      "Assumes prior knowledge that students don't have",
      "Uses jargon without defining it",
      "Too fast-paced for absorption of new information",
      "Covers too many concepts without depth on any"
    ],
    scoringEmphasis: { relevance: 0.50, pedagogy: 0.30, quality: 0.20 }
  },

  understand: {
    description: "Students need to construct meaning, grasp relationships, and explain concepts in their own words.",
    idealVideoTypes: ['animated explainer', 'visual concept', 'analogy-based', 'comparative', 'cause-effect'],
    evaluationFocus: [
      "Does the video explain WHY things work, not just WHAT they are?",
      "Are effective analogies used to connect new ideas to familiar ones?",
      "Does it show relationships, connections, and cause-effect patterns?",
      "Are abstract concepts grounded in concrete examples?",
      "Does the presenter check for understanding and address confusion?"
    ],
    redFlags: [
      "Only presents facts without explaining their significance",
      "Uses purely abstract explanations without concrete grounding",
      "Moves to procedures before conceptual understanding",
      "Presents isolated facts without connecting them",
      "Assumes understanding without building it"
    ],
    scoringEmphasis: { relevance: 0.40, pedagogy: 0.40, quality: 0.20 }
  },

  apply: {
    description: "Students need to execute procedures and use knowledge to solve problems in new situations.",
    idealVideoTypes: ['tutorial', 'step-by-step', 'worked example', 'demonstration', 'walkthrough', 'how-to'],
    evaluationFocus: [
      "Does the video show complete step-by-step procedures?",
      "Are worked examples thorough with reasoning explained at each step?",
      "Does it demonstrate how to adapt procedures to different situations?",
      "Are common mistakes identified and addressed?",
      "Is there opportunity for the viewer to mentally practice?"
    ],
    redFlags: [
      "Theory-only without practical demonstration",
      "Skips steps or assumes viewer can fill in gaps",
      "Only one example with no variation shown",
      "Too fast to follow along or replicate",
      "Uses outdated tools, methods, or versions"
    ],
    scoringEmphasis: { relevance: 0.35, pedagogy: 0.45, quality: 0.20 }
  },

  analyze: {
    description: "Students need to break down complex ideas, identify patterns, and understand how parts relate to wholes.",
    idealVideoTypes: ['case study', 'deep dive', 'breakdown', 'comparison', 'critical analysis', 'deconstruction'],
    evaluationFocus: [
      "Does the video decompose complex topics into component parts?",
      "Are compare-and-contrast frameworks used effectively?",
      "Does it help viewers identify patterns and relationships?",
      "Are underlying assumptions and implications explored?",
      "Does it model analytical thinking processes?"
    ],
    redFlags: [
      "Surface-level overview without depth",
      "Presents conclusions without showing the analysis process",
      "Misses important components or relationships",
      "Oversimplifies complex relationships",
      "Opinion presented as analysis without evidence"
    ],
    scoringEmphasis: { relevance: 0.40, pedagogy: 0.40, quality: 0.20 }
  },

  evaluate: {
    description: "Students need to make reasoned judgments based on criteria and defend their positions.",
    idealVideoTypes: ['critique', 'review', 'debate', 'pros-cons', 'quality assessment', 'comparison review'],
    evaluationFocus: [
      "Does the video establish clear evaluation criteria?",
      "Are examples of different quality levels shown and explained?",
      "Does it model the reasoning process behind judgments?",
      "Are multiple perspectives or positions considered fairly?",
      "Does it distinguish between objective criteria and subjective opinion?"
    ],
    redFlags: [
      "One-sided presentation without acknowledging alternatives",
      "Opinion without stated criteria or justification",
      "Emotional arguments without logical support",
      "Missing nuance - everything is either perfect or terrible",
      "Fails to model the evaluation process itself"
    ],
    scoringEmphasis: { relevance: 0.40, pedagogy: 0.35, quality: 0.25 }
  },

  create: {
    description: "Students need to synthesize elements into coherent wholes and produce original work.",
    idealVideoTypes: ['project walkthrough', 'design process', 'creative workflow', 'build series', 'synthesis', 'from scratch'],
    evaluationFocus: [
      "Does the video show the creative/design process, not just the final product?",
      "Is iteration and refinement demonstrated?",
      "Does it show how to combine components into coherent wholes?",
      "Are scaffolding techniques provided for open-ended work?",
      "Does it inspire creativity while providing structure?"
    ],
    redFlags: [
      "Only shows final result without the process",
      "Provides rigid templates that prevent creative adaptation",
      "Skips the messy, iterative parts of creation",
      "Doesn't explain the reasoning behind creative choices",
      "Too prescriptive for genuinely creative tasks"
    ],
    scoringEmphasis: { relevance: 0.35, pedagogy: 0.45, quality: 0.20 }
  }
};

// ============================================================================
// COMPREHENSIVE VIDEO EVALUATION SYSTEM PROMPT
// ============================================================================

const EVALUATION_SYSTEM_PROMPT = `You are a senior instructional designer and educational content evaluator with 20+ years of experience curating video content for university courses, corporate training programs, and online learning platforms. Your expertise combines deep knowledge of learning science with practical experience of what actually works in video-based education.

YOUR EVALUATION PHILOSOPHY:

1. PEDAGOGICAL FIT OVER PRODUCTION VALUE
   A well-explained concept in a simple screencast beats a flashy but superficial overview. You prioritize genuine teaching effectiveness over polish. However, production quality matters when it interferes with learning (poor audio, confusing visuals, distracting elements).

2. COGNITIVE LEVEL MATCHING
   The most common mistake in video curation is selecting content at the wrong cognitive level. A brilliant "understand" video is useless for an "apply" learning objective. You rigorously assess whether the video's approach matches what students need to DO with the knowledge.

3. HONEST, CALIBRATED SCORING
   You resist grade inflation. Your scores have meaning:
   - 90-100: Exceptional - would use as primary resource, nearly perfect fit
   - 80-89: Excellent - strong recommendation, minor gaps if any
   - 70-79: Good - solid choice, addresses core needs with some limitations
   - 60-69: Acceptable - usable if nothing better available, notable gaps
   - 50-59: Marginal - significant issues but might fill a gap
   - Below 50: Not recommended - wrong level, off-topic, or quality issues

   Most videos in a good search will score 55-75. Scores above 85 are rare. This calibration makes your recommendations meaningful.

4. RED FLAG DETECTION
   You actively identify problems that would harm learning:
   - Factual errors or outdated information (especially dangerous in rapidly-evolving fields)
   - Missing prerequisites that leave students confused
   - Conceptual misrepresentations that create or reinforce misconceptions
   - Scope mismatches (too broad/narrow, too advanced/basic)
   - Pedagogical anti-patterns (information dumps, death by bullet point, etc.)

5. CONTEXT-AWARE ASSESSMENT
   You evaluate videos in context. A video that's perfect for an introduction would be poor for advanced students, and vice versa. You use all available context (learning objective, Bloom's level, teaching unit specifics) to make nuanced judgments.

YOUR EVALUATION PROCESS:

For each video, you systematically assess three dimensions:

RELEVANCE (Does it cover the right content?):
- Topic alignment: Is this actually about what we need to teach?
- Scope match: Right level of breadth and depth?
- Concept coverage: Does it address the specific concepts, not just the general area?
- Currency: Is the information up-to-date? (Critical for tech, science, current events)
- Context fit: Appropriate for the academic level and domain?

PEDAGOGY (Does it teach effectively for THIS cognitive level?):
- Approach match: Does the teaching method fit what students need to DO with this knowledge?
- Clarity: Is the explanation clear and followable?
- Structure: Is content organized in a learnable sequence?
- Engagement: Does it maintain attention and motivation?
- Scaffolding: Does it build from known to unknown appropriately?

QUALITY (Is it watchable and credible?):
- Audio/visual: Can students see and hear everything clearly?
- Pacing: Appropriate speed for learning (not too fast, not tedious)?
- Credibility: Does the presenter demonstrate expertise?
- Professionalism: Free from distracting errors, tangents, or issues?
- Production: Do visuals enhance rather than distract from learning?

OUTPUT REQUIREMENTS:
Return ONLY valid JSON. No markdown code blocks. No explanatory text outside the JSON structure.
Ensure all scores are integers from 0-100.
Provide substantive reasoning that explains your judgment.`;

// ============================================================================
// TYPES
// ============================================================================

interface ContentMatchWithContext {
  id: string;
  learning_objective_id: string;
  teaching_unit_id: string | null;
  content_id: string;
  video_id: string;
  video_title: string;
  video_description: string;
  video_duration_seconds: number;
  channel_name: string;
  lo_text: string;
  lo_bloom_level: string;
  lo_core_concept: string | null;
  tu_title: string | null;
  tu_what_to_teach: string | null;
  tu_target_video_type: string | null;
  tu_target_duration_minutes: number | null;
  tu_required_concepts: string[] | null;
  tu_avoid_terms: string[] | null;
  tu_common_misconceptions: string[] | null;
}

// ============================================================================
// EVALUATION PROMPT BUILDER
// ============================================================================

function buildEvaluationPrompt(
  loText: string,
  bloomLevel: string,
  teachingUnit: {
    title: string | null;
    what_to_teach: string | null;
    target_video_type: string | null;
    target_duration_minutes: number | null;
    required_concepts: string[] | null;
    avoid_terms: string[] | null;
    common_misconceptions: string[] | null;
  } | null,
  videos: Array<{
    video_id: string;
    title: string;
    description: string;
    duration_minutes: number;
    channel_name: string;
  }>,
  domainContext: string | null = null
): string {
  const bloomConfig = BLOOM_EVALUATION_FRAMEWORK[bloomLevel.toLowerCase()] ||
                      BLOOM_EVALUATION_FRAMEWORK.understand;

  const videoListText = videos.map((v, i) =>
    `═══ VIDEO ${i + 1} ═══
VIDEO_ID: ${v.video_id}
TITLE: ${v.title}
CHANNEL: ${v.channel_name}
DURATION: ${v.duration_minutes} minutes
DESCRIPTION:
${v.description || 'No description available'}
═══════════════════`
  ).join('\n\n');

  const { relevance, pedagogy, quality } = bloomConfig.scoringEmphasis;

  const evaluationQuestions = bloomConfig.evaluationFocus
    .map((q, i) => `   ${i + 1}. ${q}`)
    .join('\n');

  const redFlagsText = bloomConfig.redFlags
    .map((rf) => `   - ${rf}`)
    .join('\n');

  if (teachingUnit?.title) {
    return `YOUR EVALUATION TASK:
You are evaluating YouTube videos for a SPECIFIC teaching unit within a larger learning objective. This precision matters - we need videos that teach THIS particular micro-concept, not just the general topic.

═══════════════════════════════════════════════════════════════════════════════
TARGET TEACHING UNIT:
═══════════════════════════════════════════════════════════════════════════════

TITLE: "${teachingUnit.title}"

WHAT THIS UNIT MUST TEACH:
${teachingUnit.what_to_teach || 'The specific concept indicated by the title'}

${teachingUnit.target_video_type ? `IDEAL VIDEO FORMAT: ${teachingUnit.target_video_type}
A "${teachingUnit.target_video_type}" style video would be optimal for this content.` : ''}

${teachingUnit.target_duration_minutes ? `TARGET DURATION: ~${teachingUnit.target_duration_minutes} minutes
Videos significantly shorter may lack depth; significantly longer may include unnecessary content.` : ''}

${teachingUnit.required_concepts?.length ? `REQUIRED CONCEPTS (must be covered):
${teachingUnit.required_concepts.map(c => `   ✓ ${c}`).join('\n')}
Videos that skip these concepts should receive lower relevance scores.` : ''}

${teachingUnit.avoid_terms?.length ? `TERMS TO AVOID (indicate wrong focus or outdated content):
${teachingUnit.avoid_terms.map(t => `   ✗ ${t}`).join('\n')}
Videos emphasizing these may be off-topic or outdated.` : ''}

${teachingUnit.common_misconceptions?.length ? `COMMON MISCONCEPTIONS TO ADDRESS:
${teachingUnit.common_misconceptions.map(m => `   ⚠ ${m}`).join('\n')}
Bonus points for videos that explicitly address these.` : ''}

═══════════════════════════════════════════════════════════════════════════════
LEARNING CONTEXT:
═══════════════════════════════════════════════════════════════════════════════

OVERALL LEARNING OBJECTIVE: "${loText}"
This teaching unit is one component of achieving this larger goal.

COGNITIVE LEVEL: ${bloomLevel.toUpperCase()}
${bloomConfig.description}

EVALUATION FOCUS FOR THIS LEVEL:
${evaluationQuestions}

RED FLAGS TO WATCH FOR:
${redFlagsText}

${domainContext ? `DOMAIN CONTEXT: ${domainContext}
Evaluate appropriateness for this specific field/discipline.` : ''}

═══════════════════════════════════════════════════════════════════════════════
VIDEOS TO EVALUATE:
═══════════════════════════════════════════════════════════════════════════════

${videoListText}

═══════════════════════════════════════════════════════════════════════════════
SCORING INSTRUCTIONS:
═══════════════════════════════════════════════════════════════════════════════

For each video, provide scores on three dimensions:

1. RELEVANCE (0-100) - Weight: ${(relevance * 100).toFixed(0)}%
   Does this video specifically teach "${teachingUnit.title}"?
   - 90-100: Directly and thoroughly addresses this exact micro-concept
   - 70-89: Covers the topic well with some scope mismatch
   - 50-69: Related to the general area but not this specific concept
   - Below 50: Off-topic, wrong focus, or tangentially related

2. PEDAGOGY (0-100) - Weight: ${(pedagogy * 100).toFixed(0)}%
   Does the teaching approach match the ${bloomLevel.toUpperCase()} cognitive level?
   - 90-100: Perfect pedagogical fit for this learning need
   - 70-89: Good teaching approach with minor mismatches
   - 50-69: Acceptable but wrong emphasis or approach
   - Below 50: Wrong teaching style for this cognitive level

3. QUALITY (0-100) - Weight: ${(quality * 100).toFixed(0)}%
   Is this a well-produced, watchable, credible video?
   - 90-100: Professional quality, excellent presenter, engaging
   - 70-89: Good quality, clear and watchable
   - 50-69: Acceptable quality, some issues but usable
   - Below 50: Quality issues that interfere with learning

TOTAL SCORE FORMULA:
total = (relevance × ${relevance}) + (pedagogy × ${pedagogy}) + (quality × ${quality})

RECOMMENDATION THRESHOLDS:
- highly_recommended: total >= 80 (use as primary resource)
- recommended: total >= 65 (solid choice)
- acceptable: total >= 50 (usable if needed)
- not_recommended: total < 50 (skip this video)

═══════════════════════════════════════════════════════════════════════════════
REQUIRED OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════════════════════

Return ONLY this JSON structure. No markdown, no explanation outside JSON.

{
  "evaluations": [
    {
      "video_id": "exact VIDEO_ID from above",
      "relevance_score": <0-100>,
      "pedagogy_score": <0-100>,
      "quality_score": <0-100>,
      "total_score": <calculated weighted average>,
      "reasoning": "3-4 sentences explaining: (1) how well it covers the specific micro-concept, (2) whether the teaching approach fits the cognitive level, (3) any notable strengths or concerns",
      "recommendation": "highly_recommended|recommended|acceptable|not_recommended",
      "red_flags": ["any concerning issues"] or null,
      "strengths": ["notable positives"] or null
    }
  ]
}

Begin your evaluation:`;
  } else {
    return `YOUR EVALUATION TASK:
You are evaluating YouTube videos for alignment with a learning objective. Assess how well each video would help students achieve this educational goal.

═══════════════════════════════════════════════════════════════════════════════
TARGET LEARNING OBJECTIVE:
═══════════════════════════════════════════════════════════════════════════════

"${loText}"

COGNITIVE LEVEL: ${bloomLevel.toUpperCase()}
${bloomConfig.description}

IDEAL VIDEO TYPES FOR THIS LEVEL:
${bloomConfig.idealVideoTypes.map(t => `   • ${t}`).join('\n')}

EVALUATION FOCUS QUESTIONS:
${evaluationQuestions}

RED FLAGS TO WATCH FOR:
${redFlagsText}

${domainContext ? `DOMAIN CONTEXT: ${domainContext}` : ''}

═══════════════════════════════════════════════════════════════════════════════
VIDEOS TO EVALUATE:
═══════════════════════════════════════════════════════════════════════════════

${videoListText}

═══════════════════════════════════════════════════════════════════════════════
SCORING INSTRUCTIONS:
═══════════════════════════════════════════════════════════════════════════════

For each video, provide scores on three dimensions:

1. RELEVANCE (0-100) - Weight: ${(relevance * 100).toFixed(0)}%
   Does this video address the learning objective?
   - 90-100: Directly and thoroughly addresses the objective
   - 70-89: Good coverage with minor scope issues
   - 50-69: Partially relevant, may miss key aspects
   - Below 50: Wrong topic or significant scope mismatch

2. PEDAGOGY (0-100) - Weight: ${(pedagogy * 100).toFixed(0)}%
   Does the teaching approach match the ${bloomLevel.toUpperCase()} cognitive level?
   - 90-100: Perfect approach for this type of learning
   - 70-89: Good teaching with minor approach issues
   - 50-69: Acceptable but could better serve the cognitive level
   - Below 50: Wrong pedagogical approach

3. QUALITY (0-100) - Weight: ${(quality * 100).toFixed(0)}%
   Is this a well-produced, watchable video?
   - 90-100: Excellent production and presentation
   - 70-89: Good quality, clear and professional
   - 50-69: Acceptable, watchable despite some issues
   - Below 50: Quality issues that harm learning

TOTAL SCORE: total = (relevance × ${relevance}) + (pedagogy × ${pedagogy}) + (quality × ${quality})

RECOMMENDATIONS:
- highly_recommended: total >= 80
- recommended: total >= 65
- acceptable: total >= 50
- not_recommended: total < 50

═══════════════════════════════════════════════════════════════════════════════
REQUIRED OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════════════════════

{
  "evaluations": [
    {
      "video_id": "exact VIDEO_ID from above",
      "relevance_score": <0-100>,
      "pedagogy_score": <0-100>,
      "quality_score": <0-100>,
      "total_score": <calculated>,
      "reasoning": "3-4 sentences of substantive analysis",
      "recommendation": "highly_recommended|recommended|acceptable|not_recommended",
      "red_flags": ["any issues"] or null,
      "strengths": ["positives"] or null
    }
  ]
}

Begin your evaluation:`;
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const functionName = '[submit-batch-evaluation]';
  console.log(`${functionName} Starting...`);

  try {
    // ========================================================================
    // STEP 0: Check feature flag
    // ========================================================================
    const enableBatchEvaluation = Deno.env.get('ENABLE_BATCH_EVALUATION') !== 'false';
    if (!enableBatchEvaluation) {
      console.log(`${functionName} Feature disabled, returning`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Batch evaluation is disabled',
          fallback: 'Videos will be evaluated individually during content search'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ========================================================================
    // STEP 1: Parse request and authenticate
    // ========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { instructor_course_id, content_match_ids } = await req.json();

    if (!instructor_course_id) {
      throw new Error('instructor_course_id is required');
    }

    console.log(`${functionName} Processing course: ${instructor_course_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const token = authHeader.replace('Bearer ', '');
    let userId: string | null = null;
    if (token !== supabaseKey) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        throw new Error('Invalid authorization');
      }
      userId = user.id;
    }

    // ========================================================================
    // STEP 2: Verify course ownership
    // ========================================================================
    const { data: course, error: courseError } = await supabase
      .from('instructor_courses')
      .select('id, title, instructor_id, detected_domain')
      .eq('id', instructor_course_id)
      .single();

    if (courseError || !course) {
      throw new Error(`Course not found: ${instructor_course_id}`);
    }

    if (userId && course.instructor_id !== userId) {
      throw new Error('Not authorized to modify this course');
    }

    console.log(`${functionName} Course verified: ${course.title}`);

    // ========================================================================
    // STEP 3: Fetch content_matches with full context
    // ========================================================================
    // First get the LO IDs for this course
    const { data: courseLOs } = await supabase
      .from('learning_objectives')
      .select('id')
      .eq('instructor_course_id', instructor_course_id);

    const loIds = courseLOs?.map(lo => lo.id) || [];

    if (loIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          batch_job_id: null,
          total_requests: 0,
          message: 'No learning objectives found for this course'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query for content matches that need evaluation
    let query = supabase
      .from('content_matches')
      .select(`
        id,
        learning_objective_id,
        teaching_unit_id,
        content_id,
        content:content_id (
          source_id,
          title,
          description,
          duration_seconds,
          channel_name
        ),
        learning_objectives:learning_objective_id (
          text,
          bloom_level,
          core_concept
        ),
        teaching_units:teaching_unit_id (
          title,
          what_to_teach,
          target_video_type,
          target_duration_minutes,
          required_concepts,
          avoid_terms,
          common_misconceptions
        )
      `)
      .eq('status', 'pending_evaluation')
      .in('learning_objective_id', loIds);

    // Filter to specific content_match_ids if provided
    if (content_match_ids && content_match_ids.length > 0) {
      query = query.in('id', content_match_ids);
    }

    const { data: pendingMatches, error: matchError } = await query;

    if (matchError) {
      throw new Error(`Failed to fetch content matches: ${matchError.message}`);
    }

    if (!pendingMatches || pendingMatches.length === 0) {
      console.log(`${functionName} No content matches need evaluation`);
      return new Response(
        JSON.stringify({
          success: true,
          batch_job_id: null,
          total_requests: 0,
          message: 'No videos need evaluation'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${functionName} Found ${pendingMatches.length} videos to evaluate`);

    // Check minimum batch size
    if (pendingMatches.length < BATCH_CONFIG.MIN_BATCH_SIZE) {
      console.log(`${functionName} Below minimum batch size, use sync evaluation`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Only ${pendingMatches.length} videos, below minimum ${BATCH_CONFIG.MIN_BATCH_SIZE}`,
          fallback: 'Use evaluate-content-batch directly for small batches'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ========================================================================
    // STEP 4: Group by LO/teaching unit and build batch requests
    // ========================================================================
    console.log(`${functionName} Building batch requests...`);

    // Group matches by LO + teaching unit for efficient prompting
    const groupedMatches = new Map<string, ContentMatchWithContext[]>();

    for (const match of pendingMatches) {
      const key = `${match.learning_objective_id}:${match.teaching_unit_id || 'none'}`;
      if (!groupedMatches.has(key)) {
        groupedMatches.set(key, []);
      }

      groupedMatches.get(key)!.push({
        id: match.id,
        learning_objective_id: match.learning_objective_id,
        teaching_unit_id: match.teaching_unit_id,
        content_id: match.content_id,
        video_id: (match as any).content?.source_id || '',
        video_title: (match as any).content?.title || '',
        video_description: (match as any).content?.description || '',
        video_duration_seconds: (match as any).content?.duration_seconds || 0,
        channel_name: (match as any).content?.channel_name || '',
        lo_text: (match as any).learning_objectives?.text || '',
        lo_bloom_level: (match as any).learning_objectives?.bloom_level || 'understand',
        lo_core_concept: (match as any).learning_objectives?.core_concept,
        tu_title: (match as any).teaching_units?.title,
        tu_what_to_teach: (match as any).teaching_units?.what_to_teach,
        tu_target_video_type: (match as any).teaching_units?.target_video_type,
        tu_target_duration_minutes: (match as any).teaching_units?.target_duration_minutes,
        tu_required_concepts: (match as any).teaching_units?.required_concepts,
        tu_avoid_terms: (match as any).teaching_units?.avoid_terms,
        tu_common_misconceptions: (match as any).teaching_units?.common_misconceptions,
      });
    }

    // Build batch requests (max 15 videos per request to match current behavior)
    const batchLines: object[] = [];
    const requestMapping: Record<string, string[]> = {};
    let requestIndex = 0;

    for (const [_key, matches] of groupedMatches) {
      // Split large groups into chunks
      for (let i = 0; i < matches.length; i += BATCH_CONFIG.MAX_VIDEOS_PER_REQUEST) {
        const chunk = matches.slice(i, i + BATCH_CONFIG.MAX_VIDEOS_PER_REQUEST);
        const firstMatch = chunk[0];

        const videos = chunk.map(m => ({
          video_id: m.video_id,
          title: m.video_title,
          description: m.video_description,
          duration_minutes: Math.round(m.video_duration_seconds / 60),
          channel_name: m.channel_name,
        }));

        const teachingUnit = firstMatch.tu_title ? {
          title: firstMatch.tu_title,
          what_to_teach: firstMatch.tu_what_to_teach,
          target_video_type: firstMatch.tu_target_video_type,
          target_duration_minutes: firstMatch.tu_target_duration_minutes,
          required_concepts: firstMatch.tu_required_concepts,
          avoid_terms: firstMatch.tu_avoid_terms,
          common_misconceptions: firstMatch.tu_common_misconceptions,
        } : null;

        const userPrompt = buildEvaluationPrompt(
          firstMatch.lo_text,
          firstMatch.lo_bloom_level,
          teachingUnit,
          videos,
          course.detected_domain
        );

        // Vertex AI batch request format
        const request = {
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }]
            }
          ],
          systemInstruction: {
            parts: [{ text: EVALUATION_SYSTEM_PROMPT }]
          },
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
          }
        };

        batchLines.push(request);

        // Store mapping of request index to content_match IDs and video IDs
        requestMapping[`eval_${requestIndex}`] = chunk.map(m => `${m.id}:${m.video_id}`);
        requestIndex++;
      }
    }

    console.log(`${functionName} Built ${batchLines.length} requests for ${pendingMatches.length} videos`);

    // ========================================================================
    // STEP 5: Create batch_jobs record
    // ========================================================================
    const batchJobId = crypto.randomUUID();

    const { error: insertJobError } = await supabase
      .from('batch_jobs')
      .insert({
        id: batchJobId,
        google_batch_id: `pending-${batchJobId}`, // Placeholder, will be updated with Vertex AI job ID
        instructor_course_id,
        job_type: 'evaluation',
        total_requests: batchLines.length,
        status: 'preparing',
        request_mapping: requestMapping,
        created_by: userId
      });

    if (insertJobError) {
      throw new Error(`Failed to create batch job record: ${insertJobError.message}`);
    }

    console.log(`${functionName} Created batch job: ${batchJobId}`);

    // ========================================================================
    // STEP 6: Upload JSONL to GCS
    // ========================================================================
    let auth, gcsClient, batchClient;
    try {
      auth = createVertexAIAuth();
      gcsClient = createGCSClient(auth);
      batchClient = createVertexAIBatchClient(auth);
    } catch (error) {
      await supabase
        .from('batch_jobs')
        .update({ status: 'failed', error_message: `Vertex AI init failed: ${error}` })
        .eq('id', batchJobId);
      throw error;
    }

    const inputPath = `${BATCH_CONFIG.GCS_PREFIX}/${batchJobId}/input.jsonl`;

    try {
      const gcsUri = await gcsClient.uploadJsonl(inputPath, batchLines);
      console.log(`${functionName} Uploaded to GCS: ${gcsUri}`);
    } catch (gcsError) {
      await supabase
        .from('batch_jobs')
        .update({ status: 'failed', error_message: `GCS upload failed: ${gcsError}` })
        .eq('id', batchJobId);
      throw gcsError;
    }

    // ========================================================================
    // STEP 7: Create Vertex AI batch job
    // ========================================================================
    const modelPath = VertexAIBatchClient.buildModelPath(MODEL_CONFIG.EVALUATION_MODEL);
    const bucketName = gcsClient.bucketName;

    try {
      const batchJob = await batchClient.createBatchJob({
        displayName: `evaluation-${instructor_course_id.substring(0, 8)}-${Date.now()}`,
        model: modelPath,
        inputUri: `gs://${bucketName}/${inputPath}`,
        outputUriPrefix: `gs://${bucketName}/${BATCH_CONFIG.GCS_PREFIX}/${batchJobId}/output/`
      });

      console.log(`${functionName} Created Vertex AI job: ${batchJob.name}`);

      await supabase
        .from('batch_jobs')
        .update({
          google_batch_id: batchJob.name,
          status: 'submitted'
        })
        .eq('id', batchJobId);

    } catch (vertexError) {
      try {
        await gcsClient.deleteFile(inputPath);
      } catch (cleanupError) {
        console.warn(`${functionName} Failed to cleanup GCS file:`, cleanupError);
      }
      await supabase
        .from('batch_jobs')
        .update({
          status: 'failed',
          error_message: `Vertex AI job creation failed: ${vertexError}`
        })
        .eq('id', batchJobId);
      throw vertexError;
    }

    // ========================================================================
    // STEP 8: Update content_matches with batch job reference
    // ========================================================================
    const matchIds = pendingMatches.map(m => m.id);

    await supabase
      .from('content_matches')
      .update({ evaluation_batch_job_id: batchJobId })
      .in('id', matchIds);

    console.log(`${functionName} Updated ${matchIds.length} content matches`);

    // ========================================================================
    // STEP 9: Return success
    // ========================================================================
    return new Response(
      JSON.stringify({
        success: true,
        batch_job_id: batchJobId,
        total_requests: batchLines.length,
        total_videos: pendingMatches.length,
        message: `Batch evaluation job submitted. Call poll-batch-evaluation to check status.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`${functionName} Error:`, error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
