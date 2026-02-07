// ============================================================================
// PROCESS BATCH IMAGES - Queue-Based Async Image Generation via Unified AI
// ============================================================================
//
// PURPOSE: Generate images for slides using a queue-based, self-continuing
// architecture. Processes items from image_generation_queue table in small
// batches to avoid edge function timeouts.
//
// PROVIDER TOGGLE (Updated 2026-02-06):
//   - Controlled by IMAGE_PROVIDER environment variable
//   - 'openrouter' (default): Uses OpenRouter API (OPENROUTER_API_KEY)
//   - 'google': Uses native Google Generative Language API (GOOGLE_CLOUD_API_KEY)
//
// ARCHITECTURE:
//   1. Fetch N pending items from queue (batch of 1-2)
//   2. Generate images via Unified AI Client (routes based on IMAGE_PROVIDER)
//   3. Upload to Supabase storage
//   4. Update queue status + lecture_slides records
//   5. If more pending items exist, self-invoke to continue
//
// TRIGGER MODES:
//   - { continue: true } - Process next batch from queue
//   - { lecture_slides_id } - Process specific lecture (for manual triggers)
//   - { lecture_slides_ids } - Process multiple lectures
//   - { batch_job_id } - Legacy: populate queue from batch job then process
//
// SELF-CONTINUATION:
//   After processing a batch, if more pending items exist, the function
//   invokes itself to continue processing. This ensures all slides get
//   processed without hitting the 60-second timeout.
//
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { generateImage } from '../_shared/unified-ai-client.ts';
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Process this many items per invocation (stay well under timeout).
// Image generation latency can be unpredictable; keep this low so we always
// have time to sync lecture_slides JSON back to the UI.
const BATCH_SIZE = 1;

// Max concurrent image generations per batch (reduced to avoid rate limits)
const MAX_CONCURRENT = 1;

// Delay between items to avoid rate limiting
const BATCH_DELAY_MS = 2000;

// ============================================================================
// TYPES
// ============================================================================

interface QueueItem {
  id: string;
  lecture_slides_id: string;
  slide_index: number;
  slide_title: string | null;
  prompt: string;
  status: string;
  attempts: number;
  max_attempts: number;
}

interface VisualDirective {
  type: string;
  description: string;
  elements?: string[];
  style?: string;
  educational_purpose?: string;
}

interface Slide {
  order: number;
  type: string;
  title: string;
  content: Record<string, unknown>;
  visual_directive?: VisualDirective;
  visual?: {
    type?: string;
    url: string | null;
    alt_text: string;
    fallback_description: string;
    elements?: string[];
    style?: string;
    educational_purpose?: string;
    source?: string;
  };
  speaker_notes?: string;
  estimated_seconds?: number;
  pedagogy?: Record<string, unknown>;
}

