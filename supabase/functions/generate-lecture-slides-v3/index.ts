import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { generateText, MODELS } from '../_shared/unified-ai-client.ts';
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";
import { checkRateLimit, getUserLimits, createRateLimitResponse } from "../_shared/rate-limiter.ts";

// Shared slide system modules (consolidated from duplicated code)
import type { ProfessorSlide, ResearchContext, StoredSlide, TeachingUnitContext } from '../_shared/slide-types.ts';
import { PROFESSOR_SYSTEM_PROMPT, buildLectureBrief, mergeResearchIntoBrief, buildUserPrompt, parseJsonFromAI } from '../_shared/slide-prompts.ts';
import { fetchTeachingUnitContext } from '../_shared/context-fetcher.ts';
import { runResearchAgent, getEmptyResearchContext } from '../_shared/research-agent.ts';
import { calculateQualityMetrics } from '../_shared/quality-metrics.ts';
import { buildImagePrompt } from '../_shared/image-prompt-builder.ts';

// ============================================================================
// AI ROUTING ARCHITECTURE (Updated 2026-01-22)
// ============================================================================
//
// CURRENT ROUTING:
//   | Operation      | Provider   | Model                              |
//   |----------------|------------|------------------------------------|
//   | Professor AI   | OpenRouter | google/gemini-3-flash-preview      |
//   | Images         | OpenRouter | google/gemini-3-pro-image-preview  |
//   | Research Agent | OpenRouter | perplexity/sonar-pro               |
//
// All AI operations route through OpenRouter via unified-ai-client.ts

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as any).message;
    if (typeof msg === 'string' && msg.length) return msg;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

// ============================================================================
// PROFESSOR AI - Main content generation
// ============================================================================

