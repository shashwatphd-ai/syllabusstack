import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { MODEL_CONFIG, getVertexAIModelPath } from '../_shared/ai-orchestrator.ts';
import { createVertexAIAuth } from '../_shared/vertex-ai-auth.ts';
import { createGCSClient } from '../_shared/gcs-client.ts';
import { createVertexAIBatchClient } from '../_shared/vertex-ai-batch.ts';
// OpenRouter imports for alternative batch processing (BATCH_PROVIDER=openrouter)
import { generateText, searchGrounded, MODELS, parseJsonResponse } from '../_shared/unified-ai-client.ts';
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

// ============================================================================
// PROCESS BATCH RESEARCH - Background Research and Batch Slide Generation
// ============================================================================
//
// PURPOSE: Run research and generate slides for multiple teaching units
//
// PROVIDER TOGGLE (Updated 2026-01-22):
//   BATCH_PROVIDER env var controls routing:
//     - 'openrouter' (default): Sequential processing via OpenRouter
//     - 'vertex': Vertex AI Batch Prediction (50% cost discount)
//
// WHY TWO MODES:
//   - OpenRouter: Unified routing, same as single slides, easier debugging
//   - Vertex AI: 50% batch discount, but separate API/flow
//
// FLOW (OpenRouter mode):
//   1. Receive batch_job_id from submit-batch-slides
//   2. Fetch all teaching units for this batch
//   3. Run research agent with concurrency control
//   4. Process each unit sequentially via generateText()
//   5. Update lecture_slides records inline
//
// FLOW (Vertex mode):
//   1-4. Same as above
//   5. Upload JSONL to Cloud Storage
//   6. Create Vertex AI batch prediction job
//   7. Poll for completion separately
//
// ENVIRONMENT VARIABLES:
//   - BATCH_PROVIDER: 'openrouter' (default) or 'vertex'
//   - OPENROUTER_API_KEY: Required for OpenRouter mode
//   - GCP_SERVICE_ACCOUNT_KEY: Required for Vertex mode
//   - GCS_BUCKET: Required for Vertex mode
//   - GOOGLE_CLOUD_API_KEY: For research agent (both modes)
//
// ============================================================================

// ============================================================================
// BATCH PROVIDER TOGGLE
// ============================================================================
// Set BATCH_PROVIDER env var to control routing:
//   - 'openrouter': Process sequentially via OpenRouter (default)
//   - 'vertex': Use Vertex AI Batch Prediction (50% discount)
const BATCH_PROVIDER = Deno.env.get('BATCH_PROVIDER') || 'openrouter';
const BATCH_MODEL = MODEL_CONFIG.GEMINI_3_FLASH; // V3 parity: use same model as individual slides

// Research cache configuration
const CACHE_TTL_DAYS = 7;
const ENABLE_RESEARCH_CACHE = Deno.env.get('ENABLE_RESEARCH_CACHE') !== 'false';

// ============================================================================
// PROFESSOR SYSTEM PROMPT - Must match submit-batch-slides and v3
// ============================================================================

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
   b) Step-by-step worked examples showing application
   c) Visual descriptions that could be rendered as diagrams
6. DISTINGUISH from related concepts (what this IS vs. what it ISN'T)
7. ADDRESS common misconceptions explicitly
8. CHECK understanding with reflection prompts

CONTENT DEPTH REQUIREMENTS:
- Every key_point must be 50-150 words of substantive explanation
- Main text should average 100-200 words per slide
- Include specific numbers, dates, percentages, or measurable outcomes when relevant
- Cite foundational theories, research, or experts by name when applicable
- Use domain-specific vocabulary with clear definitions

SLIDE STRUCTURE:
- title_slide: Course positioning, professor credibility, lecture overview
- introduction: STRONG hook with real data/statistics, learning objectives, connection to prior knowledge
- concept: Deep definition, comprehensive explanation, multiple examples, visual directive
- example: Detailed real-world scenario with step-by-step walkthrough
- summary: Key takeaways with actionable next steps and preview of upcoming material

VISUAL DIRECTIVES:
For each slide requiring visuals, specify:
- type: "diagram" | "chart" | "illustration" | "infographic" | "photo" | "none"
- description: Detailed description of what should be shown
- elements: Key elements that must be included
- style: Professional academic visual style
- educational_purpose: How this visual aids understanding

SPEAKER NOTES:
Write comprehensive notes (200-400 words per slide) that include:
- Expanded explanations beyond the slide content
- Additional examples and anecdotes
- Transition phrases to the next topic
- Questions to pose to the audience
- Timing guidance (aim for ~90 seconds per slide)

OUTPUT FORMAT:
Return a JSON object with a "slides" array. Each slide must have:
{
  "order": 1,
  "type": "concept",
  "title": "Clear, Descriptive Title",
  "content": {
    "main_text": "Thorough explanation...",
    "key_points": ["Detailed point with full explanation..."],
    "definition": {
      "term": "The exact term",
      "formal_definition": "Precise, textbook-quality definition",
      "simple_explanation": "Plain-language version",
      "significance": "Why this concept matters"
    },
    "example": {
      "scenario": "Detailed real-world situation with specifics",
      "walkthrough": "Step-by-step explanation of how the concept applies",
      "connection_to_concept": "Explicit link back to the abstract principle"
    },
    "misconception": {
      "wrong_belief": "What students often incorrectly believe",
      "why_wrong": "Why this belief is problematic with evidence",
      "correct_understanding": "The accurate understanding with practical implications"
    }
  },
  "visual_directive": {
    "type": "diagram",
    "description": "...",
    "elements": ["..."],
    "style": "...",
    "educational_purpose": "..."
  },
  "speaker_notes": "Comprehensive teaching notes (200-400 words)...",
  "pedagogy": {
    "bloom_level": "understand|apply|analyze|evaluate|create",
    "prior_knowledge": ["..."],
    "common_struggles": ["..."]
  }
}

CRITICAL OUTPUT RULE:
- Return ONLY the raw JSON object
- Do NOT wrap in markdown code blocks (no triple backticks)
- Do NOT use \`\`\`json or \`\`\` markers
- Start your response directly with { and end with }
- No explanatory text before or after the JSON`;

// ============================================================================
// TYPES
// ============================================================================

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
  sibling_units: Array<{
    id: string;
    title: string;
    what_to_teach: string;
    sequence_order: number;
  }>;
  sequence_position: number;
  total_siblings: number;
  research_context?: ResearchContext;
}