interface LectureSlideRecord {
  id: string;
  teaching_unit_id: string;
  instructor_course_id: string;
  title: string;
  slides: Slide[];
  status: string;
  generation_phases?: Record<string, unknown>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Infer visual directive from slide content if not explicitly provided
 * 
 * Handles both v2 (visual_directive) and v3 (visual) slide formats.
 */
function inferVisualDirective(slide: Slide): VisualDirective | null {
  // Check if slide already has visual_directive (v2 format) with actual type
  if (slide.visual_directive?.type && slide.visual_directive.type !== 'none') {
    return slide.visual_directive;
  }
  
  // Check if slide has visual (v3 format) that needs generation
  // v3 slides use `visual` directly with url: null for images that need generation
  if (slide.visual?.type && slide.visual.type !== 'none' && !slide.visual.url) {
    return {
      type: slide.visual.type,
      description: slide.visual.fallback_description || slide.visual.alt_text || `Visual for: ${slide.title}`,
      elements: slide.visual.elements || [],
      style: slide.visual.style || 'clean academic professional',
      educational_purpose: slide.visual.educational_purpose || `Illustrate ${slide.title}`,
    };
  }
  
  // Skip certain slide types that rarely need custom visuals
  const skipTypes = ['conclusion', 'recap', 'further_reading'];
  if (skipTypes.includes(slide.type?.toLowerCase() || '')) {
    return null;
  }
  
  // Infer from slide content
  const content = slide.content || {};
  const title = slide.title || '';
  const mainText = typeof content.main_text === 'string' ? content.main_text : '';
  const keyPoints = Array.isArray(content.key_points) ? content.key_points : [];

  // Build description from available content
  const conceptText = keyPoints.slice(0, 2).join(' ') || mainText.slice(0, 300);

  if (!conceptText && !title) {
    return null; // Not enough content to infer
  }

  // Determine visual type based on slide type
  let visualType = 'diagram';
  if (slide.type === 'example' || slide.type === 'case_study') {
    visualType = 'illustration';
  } else if (slide.type === 'comparison') {
    visualType = 'infographic';
  }

  // Extract concrete label candidates from key points (first few words of each)
  const labelCandidates = keyPoints
    .slice(0, 4)
    .map((p: unknown) => {
      if (typeof p !== 'string') return '';
      // Extract the first meaningful phrase (up to 3 words) from each key point
      const words = p.replace(/^[-•*]\s*/, '').trim().split(/\s+/).slice(0, 3).join(' ');
      return words.slice(0, 25);
    })
    .filter((s: string) => s.length > 0);

  // Build a concrete description instead of a generic one
  const descriptionParts = [
    `Diagram showing the concept of "${title}"`,
    conceptText ? `illustrating: ${conceptText.slice(0, 300)}` : '',
    labelCandidates.length > 0 ? `Key elements: ${labelCandidates.join(', ')}` : '',
  ].filter(Boolean);

  return {
    type: visualType,
    description: descriptionParts.join('. ').slice(0, 500),
    elements: labelCandidates.length > 0
      ? labelCandidates
      : [title].filter(Boolean),
    style: 'clean academic professional',
    educational_purpose: `Illustrate the core concept of ${title}`,
  };
}

/**
 * Simplify a label string for reliable Imagen 4 Ultra text rendering.
 * Returns max 2 common words, max 20 chars. Shorter = more accurate rendering.
 */
function simplifyLabel(raw: string): string {
  const cleaned = raw
    .replace(/[^\w\s\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // 2 words max for reliable rendering (Imagen sweet spot)
  const words = cleaned.split(' ').slice(0, 2).join(' ');
  return words.slice(0, 20);
}

/**
 * Build image generation prompt from slide and directive.
 *
 * PROMPT STRATEGY (2026-02-07):
 * Imagen 4 Ultra produces best results with natural, descriptive language
 * that reads like a scene description — NOT structured rule-lists or
 * meta-instructions. Key principles:
 *   - Describe the finished image as one flowing paragraph
 *   - Embed exact label text naturally (e.g., "a box labeled 'Input'")
 *   - Specify spatial positions concretely (left, center, right)
 *   - End with style — content first, aesthetics second
 *   - Never include meta-instructions (aspect ratio, font size) as they
 *     get rendered as visible text by the model
 */
function buildImagePrompt(
  slide: Slide,
  lectureTitle: string,
  domain?: string
): string {
  const directive = inferVisualDirective(slide);
  if (!directive) return '';

  // Extract short labels from directive.elements
  const rawElements = directive.elements || [];
  const labels = rawElements
    .slice(0, 5)
    .map(el => simplifyLabel(el))
    .filter(l => l.length > 0);

  // Full description context (up to 500 chars)
  const description = directive.description?.slice(0, 500) || slide.title;
  const topicContext = domain ? `${lectureTitle} in ${domain}` : lectureTitle;

  // Build natural-language prompt based on visual type
  switch (directive.type) {
    case 'flowchart':
    case 'flow': {
      const stepsNarrative = labels.length > 0
        ? labels.map((l, i) => {
            const position = i === 0 ? 'On the far left' : i === labels.length - 1 ? 'On the far right' : 'Next';
            return `${position}, a rounded blue rectangle with a relevant flat icon and the label "${l}" in bold white text`;
          }).join('. ') + '.'
        : `Multiple stages shown as rounded blue rectangles, each with a relevant flat icon, connected left to right. ${description}`;

      return `A clean academic flowchart for a lecture on ${topicContext}. ${stepsNarrative} Each stage is connected to the next by a thick gray arrow pointing right. White background, flat design, professional educational style, widescreen layout.`;
    }

    case 'comparison':
    case 'infographic': {
      if (labels.length >= 2) {
        return `A clean academic comparison diagram for a lecture on ${topicContext}. Two equal-sized panels side by side. The left panel has a light background with the heading "${labels[0]}" in bold dark text and relevant flat icons below. The right panel has a dark background with the heading "${labels[1]}" in bold white text and relevant flat icons below. A large "VS" sits centered between the panels. ${labels.length > 2 ? `Additional elements: ${labels.slice(2).map(l => `"${l}"`).join(', ')}. ` : ''}Professional educational style, balanced layout, widescreen format.`;
      }
      return `A clean academic comparison diagram for a lecture on ${topicContext}. ${description}. Two distinct panels with contrasting backgrounds, each with relevant flat icons and bold headings. Professional educational style, balanced layout, widescreen format.`;
    }

    case 'illustration':
    case 'chart': {
      const elementsNarrative = labels.length > 0
        ? `Key elements shown: ${labels.map(l => `"${l}"`).join(', ')}, each represented with a relevant flat icon.`
        : '';
      return `A detailed academic illustration for a lecture on ${topicContext}. ${description}. ${elementsNarrative} Clean flat design with a professional color palette, white background, widescreen educational format.`;
    }

    case 'diagram':
    default: {
      if (labels.length > 0) {
        const centerLabel = labels[0];
        const surrounding = labels.slice(1);
        const surroundingNarrative = surrounding.length > 0
          ? ` Surrounding it, ${surrounding.map(l => `a shape labeled "${l}"`).join(', ')}, each connected to the center with arrows.`
          : '';
        return `A clean academic diagram for a lecture on ${topicContext}. In the center, a prominent shape labeled "${centerLabel}" with a relevant flat icon.${surroundingNarrative} ${description}. Professional educational style with a blue and gray color palette, white background, flat design, widescreen layout.`;
      }
      return `A clean academic diagram for a lecture on ${topicContext}. ${description}. Elements shown as labeled shapes connected by arrows, each with relevant flat icons. Professional educational style, blue and gray palette, white background, flat design, widescreen layout.`;
    }
  }
}

// ============================================================================
// QUEUE OPERATIONS
// ============================================================================

/**
 * Reset stale 'processing' items back to 'pending' so they can be retried.
 * Protects against timeouts/crashes between markAsProcessing() and updateQueueItem().
 */
async function resetStaleProcessingItems(
  supabase: SupabaseClient,
  staleMinutes = 15
): Promise<void> {
  const cutoffIso = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('image_generation_queue')
    .update({
      status: 'pending',
      error_message: 'Reset stale processing item for retry',
    })
    .eq('status', 'processing')
    .lt('started_at', cutoffIso)
    .select('id');

  if (error) {
    console.error('[Queue] Failed to reset stale processing items:', error);
    return;
  }

  const resetCount = (data || []).length;
  if (resetCount > 0) {
    console.log(`[Queue] Reset ${resetCount} stale processing item(s) to pending`);
  }
}

/**
 * Fetch pending items from the queue
 */
async function fetchPendingItems(
  supabase: SupabaseClient,
  limit: number
): Promise<QueueItem[]> {
  const { data, error } = await supabase
    .from('image_generation_queue')
    .select('id, lecture_slides_id, slide_index, slide_title, prompt, status, attempts, max_attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[Queue] Failed to fetch pending items:', error);
    return [];
  }

  return data || [];
}

/**
 * Mark queue items as processing
 */
async function markAsProcessing(
  supabase: SupabaseClient,
  ids: string[]
): Promise<void> {
  await supabase
    .from('image_generation_queue')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
    })
    .in('id', ids);
}

