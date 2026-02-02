import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { MODEL_CONFIG } from '../_shared/ai-orchestrator.ts';
import { searchGrounded } from '../_shared/unified-ai-client.ts';
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createErrorResponse, createSuccessResponse, logInfo, logError, withErrorHandling } from "../_shared/error-handler.ts";

// ============================================================================
// SUBMIT BATCH SLIDES - Fast Placeholder Creation
// ============================================================================
//
// PURPOSE: Create placeholder records for batch slide generation
//
// WHY THIS APPROACH:
//   - Edge functions have 150s timeout
//   - Research for 78+ units takes 5+ minutes
//   - This function returns FAST (creates placeholders only)
//   - Frontend calls process-batch-research AFTER this returns
//
// FLOW:
//   1. Receive instructor_course_id and teaching_unit_ids[]
//   2. Validate input and check existing slides
//   3. Create batch_jobs record with status='preparing'
//   4. Create lecture_slides records with status='preparing'
//   5. Return immediately with batch_job_id
//   6. Frontend then calls process-batch-research to do the heavy work
//
// TWO-FUNCTION PATTERN:
//   submit-batch-slides (this function) → Fast, creates placeholders
//   process-batch-research → Slow, does research + Vertex AI submission
//
// WHY SPLIT?
//   - EdgeRuntime.waitUntil() is NOT supported in Supabase Edge Functions
//   - Supabase uses Deno Deploy, not Cloudflare Workers
//   - Must split work across function calls instead
//
// ============================================================================

// Model configuration - use orchestrator's MODEL_CONFIG for consistency
// CRITICAL: Batch MUST use the same model as v3 for quality parity.
// Cost savings come from Vertex AI's 50% batch discount, NOT from
// degrading model quality. Both v3 and batch use GEMINI_PRO.
const BATCH_MODEL = MODEL_CONFIG.GEMINI_PRO;

// ============================================================================
// PROFESSOR SYSTEM PROMPT - Full version matching generate-lecture-slides-v3
// ============================================================================
//
// CRITICAL: This MUST be identical to generate-lecture-slides-v3 for quality parity.
// The 50% cost savings comes from Google's batch API discount, NOT from
// degrading prompt quality. Any changes here must be mirrored in v3.
//

