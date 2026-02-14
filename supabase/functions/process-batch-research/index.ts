import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { MODEL_CONFIG, getVertexAIModelPath } from '../_shared/ai-orchestrator.ts';
import { createVertexAIAuth } from '../_shared/vertex-ai-auth.ts';
import { createGCSClient } from '../_shared/gcs-client.ts';
import { createVertexAIBatchClient } from '../_shared/vertex-ai-batch.ts';
// OpenRouter imports for alternative batch processing (BATCH_PROVIDER=openrouter)
import { generateText, MODELS, parseJsonResponse } from '../_shared/unified-ai-client.ts';
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

// Shared slide system modules (consolidated - eliminates prompt drift)
import type { TeachingUnitContext, ResearchContext, DomainConfig } from '../_shared/slide-types.ts';
import {
  PROFESSOR_SYSTEM_PROMPT,
  buildLectureBrief,
  mergeResearchIntoBrief,
  parseJsonFromAI,
} from '../_shared/slide-prompts.ts';
import { runResearchAgent, getEmptyResearchContext } from '../_shared/research-agent.ts';
import { calculateQualityMetrics } from '../_shared/quality-metrics.ts';
import { upgradeSpeakerNotes } from '../_shared/ai-narrator.ts';

// ============================================================================
// PROCESS BATCH RESEARCH - Background Research and Batch Slide Generation
// ============================================================================
//
// PURPOSE: Run research and generate slides for multiple teaching units
//
// PROVIDER TOGGLE:
//   BATCH_PROVIDER env var controls routing:
//     - 'openrouter' (default): Sequential processing via OpenRouter
//     - 'vertex': Vertex AI Batch Prediction (50% cost discount)
//
// CONSOLIDATION NOTE (2026-02):
//   This file previously had its own PROFESSOR_SYSTEM_PROMPT (105 lines,
//   drifted from v3's 179 lines), buildLectureBrief (different format),
//   buildUserPrompt (stripped-down), and research agent (without cache in
//   single path). ALL of these are now imported from _shared/ modules,
//   ensuring batch slides get the same quality as single slides.
//
// ============================================================================

const BATCH_PROVIDER = Deno.env.get('BATCH_PROVIDER') || 'openrouter';
const BATCH_MODEL = MODEL_CONFIG.GEMINI_3_FLASH;

// Vertex AI batch request format
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
// PROMPT BUILDER FOR BATCH UNITS
// ============================================================================
// Uses the canonical shared prompt builders (same as v3 single path)

function buildPromptForUnit(unitData: TeachingUnitContext, research?: ResearchContext): string {
  const baseBrief = buildLectureBrief(unitData);
  const groundedBrief = research
    ? mergeResearchIntoBrief(baseBrief, research)
    : mergeResearchIntoBrief(baseBrief, getEmptyResearchContext(unitData.title));

  // Fixed 6 slides per teaching unit (v3 parity)
  const targetSlides = 6;

  return `${groundedBrief}

=== YOUR TASK ===
Create a comprehensive ${targetSlides}-slide lecture deck for this teaching unit.

CRITICAL REQUIREMENTS:
1. Every common_misconception MUST have a dedicated "misconception" slide
2. Every required_concept MUST be defined with formal + plain-language definitions
3. Speaker notes MUST be 200-300 words of natural lecture narration
4. Bloom level "${unitData.learning_objective.bloom_level}" dictates cognitive depth

5. CONTENT DEPTH:
   - main_text: 3-4 substantive sentences that teach a complete idea
   - key_points: 4-5 detailed bullets with explanations
   - examples: Use specific, verifiable real-world data

6. ADAPTIVE LAYOUT HINTS:
   For EACH key_point, provide a layout_hint:
   - Sequence/process \u2192 type: "flow", segments: [...]
   - Comparison \u2192 type: "comparison", left_right: [...]
   - Formula \u2192 type: "equation", formula: "..."
   - Quote/principle \u2192 type: "quote"
   - Important insight \u2192 type: "callout"
   - Simple paragraph \u2192 type: "plain"
   - Always include emphasis_words: 2-4 critical terms

7. OPTIONAL FIELDS HANDLING:
   - "definition", "example", "misconception", "steps" are OPTIONAL
   - ONLY include if the slide type warrants them
   - DO NOT fill with "N/A" or placeholders - OMIT the key entirely

OUTPUT: JSON with "slides" array. Each slide has order, type, title, content, visual_directive, speaker_notes, estimated_seconds, pedagogy.

CRITICAL: Every slide MUST have speaker_notes with 200-300 words. Generate all ${targetSlides} slides with RICH content.`;
}