// V3 PARITY: ResearchContext interface matches generate-lecture-slides-v3
interface GroundedContent {
  claim: string;
  source_url: string;
  source_title: string;
  confidence: number;
}

interface RecommendedReading {
  title: string;
  url: string;
  type: 'Academic' | 'Industry' | 'Case Study' | 'Documentation';
}

interface VisualDescription {
  framework_name: string;
  description: string;
  elements: string[];
}

interface ResearchContext {
  topic: string;
  grounded_content: GroundedContent[];
  recommended_reading: RecommendedReading[];
  visual_descriptions: VisualDescription[];
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
// RESEARCH CACHE UTILITIES
// ============================================================================

async function computeTopicHash(searchTerms: string, domain: string): Promise<string> {
  const normalized = `${searchTerms.toLowerCase().trim()}:${domain || 'general'}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getCachedResearch(
  supabase: any,
  searchTerms: string,
  domain: string
): Promise<ResearchContext | null> {
  if (!ENABLE_RESEARCH_CACHE) return null;
  
  try {
    const topicHash = await computeTopicHash(searchTerms, domain);
    
    const { data, error } = await supabase
      .from('research_cache')
      .select('*')
      .eq('topic_hash', topicHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    
    if (error || !data) return null;
    
    // Increment hit count (fire and forget)
    supabase
      .from('research_cache')
      .update({ hit_count: (data.hit_count || 0) + 1 })
      .eq('id', data.id)
      .then(() => {})
      .catch(() => {});
    
    console.log(`[Research Cache] HIT for: ${searchTerms.substring(0, 50)}...`);
    return data.research_content as ResearchContext;
  } catch (e) {
    console.warn('[Research Cache] Error reading cache:', e);
    return null;
  }
}

async function cacheResearch(
  supabase: any,
  searchTerms: string,
  domain: string,
  research: ResearchContext,
  inputTokens?: number,
  outputTokens?: number
): Promise<void> {
  if (!ENABLE_RESEARCH_CACHE) return;
  
  try {
    const topicHash = await computeTopicHash(searchTerms, domain);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);
    
    await supabase
      .from('research_cache')
      .upsert({
        topic_hash: topicHash,
        search_terms: searchTerms,
        domain: domain || null,
        research_content: research,
        input_tokens: inputTokens || null,
        output_tokens: outputTokens || null,
        expires_at: expiresAt.toISOString(),
        hit_count: 0,
      }, {
        onConflict: 'topic_hash',
        ignoreDuplicates: false,
      });
    
    console.log(`[Research Cache] STORED: ${searchTerms.substring(0, 50)}...`);
  } catch (e) {
    console.warn('[Research Cache] Error writing cache:', e);
  }
}

// ============================================================================
// RESEARCH AGENT - Perplexity via OpenRouter (with caching)
// ============================================================================

async function runResearchAgent(
  unitData: TeachingUnitData,
  domainConfig: any,
  _googleApiKey: string, // Kept for API compatibility, no longer used
  supabase?: any
): Promise<ResearchContext> {
  const searchTerms = `${unitData.title} ${unitData.what_to_teach}`;
  const domain = unitData.domain;
  
  // Check cache first
  if (supabase) {
    const cached = await getCachedResearch(supabase, searchTerms, domain);
    if (cached) {
      return cached;
    }
  }
  
  // Build research query for Perplexity
  const query = `Research the topic "${unitData.title}" for a university-level lecture.

DOMAIN: ${unitData.domain}
CONTEXT: ${unitData.what_to_teach}
${domainConfig?.preferred_sources ? `PREFERRED SOURCES: ${domainConfig.preferred_sources.join(', ')}` : ''}

Research and provide:
1. KEY FACTS: 3-5 fundamental, verified facts about this topic
2. CURRENT DEVELOPMENTS: 2-3 recent developments or trends (last 2 years)
3. EXPERT PERSPECTIVES: 1-2 notable expert opinions or theories
4. STATISTICS: 2-3 relevant statistics with sources
5. CASE STUDIES: 1-2 real-world examples or applications`;

  try {
    const result = await searchGrounded({
      query,
      logPrefix: '[Research Agent]',
    });

    // V3 PARITY: Transform unified SearchResult to v3-compatible ResearchContext format
    const research: ResearchContext = {
      topic: unitData.title,
      grounded_content: result.grounded_content.map(gc => ({
        claim: gc.claim,
        source_url: gc.source_url,
        source_title: gc.source_title,
        confidence: gc.confidence || 0.8,
      })),
      recommended_reading: result.recommended_reading || [],
      visual_descriptions: result.visual_descriptions || [],
    };

    // Cache the successful result
    if (supabase) {
      await cacheResearch(supabase, searchTerms, domain, research);
    }

    console.log(`[Research Agent] ✓ Found ${research.grounded_content.length} sources for ${unitData.title}`);
    return research;

  } catch (error) {
    console.warn(`[Research] Error for ${unitData.title}:`, error);
    return getEmptyResearchContext(unitData.title);
  }
}

function getEmptyResearchContext(title: string): ResearchContext {
  return {
    topic: title,
    grounded_content: [],
    recommended_reading: [],
    visual_descriptions: [],
  };
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

function buildLectureBrief(unitData: TeachingUnitData): string {
  const sections = [
    `# Lecture Brief: ${unitData.title}`,
    `\n## Course Context`,
    `- Course: ${unitData.course.title} (${unitData.course.code})`,
    `- Domain: ${unitData.course.detected_domain}`,
    `- Module: ${unitData.module.title}`,
    `\n## Learning Objective`,
    `- Objective: ${unitData.learning_objective.text}`,
    `- Bloom Level: ${unitData.learning_objective.bloom_level}`,
    `- Core Concept: ${unitData.learning_objective.core_concept}`,
    `\n## Teaching Content`,
    `- What to Teach: ${unitData.what_to_teach}`,
    `- Why This Matters: ${unitData.why_this_matters}`,
    `- How to Teach: ${unitData.how_to_teach}`,
    `\n## Parameters`,
    `- Target Duration: ${unitData.target_duration_minutes} minutes`,
    `- Video Type: ${unitData.target_video_type}`,
  ];