/**
 * Update queue item with result
 */
async function updateQueueItem(
  supabase: SupabaseClient,
  id: string,
  success: boolean,
  imageUrl: string | null,
  errorMessage: string | null,
  currentAttempts: number,
  maxAttempts: number
): Promise<void> {
  const newAttempts = currentAttempts + 1;
  
  let status: string;
  if (success) {
    status = 'completed';
  } else if (newAttempts >= maxAttempts) {
    status = 'failed';
  } else {
    status = 'pending'; // Will retry
  }

  await supabase
    .from('image_generation_queue')
    .update({
      status,
      attempts: newAttempts,
      image_url: imageUrl,
      error_message: errorMessage,
      processed_at: new Date().toISOString(),
    })
    .eq('id', id);
}

/**
 * Get count of remaining pending items
 */
async function getPendingCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('image_generation_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) {
    console.error('[Queue] Failed to get pending count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Get queue stats for a lecture
 */
async function getLectureQueueStats(
  supabase: SupabaseClient,
  lectureSlideId: string
): Promise<{ total: number; completed: number; failed: number; pending: number }> {
  const { data, error } = await supabase
    .from('image_generation_queue')
    .select('status')
    .eq('lecture_slides_id', lectureSlideId);

  if (error || !data) {
    return { total: 0, completed: 0, failed: 0, pending: 0 };
  }

  return {
    total: data.length,
    completed: data.filter(d => d.status === 'completed').length,
    failed: data.filter(d => d.status === 'failed').length,
    pending: data.filter(d => d.status === 'pending' || d.status === 'processing').length,
  };
}

// ============================================================================
// IMAGE PROCESSING
// ============================================================================

/**
 * Process a single queue item: generate image and upload to storage
 */
async function processQueueItem(
  supabase: SupabaseClient,
  item: QueueItem
): Promise<{ success: boolean; imageUrl: string | null; error: string | null }> {
  const logPrefix = `[Image ${item.slide_index}]`;
  const imageProvider = Deno.env.get('IMAGE_PROVIDER') || 'openrouter';

  try {
    console.log(`${logPrefix} Generating for: ${item.slide_title || 'Untitled'} (provider: ${imageProvider})`);

    // Generate image via Unified AI Client (routes to OpenRouter or Google based on IMAGE_PROVIDER)
    const result = await generateImage({
      prompt: item.prompt,
      slideTitle: item.slide_title || undefined,
      logPrefix: logPrefix,
    });

    // Handle discriminated union: check result.success
    if (!result.success) {
      return { success: false, imageUrl: null, error: result.error.message };
    }

    // Upload to Supabase storage (success case)
    const fileName = `slide_${item.lecture_slides_id}_${item.slide_index}_${Date.now()}.png`;
    const fileData = base64ToUint8Array(result.base64);

    const { error: uploadError } = await supabase.storage
      .from('lecture-visuals')
      .upload(fileName, fileData, {
        contentType: result.mimeType || 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error(`${logPrefix} Upload error:`, uploadError);
      return { success: false, imageUrl: null, error: `Upload failed: ${uploadError.message}` };
    }

    // Store the file path (not URL) - the frontend's AuthenticatedImage will create signed URLs
    // The bucket is private, so getPublicUrl() returns an inaccessible URL
    console.log(`${logPrefix} Success: ${fileName} (private bucket)`);
    return { success: true, imageUrl: fileName, error: null };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} Error:`, errorMsg);
    return { success: false, imageUrl: null, error: errorMsg };
  }
}

/**
 * Update lecture_slides record with generated image URLs
 */
async function updateLectureSlides(
  supabase: SupabaseClient,
  lectureSlideId: string
): Promise<void> {
  // Get current lecture slides
  const { data: lecture, error: fetchError } = await supabase
    .from('lecture_slides')
    .select('slides, title, generation_phases')
    .eq('id', lectureSlideId)
    .single();

  if (fetchError || !lecture) {
    console.error('[Update] Failed to fetch lecture:', fetchError);
    return;
  }

  // Get all completed queue items for this lecture
  const { data: completedItems, error: queueError } = await supabase
    .from('image_generation_queue')
    .select('slide_index, image_url')
    .eq('lecture_slides_id', lectureSlideId)
    .eq('status', 'completed')
    .not('image_url', 'is', null);

  if (queueError || !completedItems) {
    console.error('[Update] Failed to fetch completed items:', queueError);
    return;
  }

  // Build map of slide_index -> image_url
  const imageMap = new Map(completedItems.map(item => [item.slide_index, item.image_url]));

  // Update slides with image URLs
  const slides = (lecture.slides || []) as Slide[];
  let updatedCount = 0;

  const updatedSlides = slides.map((slide, index) => {
    const imageUrl = imageMap.get(index);
    if (imageUrl && (!slide.visual?.url)) {
      updatedCount++;
      return {
        ...slide,
        visual: {
          url: imageUrl,
          alt_text: slide.visual_directive?.description || slide.title || '',
          fallback_description: slide.visual_directive?.description || '',
          educational_purpose: slide.visual_directive?.educational_purpose,
          source: 'ai_generated_unified',
        },
      };
    }
    return slide;
  });

  // Get queue stats
  const stats = await getLectureQueueStats(supabase, lectureSlideId);

  // Update lecture record
  const isComplete = stats.pending === 0;
  const phases = (lecture.generation_phases || {}) as Record<string, unknown>;

  await supabase
    .from('lecture_slides')
    .update({
      slides: updatedSlides,
      generation_phases: {
        ...phases,
        images_completed: isComplete ? new Date().toISOString() : null,
        images_generated: stats.completed,
        images_failed: stats.failed,
        images_pending: stats.pending,
        current_phase: isComplete ? 'complete' : 'images_processing',
        progress_percent: stats.total > 0 
          ? Math.round(((stats.completed + stats.failed) / stats.total) * 100) 
          : 0,
        message: isComplete 
          ? `Generated ${stats.completed} images (${stats.failed} failed)`
          : `Processing images: ${stats.completed}/${stats.total}`,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', lectureSlideId);

  if (updatedCount > 0) {
    console.log(`[Update] Updated ${updatedCount} slides for lecture ${lectureSlideId}`);
  }
}

// ============================================================================
// QUEUE POPULATION
// ============================================================================

/**
 * Populate queue from lecture slides (for initial setup or manual trigger)
 */
async function populateQueueFromLecture(
  supabase: SupabaseClient,
  lectureSlideId: string,
  domain?: string
): Promise<number> {
  // Fetch lecture
  const { data: lecture, error } = await supabase
    .from('lecture_slides')
    .select('id, title, slides, instructor_course_id')
    .eq('id', lectureSlideId)
    .single();

  if (error || !lecture) {
    console.error('[Populate] Failed to fetch lecture:', error);
    return 0;
  }

  const slides = (lecture.slides || []) as Slide[];
  const queueItems: Array<{
    lecture_slides_id: string;
    slide_index: number;
    slide_title: string;
    prompt: string;
    status: string;
  }> = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    
    // Skip if already has image
    if (slide.visual?.url) continue;
    
    // Build prompt (will return empty if slide doesn't need image)
    const prompt = buildImagePrompt(slide, lecture.title, domain);
    if (!prompt) continue;

    queueItems.push({
      lecture_slides_id: lecture.id,
      slide_index: i,
      slide_title: slide.title || `Slide ${i + 1}`,
      prompt,
      status: 'pending',
    });
  }

  if (queueItems.length === 0) {
    console.log(`[Populate] No slides need images for ${lectureSlideId}`);
    return 0;
  }

  // Insert items (upsert to handle re-runs)
  const { error: insertError } = await supabase
    .from('image_generation_queue')
    .upsert(queueItems, {
      onConflict: 'lecture_slides_id,slide_index',
      ignoreDuplicates: true,
    });

  if (insertError) {
    console.error('[Populate] Failed to insert queue items:', insertError);
    return 0;
  }

  console.log(`[Populate] Added ${queueItems.length} items to queue for ${lectureSlideId}`);
  return queueItems.length;
}

// ============================================================================
// SELF-CONTINUATION
// ============================================================================

/**
 * Trigger self-invocation to continue processing
 */
async function triggerContinuation(
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<void> {
  const url = `${supabaseUrl}/functions/v1/process-batch-images`;
  
  console.log('[Continue] Triggering self-continuation...');
  
  // Fire and don't wait - we're already returning a response
  fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ continue: true }),
  }).catch(err => {
    console.error('[Continue] Self-invocation error:', err);
  });
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);
  const functionName = '[process-batch-images]';
  const startTime = Date.now();
  console.log(`${functionName} Starting...`);

  try {
    // Parse request
    const body = await req.json().catch(() => ({}));
    const { 
      continue: continueProcessing, 
      lecture_slides_id, 
      lecture_slides_ids,
      batch_job_id,
      instructor_course_id,
      sync_only, // New: just sync completed images to slides without generating
    } = body;

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ========================================================================
    // MODE 0: Sync Only - Sync completed images to lecture_slides
    // ========================================================================
    if (sync_only && (lecture_slides_id || lecture_slides_ids)) {
      const ids = lecture_slides_ids || [lecture_slides_id];
      console.log(`${functionName} Sync-only mode for ${ids.length} lectures`);
      
      for (const id of ids) {
        await updateLectureSlides(supabase, id);
      }
      
      return createSuccessResponse({
        success: true,
        message: `Synced images for ${ids.length} lectures`,
        synced: ids.length,
      }, corsHeaders);
    }

    // ========================================================================
    // MODE 1: Continue processing from queue
    // ========================================================================
    if (continueProcessing) {
      console.log(`${functionName} Continue mode - processing from queue`);

      // Safety: reset any stale "processing" items so they don't get stuck forever
      await resetStaleProcessingItems(supabase);
      
      // Fetch pending items
      const pendingItems = await fetchPendingItems(supabase, BATCH_SIZE);
      
      if (pendingItems.length === 0) {
        console.log(`${functionName} No pending items in queue`);
        return createSuccessResponse({
          success: true,
          message: 'No pending items to process',
          processed: 0,
        }, corsHeaders);
      }

      console.log(`${functionName} Processing ${pendingItems.length} items`);

      // Mark items as processing
      await markAsProcessing(supabase, pendingItems.map(i => i.id));

      // Process in concurrent batches
      let processedCount = 0;
      let successCount = 0;

      for (let i = 0; i < pendingItems.length; i += MAX_CONCURRENT) {
        const batch = pendingItems.slice(i, i + MAX_CONCURRENT);
        
        const results = await Promise.all(
          batch.map(async (item) => {
            const result = await processQueueItem(supabase, item);
            
            // Update queue item
            await updateQueueItem(
              supabase,
              item.id,
              result.success,
              result.imageUrl,
              result.error,
              item.attempts,
              item.max_attempts
            );

             // CRITICAL: sync lecture_slides JSON immediately so UI updates even
             // if this invocation times out later.
             await updateLectureSlides(supabase, item.lecture_slides_id);
            processedCount++;
            if (result.success) successCount++;

            return result;
          })
        );

        // Delay between concurrent batches
        if (i + MAX_CONCURRENT < pendingItems.length) {
          await sleep(BATCH_DELAY_MS);
        }
      }

      // Check if more items remain
      const remainingCount = await getPendingCount(supabase);
      
      // Trigger continuation if items remain
      if (remainingCount > 0) {
        await triggerContinuation(supabaseUrl, serviceRoleKey);
      }

      const elapsed = Date.now() - startTime;
      console.log(`${functionName} Completed: ${successCount}/${processedCount} successful, ${remainingCount} remaining, ${elapsed}ms`);

      return createSuccessResponse({
        success: true,
        processed: processedCount,
        succeeded: successCount,
        failed: processedCount - successCount,
        remaining: remainingCount,
        continuing: remainingCount > 0,
        elapsed_ms: elapsed,
      }, corsHeaders);
    }

    // ========================================================================
    // MODE 2: Process specific lecture(s) - populate queue first
    // ========================================================================
    if (lecture_slides_id || lecture_slides_ids) {
      const ids = lecture_slides_ids || [lecture_slides_id];
      console.log(`${functionName} Processing ${ids.length} specific lectures`);

      let totalQueued = 0;
      for (const id of ids) {
        const queued = await populateQueueFromLecture(supabase, id);
        totalQueued += queued;
      }

      if (totalQueued > 0) {
        // Trigger processing
        await triggerContinuation(supabaseUrl, serviceRoleKey);
      }

      return createSuccessResponse({
        success: true,
        message: `Queued ${totalQueued} slides for image generation`,
        lectures_processed: ids.length,
        slides_queued: totalQueued,
      }, corsHeaders);
    }

    // ========================================================================
    // MODE 3: Legacy batch_job_id mode - populate queue from batch
    // ========================================================================
    if (batch_job_id) {
      console.log(`${functionName} Legacy mode - populating queue from batch ${batch_job_id}`);

      // Get all lectures from this batch
      const { data: lectures, error } = await supabase
        .from('lecture_slides')
        .select('id, instructor_course_id')
        .eq('batch_job_id', batch_job_id)
        .eq('status', 'ready');

      if (error || !lectures || lectures.length === 0) {
        console.log(`${functionName} No ready lectures found for batch`);
        return createSuccessResponse({
          success: true,
          message: 'No lectures found for batch',
          processed: 0,
        }, corsHeaders);
      }

      // Get domain from course
      let domain: string | undefined;
      if (lectures[0].instructor_course_id) {
        const { data: course } = await supabase
          .from('instructor_courses')
          .select('detected_domain')
          .eq('id', lectures[0].instructor_course_id)
          .single();
        domain = course?.detected_domain || undefined;
      }

      // Populate queue for all lectures
      let totalQueued = 0;
      for (const lecture of lectures) {
        const queued = await populateQueueFromLecture(supabase, lecture.id, domain);
        totalQueued += queued;
      }

      if (totalQueued > 0) {
        // Trigger processing
        await triggerContinuation(supabaseUrl, serviceRoleKey);
      }

      return createSuccessResponse({
        success: true,
        message: `Queued ${totalQueued} slides from ${lectures.length} lectures`,
        lectures_processed: lectures.length,
        slides_queued: totalQueued,
      }, corsHeaders);
    }

    // ========================================================================
    // MODE 4: instructor_course_id - process all slides for a course
    // ========================================================================
    if (instructor_course_id) {
      console.log(`${functionName} Course mode - processing all slides for course ${instructor_course_id}`);

      // Get all ready lectures for this course
      const { data: lectures, error } = await supabase
        .from('lecture_slides')
        .select('id')
        .eq('instructor_course_id', instructor_course_id)
        .eq('status', 'ready');

      if (error || !lectures || lectures.length === 0) {
        console.log(`${functionName} No ready lectures found for course`);
        return createSuccessResponse({
          success: true,
          message: 'No ready lectures found for course',
          queued: 0,
        }, corsHeaders);
      }

      // Get domain from course
      const { data: course } = await supabase
        .from('instructor_courses')
        .select('detected_domain')
        .eq('id', instructor_course_id)
        .single();
      const domain = course?.detected_domain || undefined;

      // Populate queue for all lectures
      let totalQueued = 0;
      for (const lecture of lectures) {
        const queued = await populateQueueFromLecture(supabase, lecture.id, domain);
        totalQueued += queued;
      }

      if (totalQueued > 0) {
        // Trigger processing
        await triggerContinuation(supabaseUrl, serviceRoleKey);
      }

      return createSuccessResponse({
        success: true,
        message: `Queued ${totalQueued} slides from ${lectures.length} lectures`,
        queued: totalQueued,
        lectures: lectures.length,
      }, corsHeaders);
    }

    // ========================================================================
    // No valid mode specified
    // ========================================================================
    return createErrorResponse('BAD_REQUEST', corsHeaders, 'Specify continue:true, lecture_slides_id, lecture_slides_ids, batch_job_id, or instructor_course_id');

  } catch (error) {
    logError("process-batch-images", error instanceof Error ? error : new Error(String(error)), { action: "processing" });
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : String(error));
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
