// ============================================================================
// PROCESS BATCH IMAGES - Async Image Generation for Batch Slides
// ============================================================================
//
// PURPOSE: Generate images for slides created by the batch slide generation
// pipeline. This runs AFTER slides are saved, allowing slides to be usable
// immediately while images are generated asynchronously.
//
// TRIGGER: Called by poll-batch-status after slides are saved, or manually
// via API call for specific lecture_slides records.
//
// FLOW:
//   1. Fetch lecture_slides records that need images
//   2. For each slide with visual_directive but no visual.url:
//      - Generate image using Gemini 3 Pro Image
//      - Upload to Supabase storage
//      - Update slide with URL
//   3. Update lecture_slides record with updated slides array
//
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation';

// Rate limiting: max concurrent image generations
const MAX_CONCURRENT_IMAGES = 3;

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// ============================================================================
// TYPES
// ============================================================================

interface VisualDirective {
  type: string;
  description: string;
  elements: string[];
  style: string;
  educational_purpose?: string;
}

interface SlideVisual {
  url: string | null;
  alt_text: string;
  fallback_description: string;
  educational_purpose?: string;
  source?: string;
}

interface Slide {
  order: number;
  type: string;
  title: string;
  content: Record<string, unknown>;
  visual_directive?: VisualDirective;
  visual?: SlideVisual;
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
  batch_job_id: string | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function base64ToBlob(base64: string): Uint8Array {
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

// ============================================================================
// IMAGE GENERATION
// ============================================================================

async function generateImage(
  prompt: string,
  slideTitle: string,
  apiKey: string
): Promise<{ base64: string; text?: string } | null> {
  console.log(`[Visual AI] Generating image for: ${slideTitle}`);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${GOOGLE_API_BASE}/models/${IMAGE_MODEL}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Visual AI] Image generation failed (attempt ${attempt + 1}): ${response.status} - ${errorText}`);

        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        return null;
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];

      let text: string | undefined;
      let base64: string | undefined;

      for (const part of parts) {
        if (part.text) {
          text = part.text;
        }
        if (part.inlineData) {
          base64 = part.inlineData.data;
        }
      }

      if (base64) {
        console.log(`[Visual AI] Successfully generated image for: ${slideTitle}`);
        return { base64, text };
      }

      console.warn(`[Visual AI] No image data in response for: ${slideTitle}`);
      return null;
    } catch (error) {
      console.error(`[Visual AI] Error (attempt ${attempt + 1}):`, error);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      return null;
    }
  }

  return null;
}

function buildImagePrompt(
  slide: Slide,
  lectureTitle: string,
  domain?: string
): string {
  const directive = slide.visual_directive;
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
// PROCESS SINGLE LECTURE SLIDES RECORD
// ============================================================================

async function processLectureSlides(
  supabase: any,
  record: LectureSlideRecord,
  apiKey: string,
  domain?: string
): Promise<{ success: boolean; imagesGenerated: number; errors: string[] }> {
  const functionName = '[process-batch-images]';
  const errors: string[] = [];
  let imagesGenerated = 0;

  console.log(`${functionName} Processing lecture: ${record.title} (${record.slides.length} slides)`);

  // Find slides that need images
  const slidesNeedingImages = record.slides.filter(
    (slide) =>
      slide.visual_directive?.type &&
      slide.visual_directive.type !== 'none' &&
      (!slide.visual?.url)
  );

  console.log(`${functionName} ${slidesNeedingImages.length} slides need images`);

  if (slidesNeedingImages.length === 0) {
    return { success: true, imagesGenerated: 0, errors: [] };
  }

  // Process in batches to avoid rate limiting
  const updatedSlides = [...record.slides];

  for (let i = 0; i < slidesNeedingImages.length; i += MAX_CONCURRENT_IMAGES) {
    const batch = slidesNeedingImages.slice(i, i + MAX_CONCURRENT_IMAGES);

    const batchPromises = batch.map(async (slide) => {
      const prompt = buildImagePrompt(slide, record.title, domain);
      if (!prompt) return { slide, url: null, error: 'No visual directive' };

      try {
        const result = await generateImage(prompt, slide.title, apiKey);

        if (result?.base64) {
          // Upload to Supabase storage
          const fileName = `slide_${record.teaching_unit_id}_${slide.order}_${Date.now()}.png`;

          const { error: uploadError } = await supabase.storage
            .from('lecture-visuals')
            .upload(fileName, base64ToBlob(result.base64), {
              contentType: 'image/png',
              upsert: true,
            });

          if (uploadError) {
            console.error(`${functionName} Upload error for slide ${slide.order}:`, uploadError);
            return { slide, url: null, error: `Upload failed: ${uploadError.message}` };
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('lecture-visuals')
            .getPublicUrl(fileName);

          return { slide, url: urlData?.publicUrl || fileName, error: null };
        }

        return { slide, url: null, error: 'Image generation returned no data' };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { slide, url: null, error: errorMsg };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    // Update slides with generated URLs
    for (const result of batchResults) {
      if (result.url) {
        const slideIndex = updatedSlides.findIndex(s => s.order === result.slide.order);
        if (slideIndex !== -1) {
          updatedSlides[slideIndex] = {
            ...updatedSlides[slideIndex],
            visual: {
              url: result.url,
              alt_text: result.slide.visual_directive?.description || result.slide.title,
              fallback_description: result.slide.visual_directive?.description || '',
              educational_purpose: result.slide.visual_directive?.educational_purpose,
              source: 'ai_generated',
            },
          };
          imagesGenerated++;
        }
      } else if (result.error) {
        errors.push(`Slide ${result.slide.order} (${result.slide.title}): ${result.error}`);
      }
    }

    // Small delay between batches to avoid rate limiting
    if (i + MAX_CONCURRENT_IMAGES < slidesNeedingImages.length) {
      await sleep(500);
    }
  }

  // Update the lecture_slides record with new visual URLs
  const { error: updateError } = await supabase
    .from('lecture_slides')
    .update({
      slides: updatedSlides,
      updated_at: new Date().toISOString(),
      generation_phases: {
        version: 3,
        images_completed: new Date().toISOString(),
        images_generated: imagesGenerated,
        images_failed: errors.length,
        current_phase: 'complete',
        progress_percent: 100,
        message: imagesGenerated > 0
          ? `Generated ${imagesGenerated} images`
          : 'Image generation complete (some may have failed)',
      },
    })
    .eq('id', record.id);

  if (updateError) {
    console.error(`${functionName} Update error:`, updateError);
    errors.push(`Failed to save slides: ${updateError.message}`);
    return { success: false, imagesGenerated, errors };
  }

  console.log(`${functionName} Completed: ${imagesGenerated} images generated, ${errors.length} errors`);
  return { success: true, imagesGenerated, errors };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const functionName = '[process-batch-images]';
  console.log(`${functionName} Starting...`);

  try {
    // ========================================================================
    // STEP 1: Parse request
    // ========================================================================
    const { batch_job_id, lecture_slides_id, lecture_slides_ids } = await req.json();

    if (!batch_job_id && !lecture_slides_id && !lecture_slides_ids) {
      throw new Error('batch_job_id, lecture_slides_id, or lecture_slides_ids is required');
    }

    // Initialize clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_CLOUD_API_KEY not configured');
    }

    // ========================================================================
    // STEP 2: Fetch lecture_slides records
    // ========================================================================
    let query = supabase
      .from('lecture_slides')
      .select(`
        id,
        teaching_unit_id,
        instructor_course_id,
        title,
        slides,
        status,
        batch_job_id,
        instructor_courses:instructor_course_id (
          detected_domain
        )
      `);

    if (lecture_slides_id) {
      query = query.eq('id', lecture_slides_id);
    } else if (lecture_slides_ids && lecture_slides_ids.length > 0) {
      query = query.in('id', lecture_slides_ids);
    } else if (batch_job_id) {
      query = query.eq('batch_job_id', batch_job_id);
    }

    const { data: records, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch lecture slides: ${fetchError.message}`);
    }

    if (!records || records.length === 0) {
      console.log(`${functionName} No lecture slides found`);
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          images_generated: 0,
          message: 'No lecture slides found to process',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${functionName} Found ${records.length} lecture slides to process`);

    // ========================================================================
    // STEP 3: Process each lecture slides record
    // ========================================================================
    let totalImagesGenerated = 0;
    let totalErrors: string[] = [];
    let processedCount = 0;

    for (const record of records) {
      const domain = (record as any).instructor_courses?.detected_domain;

      const result = await processLectureSlides(
        supabase,
        record as LectureSlideRecord,
        apiKey,
        domain
      );

      totalImagesGenerated += result.imagesGenerated;
      totalErrors = [...totalErrors, ...result.errors];
      if (result.success) processedCount++;
    }

    // ========================================================================
    // STEP 4: Return result
    // ========================================================================
    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        total_records: records.length,
        images_generated: totalImagesGenerated,
        errors: totalErrors.length > 0 ? totalErrors : undefined,
        message: `Processed ${processedCount} lecture slides, generated ${totalImagesGenerated} images`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`${functionName} Error:`, error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