async function runProfessorAI(
  context: TeachingUnitContext,
  groundedBrief: string,
): Promise<ProfessorSlide[]> {
  console.log('[Professor AI] Starting lecture generation');

  // Use the shared canonical prompt template (eliminates drift between v3 and batch)
  const userPrompt = buildUserPrompt(context, groundedBrief, 6);

  // NOTE: The 85-line inline prompt that was here has been replaced by the shared
  // buildUserPrompt() from _shared/slide-prompts.ts — the canonical prompt template
  // that is also used by process-batch-research, eliminating prompt drift.
  /* eslint-disable -- removed dead inline prompt, see git history
4. Bloom level dictates cognitive depth:
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
   - Describes a sequence/process (A \u2192 B \u2192 C) \u2192 type: "flow", segments: ["Step A", "Step B", "Step C"]
   - Compares two things (X vs Y, X = this; Y = that) \u2192 type: "comparison", left_right: ["X", "Y"]
   - Contains formula/relationship (X = Y + Z) \u2192 type: "equation", formula: "X = Y + Z"
   - Notable quote or key principle \u2192 type: "quote"
   - Important insight or tip \u2192 type: "callout"
   - Multiple items in a list \u2192 type: "list"
   - Simple paragraph \u2192 type: "plain"
   - Always include emphasis_words: 2-4 critical terms to highlight

7. OPTIONAL FIELDS HANDLING (CRITICAL):
   - The fields "definition", "example", "misconception", and "steps" are OPTIONAL
   - ONLY include these fields if the slide type genuinely warrants them
   - DO NOT fill optional fields with "N/A", "Not applicable", placeholder text, or empty values
   - If a field doesn't apply to the slide type, OMIT the key entirely from the JSON

OUTPUT (JSON array of slides):
{
  "slides": [
    {
      "order": 1,
      "type": "title",
      "title": "Engaging title",
      "content": {
        "main_text": "...",
        "main_text_layout": { "type": "plain", "emphasis_words": ["term"] },
        "key_points": ["..."],
        "key_points_layout": [{ "type": "flow", "segments": ["A", "B", "C"] }]
      },
      "visual_directive": {
        "type": "illustration",
        "description": "Detailed description for image generation",
        "elements": ["element1"],
        "style": "clean academic",
        "educational_purpose": "..."
      },
      "speaker_notes": "200-300 words...",
      "estimated_seconds": 90,
      "pedagogy": {
        "purpose": "...",
        "bloom_action": "...",
        "transition_to_next": "..."
      }
    }
  ]
}

end of removed dead prompt */

  // Use unified AI client for Professor AI (with fallbacks)
  // NOTE: Do NOT use json: true - the prompt expects markdown-wrapped JSON which parseJsonFromAI handles
  const aiResult = await generateText({
    prompt: userPrompt,
    systemPrompt: PROFESSOR_SYSTEM_PROMPT,
    model: MODELS.PROFESSOR_AI,
    temperature: 0.4,
    maxTokens: 16000,
    fallbacks: [MODELS.PROFESSOR_AI_FALLBACK],
    logPrefix: '[Professor AI]'
  });
  const result = aiResult.content;

  try {
    const parsed = parseJsonFromAI(result);
    const slides = parsed.slides || parsed;

    if (!Array.isArray(slides)) {
      throw new Error('Response is not an array of slides');
    }

    console.log(`[Professor AI] Generated ${slides.length} slides`);
    return slides;
  } catch (error) {
    console.error('[Professor AI] Parse error:', error);
    throw new Error('Failed to parse Professor AI response');
  }
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

async function updateProgress(
  supabase: any,
  slideId: string,
  phase: string,
  percent: number,
  message: string
): Promise<void> {
  try {
    await supabase
      .from('lecture_slides')
      .update({
        generation_phases: {
          current_phase: phase,
          progress_percent: percent,
          message,
          updated_at: new Date().toISOString(),
        },
      })
      .eq('id', slideId);
  } catch (error) {
    console.warn('[Progress] Update failed:', error);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);
  const startTime = Date.now();

  const {
    teaching_unit_id,
    style = 'standard',
    regenerate = false,
    // Support explicit user_id for service role calls from queue processor
    user_id: explicitUserId,
    _from_queue = false,
  } = await req.json();

  if (!teaching_unit_id) {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'teaching_unit_id is required');
  }

  try {
    logInfo('generate-lecture-slides-v3', 'starting', { teachingUnitId: teaching_unit_id, fromQueue: _from_queue });

    console.log(`[Main] === PROFESSOR AI v3 === Starting for: ${teaching_unit_id}`, {
      fromQueue: _from_queue,
      explicitUserId: explicitUserId ? 'provided' : 'none',
    });

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine user ID: from JWT token OR from explicit param (for queue calls)
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let isServiceRoleCall = false;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');

      // Check if this is a service role key (not a user JWT)
      if (token === supabaseKey) {
        // Service role call - use explicit user_id if provided
        isServiceRoleCall = true;
        userId = explicitUserId || null;
        console.log('[Auth] Service role call, using explicit user_id:', userId ? 'present' : 'none');
      } else {
        // Regular user JWT - validate it
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
        console.log('[Auth] User JWT validated:', userId ? 'success' : 'failed');
      }
    }

    // Rate limit check (only if user is authenticated and not a service role call)
    if (userId && !isServiceRoleCall) {
      const limits = await getUserLimits(supabase, userId);
      const rateLimitResult = await checkRateLimit(supabase, userId, 'generate-lecture-slides-v3', limits);
      if (!rateLimitResult.allowed) {
        return createRateLimitResponse(rateLimitResult, corsHeaders);
      }
    }

    // PHASE 1: Fetch complete context (from shared context-fetcher)
    console.log('[Main] === PHASE 1: CONTEXT GATHERING ===');
    const context = await fetchTeachingUnitContext(supabase, teaching_unit_id, userId);

    // Create or update slide record in a single atomic operation.
    const upsertPayload: any = {
      teaching_unit_id,
      learning_objective_id: context.learning_objective.id,
      instructor_course_id: context.course.id,
      title: context.title,
      status: 'generating',
      error_message: null,
      slide_style: style,
      generation_phases: {
        started: new Date().toISOString(),
        current_phase: 'professor',
        progress_percent: 0,
        version: 3,
        regenerate: regenerate,
      },
      ...(userId ? { created_by: userId } : {}),
      ...(regenerate ? { slides: [] } : {}),
    };

    const { data: upserted, error: upsertErr } = await supabase
      .from('lecture_slides')
      .upsert(upsertPayload, { onConflict: 'teaching_unit_id' })
      .select('id')
      .single();

    if (upsertErr) throw upsertErr;
    const slideRecordId = upserted.id as string;
    console.log('[Main] Slide record ready:', slideRecordId, regenerate ? '(regenerating)' : '');

    try {
      // PHASE 2: Research Agent (from shared research-agent, now with caching)
      console.log('[Main] === PHASE 2: RESEARCH AGENT ===');
      console.log('[Main] Domain config:', context.domain_config?.domain || 'not configured');
      await updateProgress(supabase, slideRecordId, 'research', 10, 'Research Agent: Gathering verified sources...');

      let researchContext: ResearchContext;
      try {
        // Now passes supabase for research caching (previously only batch path had this)
        researchContext = await runResearchAgent(context, context.domain_config || null, supabase);
        await updateProgress(supabase, slideRecordId, 'research', 30, `Found ${researchContext.grounded_content.length} verified sources`);
      } catch (researchError) {
        console.warn('[Main] Research failed, continuing without grounding:', researchError);
        researchContext = getEmptyResearchContext(context.title);
      }

      // PHASE 2C: Professor AI - Complete lecture generation with research
      console.log('[Main] === PHASE 2C: PROFESSOR AI ===');
      await updateProgress(supabase, slideRecordId, 'professor', 40, 'Professor AI: Synthesizing lecture from research...');

      // Build grounded brief using shared prompt builders
      const baseBrief = buildLectureBrief(context);
      const groundedBrief = mergeResearchIntoBrief(baseBrief, researchContext);

      const slides = await runProfessorAI(context, groundedBrief);
      await updateProgress(supabase, slideRecordId, 'professor', 60, `Generated ${slides.length} slides`);

      console.log('[Main] Professor AI complete:', slides.length, 'slides');

      // PHASE 3: Save slides FIRST (before image generation to avoid timeout)
      console.log('[Main] === PHASE 3: SAVING SLIDES ===');
      await updateProgress(supabase, slideRecordId, 'finalize', 70, 'Saving lecture content...');

      // Build initial slides without visuals - include layout hints from AI
      const initialSlides = slides.map(slide => ({
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
        pedagogy: slide.pedagogy || {
          purpose: '',
          bloom_action: '',
          transition_to_next: '',
        },
        quality_score: 80,
      }));

      // Calculate quality metrics (from shared quality-metrics module)
      const qualityResult = calculateQualityMetrics(slides);
      const qualityScore = qualityResult.score;

      console.log('[Main] Quality metrics:', JSON.stringify(qualityResult.metrics));
      if (qualityResult.warnings.length > 0) {
        console.warn(`[Main] Quality warnings (${qualityResult.warnings.length}):`,
          qualityResult.warnings.slice(0, 5).join('; '));
      }

      // Save slides immediately (before image generation)
      const { error: saveError } = await supabase
        .from('lecture_slides')
        .update({
          slides: initialSlides,
          total_slides: initialSlides.length,
          status: 'ready',
          generation_phases: {
            version: 3,
            slides_saved: new Date().toISOString(),
            current_phase: 'visual',
            progress_percent: 75,
            message: 'Slides ready. Generating visuals...',
          },
          quality_score: qualityScore,
          is_research_grounded: researchContext.grounded_content.length > 0,
          research_context: researchContext.grounded_content.length > 0 ? researchContext : null,
          citation_count: researchContext.grounded_content.length,
          estimated_duration_minutes: Math.round(initialSlides.length * 1.5),
          generation_model: MODELS.PROFESSOR_AI,
        })
        .eq('id', slideRecordId);

      if (saveError) {
        console.error('[Main] Save error:', saveError);
        throw saveError;
      }

      console.log('[Main] Slides saved successfully:', initialSlides.length);

      // PHASE 4: ASYNC IMAGE GENERATION (queue-based to avoid timeout)
      console.log('[Main] === PHASE 4: QUEUE IMAGES (ASYNC) ===');

      const slidesNeedingVisuals = initialSlides
        .filter((s) => {
          const visualType = s.visual?.type;
          return visualType && visualType !== 'none';
        });

      console.log(`[Main] ${slidesNeedingVisuals.length} slides need images - queueing for async generation`);

      if (slidesNeedingVisuals.length > 0) {
        // Build queue items using the shared AI-powered image prompt builder
        // This generates optimized Imagen 4 Ultra prompts from the full slide context
        const queueItems: Array<{
          lecture_slides_id: string;
          slide_index: number;
          slide_title: string;
          prompt: string;
          status: string;
        }> = [];

        for (let index = 0; index < initialSlides.length; index++) {
          const slide = initialSlides[index];
          const visualType = slide.visual?.type;
          if (!visualType || visualType === 'none') continue;

          // Cast to StoredSlide for the shared builder (structurally compatible)
          const storedSlide = slide as unknown as StoredSlide;
          const prompt = await buildImagePrompt(storedSlide, context.title, context.domain);
          if (!prompt) continue;

          queueItems.push({
            lecture_slides_id: slideRecordId,
            slide_index: index,
            slide_title: slide.title || `Slide ${index + 1}`,
            prompt,
            status: 'pending',
          });
        }

        if (queueItems.length > 0) {
          const { error: queueError } = await supabase
            .from('image_generation_queue')
            .upsert(queueItems, {
              onConflict: 'lecture_slides_id,slide_index',
              ignoreDuplicates: false,
            });

          if (queueError) {
            console.warn('[Main] Failed to queue images:', queueError);
          } else {
            console.log(`[Main] Queued ${queueItems.length} images for async generation`);

            // Trigger process-batch-images to start processing
            // IMPORTANT: await the fetch to ensure the request is actually sent
            // before the edge function returns. The image processor runs in its
            // own invocation — we just need to dispatch the trigger reliably.
            try {
              const triggerResp = await fetch(`${supabaseUrl}/functions/v1/process-batch-images`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ continue: true }),
              });
              console.log(`[Main] Image processing trigger: ${triggerResp.status}`);
            } catch (err) {
              console.warn('[Main] Failed to trigger image processing:', err);
            }
          }
        }
      }

      // Update final status
      await supabase
        .from('lecture_slides')
        .update({
          generation_phases: {
            version: 3,
            completed: new Date().toISOString(),
            total_duration_ms: Date.now() - startTime,
            current_phase: slidesNeedingVisuals.length > 0 ? 'images_queued' : 'complete',
            progress_percent: 100,
            images_queued: slidesNeedingVisuals.length,
          },
        })
        .eq('id', slideRecordId);

      const duration = Date.now() - startTime;
      logInfo('generate-lecture-slides-v3', 'complete', {
        slideId: slideRecordId,
        slideCount: initialSlides.length,
        imagesQueued: slidesNeedingVisuals.length,
        durationMs: duration,
      });

      return createSuccessResponse({
        success: true,
        slideId: slideRecordId,
        slideCount: initialSlides.length,
        imagesQueued: slidesNeedingVisuals.length,
        qualityScore: qualityScore,
        durationMs: duration,
        version: 3,
        message: slidesNeedingVisuals.length > 0
          ? `Slides ready. ${slidesNeedingVisuals.length} images generating async.`
          : 'Slides ready. No images needed.',
      }, corsHeaders);

    } catch (agentError) {
      logError('generate-lecture-slides-v3', agentError instanceof Error ? agentError : new Error(String(agentError)));

      await supabase
        .from('lecture_slides')
        .update({
          status: 'failed',
          error_message: getErrorMessage(agentError),
        })
        .eq('id', slideRecordId);

      throw agentError;
    }

  } catch (error) {
    logError('generate-lecture-slides-v3', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, getErrorMessage(error));
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
