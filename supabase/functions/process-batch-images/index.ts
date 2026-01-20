// ============================================================================
// PROCESS BATCH IMAGES - Queue-Based Async Image Generation
// ============================================================================
//
// PURPOSE: Generate images for slides using a queue-based, self-continuing
// architecture. Processes items from image_generation_queue table in small
// batches to avoid edge function timeouts.
//
// ARCHITECTURE:
//   1. Fetch N pending items from queue (batch of 5-8)
//   2. Generate images in parallel using OpenRouter
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
import { generateImage, ImageGenerationResult } from '../_shared/openrouter-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// CONFIGURATION
// ============================================================================

// Process this many items per invocation (stay well under 60s timeout)
const BATCH_SIZE = 6;

// Max concurrent image generations per batch
const MAX_CONCURRENT = 3;

// Delay between concurrent batches to avoid rate limiting
const BATCH_DELAY_MS = 500;

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
    url: string | null;
    alt_text: string;
    fallback_description: string;
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
 */
function inferVisualDirective(slide: Slide): VisualDirective | null {
  // Skip title slides and summary slides
  const skipTypes = ['title_slide', 'summary', 'conclusion', 'recap'];
  if (skipTypes.includes(slide.type?.toLowerCase() || '')) {
    return null;
  }
  
  // Check if slide already has visual directive with actual type
  if (slide.visual_directive?.type && slide.visual_directive.type !== 'none') {
    return slide.visual_directive;
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
  
  return {
    type: visualType,
    description: `Visual representation of: ${title}. Key concepts: ${conceptText.slice(0, 200)}`,
    elements: [title, ...keyPoints.slice(0, 3).map(p => typeof p === 'string' ? p.slice(0, 50) : '')].filter(Boolean),
    style: 'clean academic professional',
    educational_purpose: `Illustrate the core concept of ${title}`,
  };
}

/**
 * Build image generation prompt from slide and directive
 */
function buildImagePrompt(
  slide: Slide,
  lectureTitle: string,
  domain?: string
): string {
  const directive = inferVisualDirective(slide);
  if (!directive) return '';

  return `Create an educational diagram for a university lecture slide.

TOPIC: ${slide.title}
LECTURE: ${lectureTitle}
${domain ? `DOMAIN: ${domain}` : ''}

VISUAL REQUIREMENTS:
- Type: ${directive.type}
- Description: ${directive.description}
- Must include these elements: ${directive.elements?.join(', ') || 'appropriate educational elements'}
- Style: ${directive.style || 'clean academic'}
${directive.educational_purpose ? `- Educational purpose: ${directive.educational_purpose}` : ''}

DESIGN RULES:
- Clean, minimal design suitable for projection
- High contrast (works on both light/dark backgrounds)
- Clear labels on all elements
- No decorative elements, pure information
- Professional academic style
- 16:9 aspect ratio
- Large, readable text (minimum 24pt equivalent)
- Use color strategically to highlight key concepts

IMPORTANT: Generate a clear, educational diagram. Do NOT generate photos of people or realistic photographs.`;
}

// ============================================================================
// QUEUE OPERATIONS
// ============================================================================

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
  
  try {
    console.log(`${logPrefix} Generating for: ${item.slide_title || 'Untitled'}`);

    // Generate image using OpenRouter
    const result = await generateImage(item.prompt, {
      maxRetries: 1, // We have queue-level retries
      retryDelayMs: 1000,
    }, logPrefix);

    if (!result) {
      return { success: false, imageUrl: null, error: 'Image generation returned no data' };
    }

    // Upload to Supabase storage
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

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('lecture-visuals')
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      return { success: false, imageUrl: null, error: 'Failed to get public URL' };
    }

    console.log(`${logPrefix} Success: ${urlData.publicUrl}`);
    return { success: true, imageUrl: urlData.publicUrl, error: null };

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
          source: 'ai_generated_openrouter',
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    } = body;

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ========================================================================
    // MODE 1: Continue processing from queue
    // ========================================================================
    if (continueProcessing) {
      console.log(`${functionName} Continue mode - processing from queue`);
      
      // Fetch pending items
      const pendingItems = await fetchPendingItems(supabase, BATCH_SIZE);
      
      if (pendingItems.length === 0) {
        console.log(`${functionName} No pending items in queue`);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No pending items to process',
            processed: 0,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`${functionName} Processing ${pendingItems.length} items`);

      // Mark items as processing
      await markAsProcessing(supabase, pendingItems.map(i => i.id));

      // Process in concurrent batches
      let processedCount = 0;
      let successCount = 0;
      const affectedLectures = new Set<string>();

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

            affectedLectures.add(item.lecture_slides_id);
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

      // Update affected lecture_slides records
      for (const lectureId of affectedLectures) {
        await updateLectureSlides(supabase, lectureId);
      }

      // Check if more items remain
      const remainingCount = await getPendingCount(supabase);
      
      // Trigger continuation if items remain
      if (remainingCount > 0) {
        await triggerContinuation(supabaseUrl, serviceRoleKey);
      }

      const elapsed = Date.now() - startTime;
      console.log(`${functionName} Completed: ${successCount}/${processedCount} successful, ${remainingCount} remaining, ${elapsed}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          processed: processedCount,
          succeeded: successCount,
          failed: processedCount - successCount,
          remaining: remainingCount,
          continuing: remainingCount > 0,
          elapsed_ms: elapsed,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

      return new Response(
        JSON.stringify({
          success: true,
          message: `Queued ${totalQueued} slides for image generation`,
          lectures_processed: ids.length,
          slides_queued: totalQueued,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No lectures found for batch',
            processed: 0,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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

      return new Response(
        JSON.stringify({
          success: true,
          message: `Queued ${totalQueued} slides from ${lectures.length} lectures`,
          lectures_processed: lectures.length,
          slides_queued: totalQueued,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No ready lectures found for course',
            queued: 0,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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

      return new Response(
        JSON.stringify({
          success: true,
          message: `Queued ${totalQueued} slides from ${lectures.length} lectures`,
          queued: totalQueued,
          lectures: lectures.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // No valid mode specified
    // ========================================================================
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Specify continue:true, lecture_slides_id, lecture_slides_ids, batch_job_id, or instructor_course_id',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`${functionName} Error:`, error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