  if (unitData.prerequisites.length > 0) {
    sections.push(`\n## Prerequisites\n${unitData.prerequisites.map(p => `- ${p}`).join('\n')}`);
  }

  if (unitData.common_misconceptions.length > 0) {
    sections.push(`\n## Common Misconceptions to Address\n${unitData.common_misconceptions.map(m => `- ${m}`).join('\n')}`);
  }

  if (unitData.sibling_units.length > 0) {
    sections.push(`\n## Sequence Context (Unit ${unitData.sequence_position} of ${unitData.total_siblings})`);
    unitData.sibling_units.forEach((s, i) => {
      const marker = i + 1 === unitData.sequence_position ? '→ ' : '  ';
      sections.push(`${marker}${i + 1}. ${s.title}`);
    });
  }

  return sections.join('\n');
}

function mergeResearchIntoBrief(brief: string, research: ResearchContext): string {
  // V3 PARITY: Match the research merging format from generate-lecture-slides-v3
  if (!research.grounded_content || research.grounded_content.length === 0) {
    return brief + `

=== RESEARCH GROUNDING ===
No external research available. Generate content from your training data.
Mark any statistics or case studies as "illustrative examples" rather than verified facts.`;
  }

  const researchSection = [
    '\n\n=== RESEARCH GROUNDING (MANDATORY TO USE) ===',
  ];

  researchSection.push('\nVERIFIED DEFINITIONS AND FACTS:');
  research.grounded_content.slice(0, 10).forEach((c, i) => {
    researchSection.push(`[Source ${i + 1}] "${c.claim}"
   Citation: ${c.source_title} (${c.source_url})`);
  });

  if (research.recommended_reading && research.recommended_reading.length > 0) {
    researchSection.push('\n\nRECOMMENDED READING (for "Further Reading" slide):');
    research.recommended_reading.slice(0, 5).forEach(r => {
      researchSection.push(`- ${r.title} [${r.type}]: ${r.url}`);
    });
  }

  if (research.visual_descriptions && research.visual_descriptions.length > 0) {
    researchSection.push('\n\nVISUAL FRAMEWORK DESCRIPTIONS (use EXACT structure for diagrams):');
    research.visual_descriptions.forEach(v => {
      researchSection.push(`- ${v.framework_name}: ${v.description}
   Elements: ${v.elements.join(', ')}`);
    });
  }

  researchSection.push(`\n\nCITATION RULES (CRITICAL):
- You MUST use the verified definitions above, NOT your training data
- Every factual claim must include [Source N] marker in the slide content
- If a statistic is NOT in the research, clearly mark as "According to industry practice..."
- Use the visual descriptions to guide EXACT diagram element composition
- Include a "Sources" or "Further Reading" slide at the end`);

  return brief + researchSection.join('\n');
}