const PROFESSOR_SYSTEM_PROMPT = `You are an expert university professor creating comprehensive, self-contained lecture slides. You have decades of teaching experience, deep subject matter expertise, and mastery of evidence-based pedagogy.

YOUR MISSION:
Create a complete slide deck that enables DEEP LEARNING. Every slide must provide substantive, textbook-quality content that students can study independently. NO superficial bullet points or vague phrases—only thorough, academically rigorous explanations.

CORE TEACHING PHILOSOPHY:
- Write as if this is the student's PRIMARY learning resource (not supplementary)
- Every concept deserves a proper textbook-style definition followed by detailed explanation
- Abstract ideas must be grounded in concrete, real-world examples with verifiable data
- Build understanding step-by-step, never assuming the student will "figure it out"
- Anticipate confusion and address it proactively

PEDAGOGICAL STRUCTURE:
1. ACTIVATE prior knowledge (connect explicitly to prerequisites they've learned)
2. HOOK with real-world relevance (use specific statistics, case studies, or current events)
3. DEFINE every new term with:
   a) Formal academic definition (as found in authoritative textbooks)
   b) Plain-language explanation of what this means in practice
   c) Why this concept matters in the field
4. EXPLAIN the underlying reasoning (not just WHAT, but WHY and HOW)
5. ILLUSTRATE with concrete examples that include:
   a) Specific real-world scenarios with actual data when possible
   b) Step-by-step walkthrough of application
   c) Connection back to the abstract concept
6. ADDRESS misconceptions explicitly—name the wrong belief, explain why it's wrong, provide the correct understanding
7. SYNTHESIZE by connecting concepts to each other and the bigger picture
8. PREVIEW upcoming content to build anticipation and show learning progression

SLIDE TYPES (use appropriately):
- title: Opening that hooks attention with real-world relevance and clear learning objectives
- hook: Why students should care—use statistics, trends, career implications, or compelling scenarios
- recap: Connect to prerequisites with specific callbacks to prior learning
- definition: COMPREHENSIVE treatment—formal definition + explanation + significance + example
- explanation: Detailed conceptual exploration with reasoning, cause-effect relationships, and context
- example: Rich, detailed real-world application with specific data, names, dates when relevant
- demonstration: Step-by-step walkthrough with explicit reasoning at each step
- process: Multi-step procedures with clear explanations of why each step matters
- misconception: Directly address wrong beliefs—state the misconception, explain why it's wrong, provide correct understanding
- practice: Guided mental exercise with thinking prompts
- synthesis: Connect multiple concepts, show relationships, build bigger picture
- summary: Consolidate key learning points with actionable takeaways
- preview: Foreshadow next topics, create anticipation, show learning path

CONTENT DEPTH REQUIREMENTS:

1. main_text: 3-4 substantive sentences that TEACH, not tease. Include:
   - Core concept or principle being taught
   - Why it matters or how it applies
   - Connection to broader context or real-world implications

2. key_points: 4-5 detailed bullet points where each point:
   - Makes a complete, educational statement (not fragments)
   - Explains the WHY behind the WHAT
   - Includes specific details, data, or examples where relevant
   - Stands alone as a learnable piece of information

   BAD: "Important for analysis"
   GOOD: "Critical for data analysis because it reveals patterns that would be invisible in raw numbers—for instance, identifying that 80% of customer complaints come from just 20% of product categories enables targeted improvement efforts"

3. definition blocks (when introducing concepts):
   - term: The exact term being defined
   - formal_definition: Textbook-quality definition with precision
   - simple_explanation: Plain-language version with analogy if helpful
   - significance: Why this concept matters in the field (1-2 sentences)
   - example: Brief concrete instance showing the concept in action

4. example blocks (rich and specific):
   - scenario: Detailed, realistic situation with specifics (company names, data, context)
   - walkthrough: Step-by-step explanation of how the concept applies
   - connection_to_concept: Explicit link back to the abstract principle
   - real_world_data: Include actual statistics, case study references, or verifiable facts when possible

5. speaker_notes: 200-300 words of natural, conversational lecture narration that:
   - Sounds like a professor actually speaking to students
   - Adds context, anecdotes, and explanatory depth beyond the slides
   - Anticipates questions students might have
   - Provides additional examples or clarifications
   - Guides students through the material with clear transitions

6. MANDATORY COVERAGE:
   - Every common_misconception from the brief MUST have a dedicated slide
   - Every required_concept MUST be formally defined before use
   - Prerequisites must be explicitly referenced in the recap
   - The enables/next topics must be mentioned in the preview slide

VISUAL DIRECTIVES:
Specify visuals that genuinely enhance understanding:
- type: diagram/screenshot/comparison/flowchart/illustration/chart/infographic/none
- description: Detailed description for AI image generation (be specific about what to show)
- elements: Specific elements that MUST appear, labeled clearly
- style: "clean technical diagram", "annotated screenshot", "minimalist academic", "data visualization", etc.
- educational_purpose: What concept this visual helps explain

QUALITY STANDARDS:
- NO vague phrases like "important for business" or "useful in practice"—be SPECIFIC
- NO unexplained jargon—every technical term gets a definition
- NO orphaned concepts—everything connects to something the student knows
- NO abstract-only explanations—always ground in concrete examples
- NO filler content—every sentence must teach something

RAG (RETRIEVAL-AUGMENTED GENERATION) RULES:
When a "RESEARCH GROUNDING" section is provided in the brief:

1. CITATION MANDATE:
   - You MUST use the verified facts from the research grounding section
   - Every slide that uses a grounded fact must include [Source N] in the content
   - Store the full citation in the slide's metadata for footer display

2. NO HALLUCINATION RULE:
   - If the research does not contain a specific statistic, DO NOT invent one
   - Use phrases like "Research indicates..." or "According to established frameworks..."
   - Never fabricate case studies, dates, or numerical data

3. SOURCE ATTRIBUTION:
   - For definition slides: Use the exact definition from research, cite source
   - For example slides: Use real cases from research, or clearly mark as "Illustrative example"
   - For misconception slides: Cross-reference with research corrections if available

4. VISUAL ACCURACY:
   - If research includes visual descriptions (e.g., "Porter's Five Forces has 5 forces..."),
     use that EXACT structure in your visual_directive elements
   - Never invent framework components not mentioned in research

5. FALLBACK BEHAVIOR:
   - If research says "No external research available", you may use training data
   - Mark such content with lower confidence and add "(illustrative)" to examples
   - Include a note in speaker_notes that this is based on general knowledge

OUTPUT FORMAT: Return ONLY the raw JSON object with exact structure shown below.
CRITICAL: Do NOT wrap your response in markdown code blocks (no triple backticks).
Start your response directly with { and end with }.`;