// ============================================================================
// OPENROUTER BATCH PROCESSING
// ============================================================================

async function processBatchViaOpenRouter(
  supabase: SupabaseClient,
  batchJobId: string,
  unitsToProcess: TeachingUnitContext[],
  requestMapping: Record<string, string>,
  researchMap: Map<string, ResearchContext>,
  domain: string
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

  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2000;

  for (let i = 0; i < unitsToProcess.length; i++) {
    const unit = unitsToProcess[i];
    const slideId = requestMapping[unit.id];

    if (!slideId) {
      console.warn(`[Batch-OR] [${i + 1}/${unitsToProcess.length}] No slide ID for unit ${unit.id}, skipping`);
      failed++;
      continue;
    }

    console.log(`[Batch-OR] [${i + 1}/${unitsToProcess.length}] Processing: ${unit.title} (slideId: ${slideId})`);

    let attempt = 0;
    let success = false;

    while (attempt <= MAX_RETRIES && !success) {
      try {
        if (attempt === 0) {
          await supabase
            .from('lecture_slides')
            .update({ status: 'generating' })
            .eq('id', slideId);
        }

        // Build prompt using shared canonical builders (v3 parity)
        const research = researchMap.get(unit.id);
        const userPrompt = buildPromptForUnit(unit, research);

        // Generate via OpenRouter using same model + temperature as v3
        const result = await generateText({
          prompt: userPrompt,
          systemPrompt: PROFESSOR_SYSTEM_PROMPT,
          model: MODELS.PROFESSOR_AI,
          fallbacks: [MODELS.PROFESSOR_AI_FALLBACK],
          temperature: 0.4, // v3 parity (was 0.7 in old batch path)
          maxTokens: 16000,
          logPrefix: `[Batch-OR:${i + 1}]`,
        });

        // Parse response
        let slides;
        try {
          const parsed = parseJsonFromAI(result.content);
          slides = parsed.slides || parsed;
        } catch (parseError) {
          throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
        }

        // PHASE: CMM Speaker Notes Upgrade (before saving)
        if (Array.isArray(slides)) {
          console.log(`[Batch-OR] [${i + 1}] Upgrading speaker notes via CMM...`);
          try {
            await upgradeSpeakerNotes(slides, unit.title, domain);
          } catch (cmmErr) {
            console.warn(`[Batch-OR] [${i + 1}] CMM upgrade failed, keeping original notes:`, cmmErr);
          }
        }

        // Build stored slides with proper structure (v3 parity)
        const storedSlides = Array.isArray(slides) ? slides.map((slide: any) => ({
          order: slide.order,
          type: slide.type,
          title: slide.title,
          content: {
            main_text: slide.content?.main_text || '',
            main_text_layout: slide.content?.main_text_layout || { type: 'plain' },
            key_points: slide.content?.key_points || [],
            key_points_layout: slide.content?.key_points_layout || [],
            definition: slide.content?.definition,
            example: slide.content?.example,
            misconception: slide.content?.misconception,
            steps: slide.content?.steps,
          },
          visual: {
            type: slide.visual_directive?.type || 'none',
            url: null,
            alt_text: slide.visual_directive?.description || '',
            fallback_description: slide.visual_directive?.description || '',
            elements: slide.visual_directive?.elements || [],
            style: slide.visual_directive?.style || '',
            educational_purpose: slide.visual_directive?.educational_purpose || '',
          },
          speaker_notes: slide.speaker_notes || '',
          speaker_notes_duration_seconds: slide.estimated_seconds || 60,
          pedagogy: slide.pedagogy || {},
        })) : slides;

        // Calculate quality metrics instead of hardcoding 80
        let qualityScore = 80; // fallback
        try {
          if (Array.isArray(storedSlides)) {
            const qualityResult = calculateQualityMetrics(storedSlides as any);
            qualityScore = qualityResult.score;
            if (qualityResult.warnings.length > 0) {
              console.warn(`[Batch] Quality warnings for ${slideId}:`, qualityResult.warnings.slice(0, 3).join('; '));
            }
          }
        } catch (qErr) {
          console.warn(`[Batch] Quality metrics calculation failed, using default:`, qErr);
        }

        // Update the record with generated slides
        await supabase
          .from('lecture_slides')
          .update({
            slides: storedSlides,
            total_slides: Array.isArray(storedSlides) ? storedSlides.length : 0,
            status: 'ready',
            quality_score: qualityScore,
            generation_provider: 'openrouter',
            generation_model: result.model || MODELS.PROFESSOR_AI,
            is_research_grounded: (research?.grounded_content?.length || 0) > 0,
            research_context: (research?.grounded_content?.length || 0) > 0 ? research : null,
            citation_count: research?.grounded_content?.length || 0,
            completed_at: new Date().toISOString(),
          })
          .eq('id', slideId);

        processed++;
        success = true;
        console.log(`[Batch-OR] [${i + 1}/${unitsToProcess.length}] Completed: ${unit.title} (${Array.isArray(storedSlides) ? storedSlides.length : '?'} slides)`);

        if (i < unitsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        const isRateLimitError = errorMessage.includes('429') ||
                                  errorMessage.includes('rate limit') ||
                                  errorMessage.includes('503') ||
                                  errorMessage.includes('temporarily unavailable');

        if (isRateLimitError && attempt < MAX_RETRIES) {
          const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(`[Batch-OR] [${i + 1}] Rate limited. Retry ${attempt + 1}/${MAX_RETRIES} after ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          attempt++;
          continue;
        }

        console.error(`[Batch-OR] [${i + 1}] Failed: ${unit.title}`, errorMessage);
        errors.push(`${unit.title}: ${errorMessage}`);
        failed++;

        await supabase
          .from('lecture_slides')
          .update({
            status: 'failed',
            error_message: errorMessage.substring(0, 500),
          })
          .eq('id', slideId);

        break;
      }
    }
  }

  console.log(`[Batch-OR] Batch complete: ${processed} succeeded, ${failed} failed`);
  return { success: failed === 0, processed, failed, errors };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
      .select('id, title, code, detected_domain, syllabus_text, domain_config')
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

    // Parse domain_config using shared type
    const domainConfig: DomainConfig | null = course.domain_config
      ? (typeof course.domain_config === 'string'
          ? JSON.parse(course.domain_config)
          : course.domain_config)
      : null;

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

    const CONCURRENCY_LIMIT = 10;
    console.log(`[Research] Running research (${CONCURRENCY_LIMIT} concurrent)...`);

    function chunkArray<T>(arr: T[], size: number): T[][] {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    }

    // Build TeachingUnitContext objects (shared type, v3 parity)
    const unitContextList = units.map((unit) => {
      const lo = unit.learning_objectives as any;
      const siblings = siblingsByLO[unit.learning_objective_id] || [];
      const sequencePosition = siblings.findIndex(s => s.id === unit.id) + 1;

      const context: TeachingUnitContext = {
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
        domain_config: domainConfig,
      };

      return { unitId: unit.id, context };
    });

    // Research in chunks using shared research agent (with cache)
    const chunks = chunkArray(unitContextList, CONCURRENCY_LIMIT);
    const researchResults: { unitId: string; context: TeachingUnitContext; research: ResearchContext }[] = [];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      console.log(`[Research] Chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} units)...`);

      const chunkPromises = chunk.map(async ({ unitId, context }) => {
        // Uses shared research agent with caching (v3 parity)
        const research = await runResearchAgent(context, domainConfig, supabase);
        return { unitId, context, research };
      });

      const chunkResults = await Promise.all(chunkPromises);
      researchResults.push(...chunkResults);
    }

    console.log(`[Research] Research complete for ${researchResults.length} units`);

    // Save research data to batch_jobs
    const researchDataMap: Record<string, ResearchContext> = {};
    for (const { unitId, research } of researchResults) {
      researchDataMap[unitId] = research;
    }

    await supabase
      .from('batch_jobs')
      .update({ research_data: researchDataMap })
      .eq('id', batch_job_id);

    console.log(`[Research] Saved research data for ${Object.keys(researchDataMap).length} units`);

    // ========================================================================
    // 5. BUILD REQUEST DATA
    // ========================================================================

    const researchByUnit = new Map(
      researchResults.map(r => [r.unitId, { context: r.context, research: r.research }])
    );

    const batchRequests: BatchRequest[] = [];
    const requestMapping: Record<string, string> = {};

    for (const unit of units) {
      const researchData = researchByUnit.get(unit.id);
      if (!researchData) continue;

      const userPrompt = buildPromptForUnit(researchData.context, researchData.research);
      const requestKey = `slide_${unit.id}`;
      requestMapping[requestKey] = unit.id;

      batchRequests.push({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: PROFESSOR_SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.4, maxOutputTokens: 16000 }, // v3 parity
      });
    }

    console.log(`[Research] Built ${batchRequests.length} batch requests`);

    // ========================================================================
    // 6. ROUTE TO APPROPRIATE PROVIDER
    // ========================================================================

    if (BATCH_PROVIDER === 'openrouter') {
      // ====================================================================
      // OPENROUTER PATH - Chunked processing with self-continuation
      // ====================================================================
      console.log(`[Research] Using OpenRouter (BATCH_PROVIDER=${BATCH_PROVIDER})`);

      const CHUNK_SIZE = 8;

      // Build contexts and slide ID mapping
      const allContexts: TeachingUnitContext[] = [];
      const slideIdMapping: Record<string, string> = {};
      const researchMap = new Map<string, ResearchContext>();

      for (const unit of units) {
        const researchData = researchByUnit.get(unit.id);
        if (!researchData) continue;

        allContexts.push(researchData.context);
        researchMap.set(unit.id, researchData.research);

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

      // Filter to units that still need processing
      const { data: pendingSlides } = await supabase
        .from('lecture_slides')
        .select('teaching_unit_id, status')
        .eq('batch_job_id', batch_job_id)
        .in('status', ['preparing', 'batch_pending', 'generating', 'pending']);

      const pendingUnitIds = new Set((pendingSlides || []).map(s => s.teaching_unit_id));
      const unitsStillPending = allContexts.filter(u => pendingUnitIds.has(u.id));

      console.log(`[Research] ${unitsStillPending.length}/${allContexts.length} units still need processing`);

      if (unitsStillPending.length === 0) {
        const { data: slideStats } = await supabase
          .from('lecture_slides')
          .select('status')
          .eq('batch_job_id', batch_job_id);

        const completed = slideStats?.filter(s => s.status === 'ready' || s.status === 'completed').length || 0;
        const failedCount = slideStats?.filter(s => s.status === 'failed').length || 0;

        await supabase
          .from('batch_jobs')
          .update({
            status: failedCount === 0 ? 'completed' : (completed > 0 ? 'partial' : 'failed'),
            completed_at: new Date().toISOString(),
            succeeded_count: completed,
            failed_count: failedCount,
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
            failed: failedCount,
            total: allContexts.length,
            message: `Batch complete: ${completed} succeeded, ${failedCount} failed`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Take only CHUNK_SIZE units for this invocation
      const chunkToProcess = unitsStillPending.slice(0, CHUNK_SIZE);
      const remainingCount = unitsStillPending.length - chunkToProcess.length;

      console.log(`[Research] Processing chunk of ${chunkToProcess.length} units (${remainingCount} remaining)`);

      const result = await processBatchViaOpenRouter(
        supabase,
        batch_job_id,
        chunkToProcess,
        slideIdMapping,
        researchMap,
        course.detected_domain || 'general'
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
            message: `Processed ${result.processed}/${chunkToProcess.length}. ${remainingCount} remaining. Self-continuing...`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Final chunk
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
          total: allContexts.length,
          errors: result.errors.slice(0, 10),
          message: `Batch complete via OpenRouter: ${completedSoFar} succeeded, ${failedSoFar} failed`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ======================================================================
    // VERTEX AI PATH - Upload to GCS and create batch job
    // ======================================================================
    console.log(`[Research] Using Vertex AI (BATCH_PROVIDER=${BATCH_PROVIDER})`);

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

    const requestMappingKeys = Object.keys(requestMapping);
    const jsonlLines = batchRequests.map((req, idx) => ({
      custom_id: requestMappingKeys[idx],
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

    // Create Vertex AI batch job
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
      const errorMessage = createError instanceof Error ? createError.message : String(createError);
      console.error('[Research] Vertex AI job creation failed:', errorMessage);

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

    // Update records
    await supabase
      .from('batch_jobs')
      .update({
        google_batch_id: googleBatchId,
        status: 'submitted',
        request_mapping: requestMapping,
        output_uri: outputPrefix,
        provider: 'vertex',
      })
      .eq('id', batch_job_id);

    await supabase
      .from('lecture_slides')
      .update({ status: 'batch_pending' })
      .eq('batch_job_id', batch_job_id);

    console.log(`[Research] Batch ${batch_job_id} submitted via Vertex AI`);

    return new Response(
      JSON.stringify({
        success: true,
        batch_job_id,
        google_batch_id: googleBatchId,
        provider: 'vertex',
        total: batchRequests.length,
        status: 'submitted',
        message: `Research complete, ${batchRequests.length} slides submitted to Vertex AI`,
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