function buildUserPrompt(unitData: TeachingUnitData): string {
  let brief = buildLectureBrief(unitData);
  if (unitData.research_context) {
    brief = mergeResearchIntoBrief(brief, unitData.research_context);
  }

  return `${brief}

---

Create a complete lecture slide deck for this teaching unit. Follow all requirements from the system prompt.

IMPORTANT:
- Generate 8-15 slides depending on content depth needed
- Each slide must have substantial content (no placeholder text)
- Include visual directives for each slide
- Write comprehensive speaker notes
- Ensure pedagogically sound progression

Return valid JSON with a "slides" array.`;
}

// ============================================================================
// OPENROUTER BATCH PROCESSING
// ============================================================================
//
// Alternative to Vertex AI Batch when BATCH_PROVIDER=openrouter
// Processes units sequentially with rate limiting
//
// TRADE-OFFS vs Vertex AI:
//   + Same routing as single slides (easier debugging)
//   + Immediate results (no polling)
//   + No GCS/Vertex setup required
//   - No 50% batch discount
//   - Sequential processing (slower for large batches)
//

/**
 * Process batch slides via OpenRouter (sequential)
 *
 * @param supabase - Supabase client
 * @param batchJobId - Batch job ID
 * @param unitsToProcess - Array of teaching units with research context
 * @param requestMapping - Map of unit IDs to slide IDs
 * @returns Processing results
 */