// ============================================================================
// TYPES - Matching generate-lecture-slides-v3 exactly
// ============================================================================

// Domain configuration for research grounding (from course.domain_config)
interface DomainConfig {
  domain: string;
  trusted_sites: string[];
  citation_style: string;
  avoid_sources: string[];
  visual_templates: string[];
  academic_level: string;
  terminology_preferences: string[];
}

// Research context from Google Search grounding
interface ResearchContext {
  topic: string;
  grounded_content: {
    claim: string;
    source_url: string;
    source_title: string;
    confidence: number;
  }[];
  recommended_reading: {
    title: string;
    url: string;
    type: 'Academic' | 'Industry' | 'Case Study' | 'Documentation';
  }[];
  visual_descriptions: {
    framework_name: string;
    description: string;
    elements: string[];
  }[];
  raw_grounding_metadata?: any;
}

// Teaching unit context - MUST match v3's TeachingUnitContext exactly
interface TeachingUnitData {
  id: string;
  title: string;
  what_to_teach: string;
  why_this_matters: string;
  how_to_teach: string;
  target_duration_minutes: number;
  target_video_type: string;
  prerequisites: string[];
  enables: string[];
  common_misconceptions: string[];
  required_concepts: string[];
  avoid_terms: string[];
  search_queries: string[];
  domain: string;
  syllabus_text?: string;
  learning_objective: {
    id: string;
    text: string;
    bloom_level: string;
    core_concept: string;
    action_verb: string;
  };
  course: {
    id: string;
    title: string;
    code: string;
    detected_domain: string;
  };
  module: {
    title: string;
    description: string;
    sequence_order: number;
  };
  sibling_units: {
    id: string;
    title: string;
    what_to_teach: string;
    sequence_order: number;
  }[];
  sequence_position: number;
  total_siblings: number;
  // Research context (populated by research agent)
  research_context?: ResearchContext;
}

interface BatchRequest {
  contents: Array<{
    role: string;
    parts: Array<{ text: string }>;
  }>;
  systemInstruction: {
    parts: Array<{ text: string }>;
  };
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
  };
}

// ============================================================================
// LECTURE BRIEF BUILDER - Identical to generate-lecture-slides-v3
// ============================================================================
//
// CRITICAL: This MUST match v3's buildLectureBrief() exactly for quality parity.
//

function buildLectureBrief(context: TeachingUnitData): string {
  // Build sequence context showing position within learning objective
  const sequenceContext = context.sibling_units.map((unit, i) => {
    const status = unit.id === context.id
      ? '<-- GENERATING THIS'
      : i < context.sequence_position - 1
        ? '(COMPLETED)'
        : '(UPCOMING)';
    return `${unit.sequence_order}. ${unit.title} - ${unit.what_to_teach?.slice(0, 100) || 'No description'} ${status}`;
  }).join('\n');

  return `
=== COURSE CONTEXT ===
Course: ${context.course.title} (${context.course.code || 'No code'})
Domain: ${context.domain}
${context.syllabus_text ? `Syllabus excerpt: ${context.syllabus_text.slice(0, 500)}...` : ''}

=== MODULE CONTEXT ===
Module: ${context.module.title}
Description: ${context.module.description || 'No description provided'}

=== LEARNING OBJECTIVE ===
"${context.learning_objective.text}"
Bloom Level: ${context.learning_objective.bloom_level}
Core Concept: ${context.learning_objective.core_concept}
Action Verb: ${context.learning_objective.action_verb}

=== TEACHING UNIT SEQUENCE (Full Learning Objective) ===
${sequenceContext}

=== CURRENT TEACHING UNIT: ${context.title} ===

WHAT TO TEACH:
${context.what_to_teach}

WHY THIS MATTERS:
${context.why_this_matters}

HOW TO TEACH:
${context.how_to_teach || 'Use clear explanations with concrete examples'}

PREREQUISITES (assume student knows):
${context.prerequisites.length > 0 ? context.prerequisites.map(p => `- ${p}`).join('\n') : '- None specified'}

ENABLES (what this unlocks):
${context.enables.length > 0 ? context.enables.map(e => `- ${e}`).join('\n') : '- None specified'}

COMMON MISCONCEPTIONS (must address):
${context.common_misconceptions.length > 0 ? context.common_misconceptions.map(m => `- ${m}`).join('\n') : '- None specified'}

REQUIRED CONCEPTS (must define):
${context.required_concepts.length > 0 ? context.required_concepts.map(c => `- ${c}`).join('\n') : '- Derive from what_to_teach'}

TERMS TO AVOID (confusing for students):
${context.avoid_terms.length > 0 ? context.avoid_terms.map(t => `- ${t}`).join('\n') : '- None specified'}

TARGET DURATION: ${context.target_duration_minutes} minutes
TARGET STYLE: ${context.target_video_type}
TEACHING UNIT POSITION: ${context.sequence_position} of ${context.total_siblings} in this learning objective
`.trim();
}

// ============================================================================
// RESEARCH MERGER - Inject grounded content into lecture brief
// ============================================================================
//
// Identical to v3's mergeResearchIntoBrief()
//

function mergeResearchIntoBrief(
  baseBrief: string,
  research: ResearchContext
): string {
  if (research.grounded_content.length === 0) {
    return baseBrief + `

=== RESEARCH GROUNDING ===
No external research available. Generate content from your training data.
Mark any statistics or case studies as "illustrative examples" rather than verified facts.`;
  }

  const groundedSection = `

=== RESEARCH GROUNDING (MANDATORY TO USE) ===

VERIFIED DEFINITIONS AND FACTS:
${research.grounded_content.slice(0, 10).map((c, i) =>
  `[Source ${i + 1}] "${c.claim}"
   Citation: ${c.source_title} (${c.source_url})`
).join('\n\n')}

${research.recommended_reading.length > 0 ? `
RECOMMENDED READING (for "Further Reading" slide):
${research.recommended_reading.slice(0, 5).map(r =>
  `- ${r.title} [${r.type}]: ${r.url}`
).join('\n')}
` : ''}

${research.visual_descriptions?.length > 0 ? `
VISUAL FRAMEWORK DESCRIPTIONS (use EXACT structure for diagrams):
${research.visual_descriptions.map(v =>
  `- ${v.framework_name}: ${v.description}
   Elements: ${v.elements.join(', ')}`
).join('\n')}
` : ''}

CITATION RULES (CRITICAL):
- You MUST use the verified definitions above, NOT your training data
- Every factual claim must include [Source N] marker in the slide content
- If a statistic is NOT in the research, clearly mark as "According to industry practice..."
- Use the visual descriptions to guide EXACT diagram element composition
- Include a "Sources" or "Further Reading" slide at the end`;

  return baseBrief + groundedSection;
}

// ============================================================================
// USER PROMPT BUILDER - Identical to generate-lecture-slides-v3
// ============================================================================
//
// CRITICAL: This MUST match v3's user prompt exactly for quality parity.
//