async function processBatchViaOpenRouter(
  supabase: SupabaseClient,
  batchJobId: string,
  unitsToProcess: TeachingUnitData[],
  requestMapping: Record<string, string>
): Promise<{
  success: boolean;
  processed: number;
  failed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;
  let failed = 0;

  console.log(`[Batch-OR] Processing ${unitsToProcess.length} units via OpenRouter (${MODELS.PROFESSOR_AI})`);

  // Rate limit retry configuration
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2000; // 2 seconds base delay for exponential backoff

  for (let i = 0; i < unitsToProcess.length; i++) {
    const unit = unitsToProcess[i];
    const slideId = requestMapping[unit.id];

    if (!slideId) {
      console.warn(`[Batch-OR] [${i + 1}/${unitsToProcess.length}] No slide ID found for unit ${unit.id}, skipping`);
      failed++;
      continue;
    }

    console.log(`[Batch-OR] [${i + 1}/${unitsToProcess.length}] Processing: ${unit.title} (slideId: ${slideId})`);

    let attempt = 0;
    let success = false;

    while (attempt <= MAX_RETRIES && !success) {
      try {
        // Update status to generating (only on first attempt)
        if (attempt === 0) {
          await supabase
            .from('lecture_slides')
            .update({ status: 'generating' })
            .eq('id', slideId);
        }

        // Build the prompt (same as single slide flow)
        const userPrompt = buildUserPrompt(unit);

        // Generate via OpenRouter using same model as single slides
        const result = await generateText({
          prompt: userPrompt,
          systemPrompt: PROFESSOR_SYSTEM_PROMPT,
          model: MODELS.PROFESSOR_AI,               // 'google/gemini-2.5-flash'
          fallbacks: [MODELS.PROFESSOR_AI_FALLBACK], // 'google/gemini-flash-1.5'
          temperature: 0.7,
          maxTokens: 16000,
          logPrefix: `[Batch-OR:${i + 1}]`,
        });

        // Parse the response using shared utility
        let slides;
        try {
          const parsed = parseJsonResponse<{ slides?: unknown[] }>(result.content);
          slides = parsed.slides || parsed;
        } catch (parseError) {
          throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
        }

        // Update the record with generated slides
        await supabase
          .from('lecture_slides')
          .update({
            slides: slides,
            status: 'ready',  // Use 'ready' to match frontend expectations
            generation_provider: 'openrouter',
            generation_model: result.model || MODELS.PROFESSOR_AI,
            completed_at: new Date().toISOString(),
          })
          .eq('id', slideId);

        processed++;
        success = true;
        console.log(`[Batch-OR] [${i + 1}/${unitsToProcess.length}] ✓ Completed: ${unit.title} (${Array.isArray(slides) ? slides.length : '?'} slides)`);

        // Rate limit delay between successful requests
        if (i < unitsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if this is a rate limit error (429) or temporary server error (503)
        const isRateLimitError = errorMessage.includes('429') ||
                                  errorMessage.includes('rate limit') ||
                                  errorMessage.includes('503') ||
                                  errorMessage.includes('temporarily unavailable');

        if (isRateLimitError && attempt < MAX_RETRIES) {
          // Exponential backoff: 2s, 4s, 8s
          const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(`[Batch-OR] [${i + 1}/${unitsToProcess.length}] Rate limited. Retry ${attempt + 1}/${MAX_RETRIES} after ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          attempt++;
          continue;
        }

        // Non-retryable error or max retries reached
        console.error(`[Batch-OR] [${i + 1}/${unitsToProcess.length}] ✗ Failed: ${unit.title}`, errorMessage);

        errors.push(`${unit.title}: ${errorMessage}`);
        failed++;

        // Update record with error
        await supabase
          .from('lecture_slides')
          .update({
            status: 'failed',
            error_message: errorMessage.substring(0, 500),
          })
          .eq('id', slideId);

        break; // Exit retry loop, move to next unit
      }
    }
  }

  console.log(`[Batch-OR] Batch complete: ${processed} succeeded, ${failed} failed`);

  return {
    success: failed === 0,
    processed,
    failed,
    errors,
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { batch_job_id } = await req.json();

    if (!batch_job_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'batch_job_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Research] Starting research for batch job: ${batch_job_id}`);

    // ========================================================================
    // 1. FETCH BATCH JOB AND VALIDATE
    // ========================================================================

    const { data: batchJob, error: batchError } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('id', batch_job_id)
      .single();

    if (batchError || !batchJob) {
      return new Response(
        JSON.stringify({ success: false, error: 'Batch job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only process if in 'preparing' or 'researching' status
    // 'researching' allows self-continuation after timeout
    if (batchJob.status !== 'preparing' && batchJob.status !== 'researching') {
      return new Response(
        JSON.stringify({
          success: true,
          message: `Batch job already in status: ${batchJob.status}`,
          status: batchJob.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to 'researching' if not already
    if (batchJob.status === 'preparing') {
      await supabase
        .from('batch_jobs')
        .update({ status: 'researching' })
        .eq('id', batch_job_id);
    }

    // ========================================================================
    // 2. FETCH TEACHING UNITS FOR THIS BATCH
    // ========================================================================

    const { data: slides } = await supabase
      .from('lecture_slides')
      .select('teaching_unit_id')
      .eq('batch_job_id', batch_job_id);

    if (!slides || slides.length === 0) {
      await supabase
        .from('batch_jobs')
        .update({ status: 'failed', error_message: 'No slides found for batch' })
        .eq('id', batch_job_id);

      return new Response(
        JSON.stringify({ success: false, error: 'No slides found for batch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const teachingUnitIds = slides.map(s => s.teaching_unit_id);

    const { data: units } = await supabase
      .from('teaching_units')
      .select(`
        id, title, what_to_teach, why_this_matters, how_to_teach,
        target_duration_minutes, target_video_type, prerequisites, enables,
        common_misconceptions, required_concepts, avoid_terms, search_queries,
        sequence_order, learning_objective_id,
        learning_objectives (
          id, text, bloom_level, core_concept, action_verb,
          modules (id, title, description, sequence_order)
        )
      `)
      .in('id', teachingUnitIds);

    if (!units || units.length === 0) {
      await supabase
        .from('batch_jobs')
        .update({ status: 'failed', error_message: 'Teaching units not found' })
        .eq('id', batch_job_id);

      return new Response(
        JSON.stringify({ success: false, error: 'Teaching units not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch course info
    const { data: course } = await supabase
      .from('instructor_courses')
      .select('id, title, code, detected_domain, syllabus_text')
      .eq('id', batchJob.instructor_course_id)
      .single();

    if (!course) {
      await supabase
        .from('batch_jobs')
        .update({ status: 'failed', error_message: 'Course not found' })
        .eq('id', batch_job_id);

      return new Response(
        JSON.stringify({ success: false, error: 'Course not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get domain config
    const { data: domainConfig } = await supabase
      .from('domain_config')
      .select('*')
      .eq('domain_key', course.detected_domain || 'general')
      .maybeSingle();

    console.log(`[Research] Processing ${units.length} units for course: ${course.title}`);

    // ========================================================================
    // 3. FETCH SIBLING UNITS FOR SEQUENCE CONTEXT
    // ========================================================================

    const loIds = [...new Set(units.map(u => u.learning_objective_id))];

    const { data: allSiblings } = await supabase
      .from('teaching_units')
      .select('id, title, what_to_teach, sequence_order, learning_objective_id')
      .in('learning_objective_id', loIds)
      .order('sequence_order', { ascending: true });

    const siblingsByLO: Record<string, typeof allSiblings> = {};
    for (const sibling of allSiblings || []) {
      const loId = sibling.learning_objective_id;
      if (!siblingsByLO[loId]) siblingsByLO[loId] = [];
      siblingsByLO[loId].push(sibling);
    }

    // ========================================================================
    // 4. RUN RESEARCH WITH CONCURRENCY CONTROL
    // ========================================================================

    const CONCURRENCY_LIMIT = 10; // Conservative for timeout safety
    console.log(`[Research] Running research (${CONCURRENCY_LIMIT} concurrent)...`);

    function chunkArray<T>(arr: T[], size: number): T[][] {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    }

    // Prepare unit data
    const unitDataList = units.map((unit) => {
      const lo = unit.learning_objectives as any;
      const siblings = siblingsByLO[unit.learning_objective_id] || [];
      const sequencePosition = siblings.findIndex(s => s.id === unit.id) + 1;

      const partialUnitData: TeachingUnitData = {
        id: unit.id,
        title: unit.title,
        what_to_teach: unit.what_to_teach || '',
        why_this_matters: unit.why_this_matters || '',
        how_to_teach: unit.how_to_teach || '',
        target_duration_minutes: unit.target_duration_minutes || 8,
        target_video_type: unit.target_video_type || 'lecture',
        prerequisites: unit.prerequisites || [],
        enables: unit.enables || [],
        common_misconceptions: unit.common_misconceptions || [],
        required_concepts: unit.required_concepts || [],
        avoid_terms: unit.avoid_terms || [],
        search_queries: unit.search_queries || [],
        domain: course.detected_domain || 'general',
        syllabus_text: course.syllabus_text || undefined,
        learning_objective: {
          id: lo?.id || '',
          text: lo?.text || '',
          bloom_level: lo?.bloom_level || 'understand',
          core_concept: lo?.core_concept || '',
          action_verb: lo?.action_verb || '',
        },
        course: {
          id: course.id,
          title: course.title,
          code: course.code || '',
          detected_domain: course.detected_domain || 'general',
        },
        module: {
          title: lo?.modules?.title || 'Module',
          description: lo?.modules?.description || '',
          sequence_order: lo?.modules?.sequence_order || 0,
        },
        sibling_units: siblings.map(s => ({
          id: s.id,
          title: s.title,
          what_to_teach: s.what_to_teach || '',
          sequence_order: s.sequence_order,
        })),
        sequence_position: sequencePosition,
        total_siblings: siblings.length,
      };

      return { unitId: unit.id, unitData: partialUnitData };
    });

    // Process in chunks
    const chunks = chunkArray(unitDataList, CONCURRENCY_LIMIT);
    const researchResults: { unitId: string; unitData: TeachingUnitData; research: ResearchContext }[] = [];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      console.log(`[Research] Chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} units)...`);

      const chunkPromises = chunk.map(async ({ unitId, unitData }) => {
        const research = googleApiKey
          ? await runResearchAgent(unitData, domainConfig, googleApiKey, supabase)
          : getEmptyResearchContext(unitData.title);
        return { unitId, unitData, research };
      });

      const chunkResults = await Promise.all(chunkPromises);
      researchResults.push(...chunkResults);
    }

    console.log(`[Research] Research complete for ${researchResults.length} units`);

    // ========================================================================
    // 4.5 SAVE RESEARCH DATA TO BATCH_JOBS (V3 PARITY)
    // ========================================================================
    // Store research data in batch_jobs so poll-batch-status can access it
    // when updating lecture_slides with quality_score, is_research_grounded, etc.

    const researchDataMap: Record<string, ResearchContext> = {};
    for (const { unitId, research } of researchResults) {
      researchDataMap[unitId] = research;
    }

    await supabase
      .from('batch_jobs')
      .update({ research_data: researchDataMap })
      .eq('id', batch_job_id);

    console.log(`[Research] Saved research data for ${Object.keys(researchDataMap).length} units to batch_jobs`);

    // ========================================================================
    // 5. BUILD BATCH REQUESTS
    // ========================================================================

    const researchByUnit = new Map(
      researchResults.map(r => [r.unitId, { unitData: r.unitData, research: r.research }])
    );

    const batchRequests: BatchRequest[] = [];
    const requestMapping: Record<string, string> = {};

    for (const unit of units) {
      const researchData = researchByUnit.get(unit.id);
      if (!researchData) continue;

      const enrichedUnitData: TeachingUnitData = {
        ...researchData.unitData,
        research_context: researchData.research,
      };

      const userPrompt = buildUserPrompt(enrichedUnitData);
      // Use stable unit ID as key - prevents index mismatch when units are skipped
      const requestKey = `slide_${unit.id}`;
      requestMapping[requestKey] = unit.id;

      batchRequests.push({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: PROFESSOR_SYSTEM_PROMPT }] },
        // Use 32K tokens - 8K was causing truncation for comprehensive slides
        generationConfig: { temperature: 0.7, maxOutputTokens: 32768 },
      });
    }

    console.log(`[Research] Built ${batchRequests.length} batch requests`);

    // ========================================================================
    // 6. ROUTE TO APPROPRIATE PROVIDER
    // ========================================================================
    //
    // BATCH_PROVIDER controls routing:
    //   - 'openrouter': Sequential processing via OpenRouter (default)
    //   - 'vertex': Vertex AI Batch Prediction (50% cost discount)
    //

    if (BATCH_PROVIDER === 'openrouter') {
      // ====================================================================
      // OPENROUTER PATH - Chunked processing with self-continuation
      // ====================================================================
      //
      // TIMEOUT SAFETY: Edge functions have ~150s limit. Processing 121 slides
      // sequentially would timeout. We process CHUNK_SIZE slides per invocation,
      // then invoke ourselves to continue.
      //
      console.log(`[Research] Using OpenRouter for batch processing (BATCH_PROVIDER=${BATCH_PROVIDER})`);

      const CHUNK_SIZE = 8; // Process 8 units per invocation (~60s each = ~8 min max)

      // Build enriched unit data for OpenRouter processing
      const allUnitsToProcess: TeachingUnitData[] = [];
      const slideIdMapping: Record<string, string> = {};

      for (const unit of units) {
        const researchData = researchByUnit.get(unit.id);
        if (!researchData) continue;

        const enrichedUnitData: TeachingUnitData = {
          ...researchData.unitData,
          research_context: researchData.research,
        };
        allUnitsToProcess.push(enrichedUnitData);

        // Find the slide ID for this unit
        const { data: slideRecord } = await supabase
          .from('lecture_slides')
          .select('id')
          .eq('teaching_unit_id', unit.id)
          .eq('batch_job_id', batch_job_id)
          .single();

        if (slideRecord) {
          slideIdMapping[unit.id] = slideRecord.id;
        }
      }

      // Filter to only units that still need processing (pending, generating, or batch_pending)
      const { data: pendingSlides } = await supabase
        .from('lecture_slides')
        .select('teaching_unit_id, status')
        .eq('batch_job_id', batch_job_id)
        .in('status', ['preparing', 'batch_pending', 'generating', 'pending']);

      const pendingUnitIds = new Set((pendingSlides || []).map(s => s.teaching_unit_id));
      const unitsStillPending = allUnitsToProcess.filter(u => pendingUnitIds.has(u.id));

      console.log(`[Research] ${unitsStillPending.length}/${allUnitsToProcess.length} units still need processing`);

      if (unitsStillPending.length === 0) {
        // All done - update batch job
        const { data: slideStats } = await supabase
          .from('lecture_slides')
          .select('status')
          .eq('batch_job_id', batch_job_id);

        const completed = slideStats?.filter(s => s.status === 'ready' || s.status === 'completed').length || 0;
        const failed = slideStats?.filter(s => s.status === 'failed').length || 0;

        await supabase
          .from('batch_jobs')
          .update({
            status: failed === 0 ? 'completed' : (completed > 0 ? 'partial' : 'failed'),
            completed_at: new Date().toISOString(),
            succeeded_count: completed,
            failed_count: failed,
            provider: 'openrouter',
          })
          .eq('id', batch_job_id);

        return new Response(
          JSON.stringify({
            success: true,
            batch_job_id,
            provider: 'openrouter',
            status: 'completed',
            completed,
            failed,
            total: allUnitsToProcess.length,
            message: `Batch complete: ${completed} succeeded, ${failed} failed`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Take only CHUNK_SIZE units for this invocation
      const chunkToProcess = unitsStillPending.slice(0, CHUNK_SIZE);
      const remainingCount = unitsStillPending.length - chunkToProcess.length;

      console.log(`[Research] Processing chunk of ${chunkToProcess.length} units (${remainingCount} remaining after this)`);

      // Process this chunk via OpenRouter
      const result = await processBatchViaOpenRouter(
        supabase,
        batch_job_id,
        chunkToProcess,
        slideIdMapping
      );

      // Update batch job with progress
      const { data: currentStats } = await supabase
        .from('lecture_slides')
        .select('status')
        .eq('batch_job_id', batch_job_id);

      const completedSoFar = currentStats?.filter(s => s.status === 'ready' || s.status === 'completed').length || 0;
      const failedSoFar = currentStats?.filter(s => s.status === 'failed').length || 0;

      await supabase
        .from('batch_jobs')
        .update({
          succeeded_count: completedSoFar,
          failed_count: failedSoFar,
          updated_at: new Date().toISOString(),
        })
        .eq('id', batch_job_id);

      // Self-continue if more work remains
      if (remainingCount > 0) {
        console.log(`[Research] Self-continuing for ${remainingCount} remaining units...`);

        // Fire-and-forget invocation to continue processing
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        fetch(`${supabaseUrl}/functions/v1/process-batch-research`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ batch_job_id }),
        }).catch(err => {
          console.error('[Research] Self-continuation failed:', err);
        });

        return new Response(
          JSON.stringify({
            success: true,
            batch_job_id,
            provider: 'openrouter',
            status: 'continuing',
            processed_this_chunk: result.processed,
            failed_this_chunk: result.failed,
            completed_total: completedSoFar,
            remaining: remainingCount,
            message: `Processed ${result.processed}/${chunkToProcess.length} in this chunk. ${remainingCount} units remaining. Self-continuing...`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // This was the final chunk
      await supabase
        .from('batch_jobs')
        .update({
          status: failedSoFar === 0 ? 'completed' : (completedSoFar > 0 ? 'partial' : 'failed'),
          completed_at: new Date().toISOString(),
          provider: 'openrouter',
        })
        .eq('id', batch_job_id);

      return new Response(
        JSON.stringify({
          success: result.success,
          batch_job_id,
          provider: 'openrouter',
          status: 'completed',
          processed: result.processed,
          failed: result.failed,
          total: allUnitsToProcess.length,
          errors: result.errors.slice(0, 10),
          message: `Batch complete via OpenRouter: ${completedSoFar} succeeded, ${failedSoFar} failed`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ======================================================================
    // VERTEX AI PATH - Upload to GCS and create batch job
    // ======================================================================
    console.log(`[Research] Using Vertex AI for batch processing (BATCH_PROVIDER=${BATCH_PROVIDER})`);

    let auth, gcsClient, batchClient;
    try {
      auth = createVertexAIAuth();
      gcsClient = createGCSClient(auth);
      batchClient = createVertexAIBatchClient(auth);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Research] Vertex AI config error:', errorMessage);

      const truncatedError = `Vertex AI configuration error: ${errorMessage}`.substring(0, 500);

      await supabase
        .from('batch_jobs')
        .update({ status: 'failed', error_message: truncatedError })
        .eq('id', batch_job_id);
      await supabase
        .from('lecture_slides')
        .update({ status: 'failed', error_message: truncatedError })
        .eq('batch_job_id', batch_job_id);

      return new Response(
        JSON.stringify({ success: false, error: truncatedError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const batchId = crypto.randomUUID();
    const inputPath = `inputs/${batchId}/requests.jsonl`;
    const outputPrefix = `gs://${gcsClient.bucketName}/outputs/${batchId}/`;

    // Build JSONL with custom_id for stable response mapping
    const requestMappingKeys = Object.keys(requestMapping);
    const jsonlLines = batchRequests.map((req, idx) => ({
      custom_id: requestMappingKeys[idx], // Include stable ID for response matching
      request: {
        contents: req.contents,
        systemInstruction: req.systemInstruction,
        generationConfig: req.generationConfig,
      },
    }));

    console.log(`[Research] Uploading ${jsonlLines.length} requests to GCS...`);

    let inputUri: string;
    try {
      inputUri = await gcsClient.uploadJsonl(inputPath, jsonlLines);
      console.log(`[Research] Uploaded to: ${inputUri}`);
    } catch (uploadError) {
      const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError);
      console.error('[Research] GCS upload failed:', errorMessage);

      const truncatedError = `Cloud Storage upload failed: ${errorMessage}`.substring(0, 500);

      await supabase
        .from('batch_jobs')
        .update({ status: 'failed', error_message: truncatedError })
        .eq('id', batch_job_id);
      await supabase
        .from('lecture_slides')
        .update({ status: 'failed', error_message: truncatedError })
        .eq('batch_job_id', batch_job_id);

      return new Response(
        JSON.stringify({ success: false, error: truncatedError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // 7. CREATE VERTEX AI BATCH JOB
    // ========================================================================

    const displayName = `slides-${batchJob.instructor_course_id}-${Date.now()}`;
    const modelPath = getVertexAIModelPath(BATCH_MODEL);

    console.log(`[Research] Creating Vertex AI job: ${displayName}`);

    let vertexJob;
    try {
      vertexJob = await batchClient.createBatchJob({
        displayName,
        model: modelPath,
        inputUri,
        outputUriPrefix: outputPrefix,
      });
    } catch (createError) {
      // Extract the actual error message for debugging
      const errorMessage = createError instanceof Error ? createError.message : String(createError);
      console.error('[Research] Vertex AI job creation failed:', errorMessage);

      // Log additional context for debugging
      console.error('[Research] Job details:', {
        displayName,
        model: modelPath,
        inputUri,
        outputUriPrefix: outputPrefix,
        projectId: auth.projectId,
      });

      try {
        await gcsClient.deleteFile(inputPath);
      } catch {}

      // Store the actual error message (truncated if too long)
      const truncatedError = errorMessage.length > 500
        ? errorMessage.substring(0, 500) + '...'
        : errorMessage;

      await supabase
        .from('batch_jobs')
        .update({ status: 'failed', error_message: truncatedError })
        .eq('id', batch_job_id);
      await supabase
        .from('lecture_slides')
        .update({ status: 'failed', error_message: truncatedError })
        .eq('batch_job_id', batch_job_id);

      return new Response(
        JSON.stringify({ success: false, error: truncatedError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const googleBatchId = vertexJob.name;
    console.log(`[Research] Vertex AI job created: ${googleBatchId}`);

    // ========================================================================
    // 8. UPDATE RECORDS WITH SUCCESS
    // ========================================================================

    await supabase
      .from('batch_jobs')
      .update({
        google_batch_id: googleBatchId,
        status: 'submitted',
        request_mapping: requestMapping,
        output_uri: outputPrefix,
        provider: 'vertex',  // Track which provider was used
      })
      .eq('id', batch_job_id);

    await supabase
      .from('lecture_slides')
      .update({ status: 'batch_pending' })
      .eq('batch_job_id', batch_job_id);

    console.log(`[Research] Batch ${batch_job_id} submitted successfully via Vertex AI`);

    return new Response(
      JSON.stringify({
        success: true,
        batch_job_id,
        google_batch_id: googleBatchId,
        provider: 'vertex',
        total: batchRequests.length,
        status: 'submitted',
        message: `Research complete, ${batchRequests.length} slides submitted to Vertex AI (50% batch discount)`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Research] Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