function buildUserPrompt(context: TeachingUnitData, lectureBrief: string): string {
  const targetSlides = Math.max(5, Math.round(context.target_duration_minutes * 1.5));

  return `${lectureBrief}

=== YOUR TASK ===
Create a comprehensive ${targetSlides}-slide lecture deck for this teaching unit.

CRITICAL REQUIREMENTS:
1. Every common_misconception MUST have a dedicated "misconception" slide that:
   - States the wrong belief explicitly
   - Explains WHY students typically believe this
   - Provides the correct understanding with evidence

2. Every required_concept MUST be defined with:
   - Formal academic definition (textbook quality)
   - Plain-language explanation
   - Real-world example showing the concept in action
   - Why this concept matters in the field

3. Speaker notes MUST be 200-300 words of natural lecture narration that:
   - Sounds like an actual professor speaking
   - Adds depth beyond what's on the slide
   - Anticipates student questions

4. Bloom level "${context.learning_objective.bloom_level}" dictates cognitive depth:
   - remember: Emphasize clear definitions, memorable examples, key facts
   - understand: Focus on explanations, reasoning, cause-effect relationships
   - apply: Provide worked examples, step-by-step demonstrations, practical scenarios
   - analyze: Compare/contrast, examine relationships, break down components
   - evaluate: Include criteria for judgment, pros/cons analysis, critical assessment
   - create: Show design processes, synthesis of components, novel applications

5. CONTENT DEPTH:
   - main_text: 3-4 substantive sentences that teach a complete idea
   - key_points: 4-5 detailed bullets, each making a complete educational statement with explanations
   - examples: Use specific, verifiable real-world data (company names, statistics, case studies)
   - NO vague phrases—be specific and educational

6. ADAPTIVE LAYOUT HINTS (AI-driven content presentation):
   For EACH key_point, analyze its semantic structure and provide an optional layout_hint:
   - Describes a sequence/process (A → B → C) → type: "flow", segments: ["Step A", "Step B", "Step C"]
   - Compares two things (X vs Y, X = this; Y = that) → type: "comparison", left_right: ["X", "Y"]
   - Contains formula/relationship (X = Y + Z) → type: "equation", formula: "X = Y + Z"
   - Notable quote or key principle → type: "quote"
   - Important insight or tip → type: "callout"
   - Multiple items in a list → type: "list"
   - Simple paragraph → type: "plain"
   - Always include emphasis_words: 2-4 critical terms to highlight

OUTPUT (JSON array of slides):
{
  "slides": [
    {
      "order": 1,
      "type": "title",
      "title": "Engaging title that frames the learning journey",
      "content": {
        "main_text": "3-4 substantive sentences that introduce the topic...",
        "main_text_layout": {
          "type": "plain",
          "emphasis_words": ["critical term", "key concept"]
        },
        "key_points": [
          "Process: Set Direction → Analyze Environment → Implement → Review",
          "Vision defines the future state; Mission defines present purpose"
        ],
        "key_points_layout": [
          { "type": "flow", "segments": ["Set Direction", "Analyze", "Implement", "Review"] },
          { "type": "comparison", "left_right": ["Vision (Future)", "Mission (Present)"] }
        ]
      },
      "visual_directive": {
        "type": "illustration",
        "description": "Detailed description for image generation",
        "elements": ["element1", "element2"],
        "style": "clean academic",
        "educational_purpose": "What this visual helps students understand"
      },
      "speaker_notes": "200-300 words of natural lecture narration. Start by welcoming students and framing why this topic matters. Provide additional context not on the slide. Anticipate a question students might have. Use a conversational, professorial tone...",
      "estimated_seconds": 90,
      "pedagogy": {
        "purpose": "Hook attention and establish real-world relevance",
        "bloom_action": "activate prior knowledge and create motivation",
        "transition_to_next": "Now that we understand why this matters, let's define the foundational concepts..."
      }
    },
    {
      "order": 2,
      "type": "definition",
      "title": "Defining [Core Concept]",
      "content": {
        "main_text": "Comprehensive introduction to the concept...",
        "main_text_layout": { "type": "plain", "emphasis_words": ["concept name"] },
        "key_points": ["Detailed explanatory points..."],
        "key_points_layout": [{ "type": "plain", "emphasis_words": ["key term"] }],
        "definition": {
          "term": "The exact term",
          "formal_definition": "Precise, textbook-quality definition",
          "simple_explanation": "Plain-language version: Think of it like...",
          "significance": "This concept is fundamental because...",
          "example": "For instance, at [Company X], this concept enabled..."
        }
      },
      "visual_directive": {...},
      "speaker_notes": "200-300 words expanding on the definition...",
      "estimated_seconds": 90,
      "pedagogy": {...}
    },
    {
      "order": 3,
      "type": "misconception",
      "title": "Common Misconception: [Wrong Belief]",
      "content": {
        "main_text": "Many students initially believe that... This section directly addresses this misconception.",
        "main_text_layout": { "type": "callout", "emphasis_words": ["misconception", "incorrect"] },
        "key_points": ["Why this belief seems logical initially", "Evidence that contradicts this belief"],
        "key_points_layout": [
          { "type": "plain", "emphasis_words": ["seems logical"] },
          { "type": "plain", "emphasis_words": ["evidence", "contradicts"] }
        ],
        "misconception": {
          "wrong_belief": "Students often think that [specific incorrect belief]. This is a natural assumption because [reason it seems plausible].",
          "why_wrong": "This belief is problematic because [specific reason]. Research by [Author/Study] shows that [contradicting evidence]. In practice, this leads to [negative consequence].",
          "correct_understanding": "The accurate understanding is that [correct concept]. This means [practical implication]. A helpful way to remember this: [mnemonic or analogy]."
        }
      },
      "visual_directive": {
        "type": "diagram",
        "description": "Split comparison showing the wrong belief crossed out on the left, correct understanding highlighted on the right with connecting arrows showing the transformation",
        "elements": ["wrong_belief_box", "correct_understanding_box", "transformation_arrow"],
        "style": "clean academic with red/green contrast",
        "educational_purpose": "Visually reinforce the contrast between misconception and correct understanding"
      },
      "speaker_notes": "200-300 words explaining why this misconception is so common, providing additional examples of how it manifests, and reinforcing the correct understanding with a memorable analogy...",
      "estimated_seconds": 120,
      "pedagogy": {
        "purpose": "Address and correct a common misconception before it becomes entrenched",
        "bloom_action": "evaluate prior beliefs and reconstruct understanding",
        "transition_to_next": "Now that we've cleared up this misconception, let's see how the correct understanding applies in practice..."
      }
    },
    {
      "order": 4,
      "type": "example",
      "title": "Real-World Example: [Company/Case Name]",
      "content": {
        "main_text": "Let's examine how [concept] plays out in a real-world scenario...",
        "main_text_layout": { "type": "plain", "emphasis_words": ["real-world", "scenario"] },
        "key_points": ["Context of the example", "How the concept was applied", "Results and outcomes"],
        "key_points_layout": [
          { "type": "plain", "emphasis_words": ["context"] },
          { "type": "flow", "segments": ["Challenge", "Application", "Result"] },
          { "type": "plain", "emphasis_words": ["outcomes", "results"] }
        ],
        "example": {
          "scenario": "In 2023, [Company X] faced [specific challenge]. They needed to [specific goal] while dealing with [specific constraint].",
          "application": "Using [concept from this lecture], they implemented [specific action]. This involved [step 1], [step 2], and [step 3].",
          "outcome": "The result was [specific measurable outcome]. This demonstrates how [concept] enables [benefit] in practice.",
          "lesson": "The key takeaway is that [principle]. This example shows why [concept] matters for [target audience/profession]."
        }
      },
      "visual_directive": {
        "type": "case_study",
        "description": "Timeline or process diagram showing the company's journey from challenge through application of concept to successful outcome",
        "elements": ["company_logo_placeholder", "challenge_icon", "solution_steps", "outcome_metrics"],
        "style": "professional business case study",
        "educational_purpose": "Connect abstract concept to concrete real-world application students can relate to"
      },
      "speaker_notes": "200-300 words providing additional context about the company, why this example is particularly instructive, alternative approaches they could have taken, and how students might encounter similar situations...",
      "estimated_seconds": 120,
      "pedagogy": {
        "purpose": "Demonstrate practical application of the concept in a real context",
        "bloom_action": "apply theoretical knowledge to analyze a real case",
        "transition_to_next": "Having seen how this works in practice, let's now explore..."
      }
    }
  ]
}

CRITICAL: Every slide MUST have speaker_notes with 200-300 words. Never leave speaker_notes empty or short.
Generate all ${targetSlides} slides now with RICH, EDUCATIONAL content and LAYOUT HINTS for every key_point.

IMPORTANT: Return ONLY raw JSON. Do NOT use markdown code blocks or triple backticks.`;
}

// ============================================================================
// COMBINED PROMPT BUILDER (for batch processing)
// ============================================================================

function buildPromptForUnit(unit: TeachingUnitData): string {
  // Build the lecture brief
  const baseBrief = buildLectureBrief(unit);

  // Merge research if available
  const groundedBrief = unit.research_context
    ? mergeResearchIntoBrief(baseBrief, unit.research_context)
    : mergeResearchIntoBrief(baseBrief, {
        topic: unit.title,
        grounded_content: [],
        recommended_reading: [],
        visual_descriptions: []
      });

  // Build the full user prompt
  return buildUserPrompt(unit, groundedBrief);
}

// ============================================================================
// RESEARCH AGENT - Perplexity via OpenRouter (Identical to v3)
// ============================================================================
//
// CRITICAL: This MUST match v3's runResearchAgent for quality parity.
// Research grounding provides verified facts, citations, and framework descriptions.
// Now uses Perplexity via OpenRouter (consolidated architecture).
//

async function runResearchAgent(
  context: TeachingUnitData,
  domainConfig: DomainConfig | null,
  _googleApiKey: string // Kept for API compatibility, no longer used
): Promise<ResearchContext> {
  console.log('[Research Agent] Starting research via OpenRouter Perplexity:', context.title);

  // Build dynamic search strategy using domain config
  const trustedSites = domainConfig?.trusted_sites || ['scholar.google.com', '.edu'];

  const query = `Research the topic "${context.title}" for a ${domainConfig?.academic_level || 'university'}-level lecture.

DOMAIN: ${domainConfig?.domain || context.domain}
WHAT TO TEACH: ${context.what_to_teach}

REQUIRED CONCEPTS TO RESEARCH:
${context.required_concepts.map(c => `- ${c}`).join('\n') || '- ' + context.learning_objective.core_concept}

RESEARCH REQUIREMENTS:
1. Find the CORE DEFINITION of "${context.title}" from authoritative sources
2. Find 2-3 SPECIFIC EXAMPLES or case studies with real data, names, dates
3. Find any COMMON MISCONCEPTIONS and their corrections
4. If this involves a framework or model, describe its visual structure exactly
5. Find recommended readings or resources students should explore

PREFERRED SOURCES: ${trustedSites.join(', ')}
AVOID: ${domainConfig?.avoid_sources?.join(', ') || 'blogs, opinion pieces, unreferenced content'}`;

  try {
    const result = await searchGrounded({
      query,
      logPrefix: '[Research Agent]',
    });

    console.log(`[Research Agent] ✓ Complete: ${result.grounded_content.length} claims, ${result.recommended_reading.length} readings`);
    
    return {
      topic: result.topic,
      grounded_content: result.grounded_content,
      recommended_reading: result.recommended_reading,
      visual_descriptions: result.visual_descriptions,
    };
  } catch (error) {
    console.error('[Research Agent] Error:', error);
    return getEmptyResearchContext(context.title);
  }
}

function getEmptyResearchContext(topic: string): ResearchContext {
  return {
    topic,
    grounded_content: [],
    recommended_reading: [],
    visual_descriptions: [],
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    // ========================================================================
    // 1. SETUP AND VALIDATION
    // ========================================================================

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');

    if (!googleApiKey) {
      return createErrorResponse('INTERNAL_ERROR', corsHeaders, 'GOOGLE_CLOUD_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      if (token !== serviceRoleKey) {
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      }
    }

    // Parse request body
    const { instructor_course_id, teaching_unit_ids } = await req.json();

    if (!instructor_course_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'instructor_course_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!teaching_unit_ids?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'teaching_unit_ids array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Batch] Starting batch submission for ${teaching_unit_ids.length} teaching units`);

    // ========================================================================
    // 2. FETCH TEACHING UNIT DATA (Full context matching v3)
    // ========================================================================
    //
    // CRITICAL: This MUST fetch ALL fields that v3 uses for quality parity.
    // Missing fields would result in incomplete prompts and lower quality slides.
    //

    const { data: units, error: unitsError } = await supabase
      .from('teaching_units')
      .select(`
        id,
        title,
        what_to_teach,
        why_this_matters,
        how_to_teach,
        target_duration_minutes,
        target_video_type,
        prerequisites,
        enables,
        common_misconceptions,
        required_concepts,
        avoid_terms,
        search_queries,
        sequence_order,
        learning_objective_id,
        learning_objectives!inner (
          id,
          text,
          bloom_level,
          core_concept,
          action_verb,
          module_id,
          instructor_course_id,
          modules (
            title,
            description,
            sequence_order
          )
        )
      `)
      .in('id', teaching_unit_ids);

    if (unitsError) {
      console.error('[Batch] Error fetching teaching units:', unitsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch teaching units' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!units || units.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No teaching units found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch course data (including syllabus_text and domain_config for v3 parity)
    const { data: course, error: courseError } = await supabase
      .from('instructor_courses')
      .select('id, title, code, detected_domain, instructor_id, syllabus_text, domain_config')
      .eq('id', instructor_course_id)
      .single();

    if (courseError || !course) {
      console.error('[Batch] Error fetching course:', courseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Course not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse domain_config if available
    const domainConfig: DomainConfig | null = course.domain_config
      ? (typeof course.domain_config === 'string'
          ? JSON.parse(course.domain_config)
          : course.domain_config)
      : null;

    // ========================================================================
    // SECURITY: Verify course ownership
    // ========================================================================
    // Users can only generate slides for courses they own.
    // This prevents unauthorized batch generation for other users' courses.
    //
    if (userId && course.instructor_id && course.instructor_id !== userId) {
      console.warn(`[Batch] Authorization failed. User ${userId} attempted to generate slides for course ${course.id} owned by ${course.instructor_id}.`);
      return new Response(
        JSON.stringify({ success: false, error: 'Not authorized to generate slides for this course' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Batch] Found ${units.length} teaching units for course: ${course.title}`);

    // ========================================================================
    // 3. CHECK FOR ACTIVE BATCH JOBS (DUPLICATE PREVENTION)
    // ========================================================================
    //
    // CRITICAL: Prevent double processing by checking if an active batch 
    // already exists for this course. Only one batch can run at a time.
    //

    const { data: activeBatches } = await supabase
      .from('batch_jobs')
      .select('id, status, total_requests, succeeded_count, created_at')
      .eq('instructor_course_id', instructor_course_id)
      .in('status', ['preparing', 'researching', 'submitting', 'pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (activeBatches && activeBatches.length > 0) {
      const activeBatch = activeBatches[0];
      console.log(`[Batch] BLOCKED: Active batch ${activeBatch.id} already exists (status: ${activeBatch.status})`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `A batch job is already in progress (${activeBatch.status}). Please wait for it to complete.`,
          existing_batch: {
            id: activeBatch.id,
            status: activeBatch.status,
            total: activeBatch.total_requests,
            succeeded: activeBatch.succeeded_count,
            created_at: activeBatch.created_at,
          },
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // 4. CHECK FOR EXISTING SLIDES
    // ========================================================================
    //
    // Skip units that already have ready/published slides.
    // Re-queue failed ones.
    //

    const { data: existingSlides } = await supabase
      .from('lecture_slides')
      .select('teaching_unit_id, status')
      .in('teaching_unit_id', teaching_unit_ids);

    const existingMap = new Map(existingSlides?.map(s => [s.teaching_unit_id, s.status]) || []);

    // Filter to only units that need generation
    const unitsToProcess = units.filter(unit => {
      const status = existingMap.get(unit.id);
      // Skip ready, published, or currently in any processing state
      if (status === 'ready' || status === 'published' || status === 'generating' || 
          status === 'batch_pending' || status === 'preparing') {
        return false;
      }
      return true;
    });

    if (unitsToProcess.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All slides already generated or in progress',
          skipped: units.length,
          batch_job_id: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Batch] Processing ${unitsToProcess.length} units (skipping ${units.length - unitsToProcess.length} existing)`);

    // ========================================================================
    // 5. CREATE PLACEHOLDER RECORDS AND RETURN IMMEDIATELY
    // ========================================================================
    //
    // CRITICAL: Edge functions have a 150s timeout. Research for 78+ units
    // takes longer. We create placeholder records and return immediately,
    // then continue processing in the background using EdgeRuntime.waitUntil().
    //

    // Create a preliminary batch job record to track background work
    const preliminaryBatchJobId = crypto.randomUUID();
    
    const { error: prelimJobError } = await supabase
      .from('batch_jobs')
      .insert({
        id: preliminaryBatchJobId,
        google_batch_id: `pending-${preliminaryBatchJobId}`, // Will be updated when Vertex job is created
        instructor_course_id,
        job_type: 'slides',
        total_requests: unitsToProcess.length,
        status: 'preparing', // New status for research phase
        request_mapping: {},
        created_by: userId,
      });

    if (prelimJobError) {
      console.error('[Batch] Error creating preliminary batch job:', prelimJobError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create batch job record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create pending slide records for UI progress tracking
    const pendingSlides = unitsToProcess.map((unit) => ({
      teaching_unit_id: unit.id,
      learning_objective_id: unit.learning_objective_id,
      instructor_course_id,
      title: unit.title,
      slides: [],
      total_slides: 0,
      status: 'preparing', // Will change to batch_pending when submitted
      batch_job_id: preliminaryBatchJobId,
      created_by: userId,
    }));

    const { error: slidesError } = await supabase
      .from('lecture_slides')
      .upsert(pendingSlides, { onConflict: 'teaching_unit_id' });

    if (slidesError) {
      console.warn('[Batch] Error creating pending slide records:', slidesError);
    }

    console.log(`[Batch] Created ${pendingSlides.length} preparing slide records`);

    // ========================================================================
    // 5. RETURN IMMEDIATELY - Frontend will call process-batch-research
    // ========================================================================
    //
    // NOTE: We do NOT do research or Vertex AI submission here.
    // The frontend must call process-batch-research with the batch_job_id
    // to trigger the actual research and submission.
    //
    // WHY: EdgeRuntime.waitUntil() is NOT supported in Supabase Edge Functions.
    // Supabase runs on Deno Deploy, not Cloudflare Workers.
    //

    return new Response(
      JSON.stringify({
        success: true,
        batch_job_id: preliminaryBatchJobId,
        google_batch_id: null, // Will be set by process-batch-research
        total: unitsToProcess.length,
        skipped: units.length - unitsToProcess.length,
        status: 'preparing',
        message: `Created ${unitsToProcess.length} slide placeholders. Call process-batch-research to start.`,
        next_step: 'process-batch-research', // Hint for frontend
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError("submit-batch-slides", error instanceof Error ? error : new Error(String(error)), { action: "batch_submission" });
    return createErrorResponse("INTERNAL_ERROR", corsHeaders, error instanceof Error ? error.message : "Unknown error");
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
