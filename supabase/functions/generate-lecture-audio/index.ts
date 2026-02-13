import { createClient } from "@supabase/supabase-js";
import { generateNarration, needsNarration } from "../_shared/ai-narrator.ts";
import { mapAudioSegments } from "../_shared/segment-mapper.ts";
import { synthesizeSpeech, TTS_VOICES, resolveVoiceId } from "../_shared/tts-client.ts";
const ALL_VOICE_IDS = Object.keys(TTS_VOICES); // ['Charon', 'Leda', 'Fenrir', 'Kore', 'Puck', 'Aoede']
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";
import { validateRequest, lectureAudioSchema } from "../_shared/validators/index.ts";

interface SlideWithAudio {
  order: number;
  type?: string;
  title?: string;
  speaker_notes?: string;
  audio_url?: string;
  audio_urls?: Record<string, string>;
  audio_duration_seconds?: number;
  audio_segment_map?: Array<{
    target_block: string;
    start_percent: number;
    end_percent: number;
    narration_excerpt?: string;
  }>;
  content?: {
    main_text?: string;
    key_points?: Array<string | { text: string }>;
    definition?: { term?: string; formal_definition?: string; simple_explanation?: string };
    example?: { scenario?: string };
    steps?: Array<{ step: number; title: string; explanation: string }>;
  };
  [key: string]: unknown;
}

// Simple fallback narration (used when AI narration fails or is disabled)
function generateSimpleFallback(slide: SlideWithAudio): string {
  const parts: string[] = [];
  
  if (slide.title) {
    parts.push(`Let's discuss ${slide.title}.`);
  }
  
  if (slide.content?.main_text) {
    parts.push(slide.content.main_text);
  }
  
  if (slide.content?.key_points?.length) {
    parts.push('Here are the key points to understand:');
    slide.content.key_points.forEach((point, i) => {
      const text = typeof point === 'string' ? point : point.text;
      parts.push(`${i + 1}. ${text}`);
    });
  }
  
  if (slide.content?.definition) {
    const def = slide.content.definition;
    parts.push(`${def.term} is defined as: ${def.formal_definition || def.simple_explanation}`);
  }
  
  if (slide.content?.example?.scenario) {
    parts.push(`For example: ${slide.content.example.scenario}`);
  }
  
  return parts.join(' ').replace(/\[Source\s*\d+\]/gi, '').replace(/\s{2,}/g, ' ').trim();
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  const body = await req.json();
  const validation = validateRequest(lectureAudioSchema, body);
  if (!validation.success) {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
  }
  const { slideId, enableSegmentMapping } = validation.data;

  // Verify API keys
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  if (!OPENROUTER_API_KEY) {
    return createErrorResponse('CONFIG_ERROR', corsHeaders, 'OPENROUTER_API_KEY not configured');
  }

  const GOOGLE_CLOUD_API_KEY = Deno.env.get('GOOGLE_CLOUD_API_KEY');
  if (!GOOGLE_CLOUD_API_KEY) {
    return createErrorResponse('CONFIG_ERROR', corsHeaders, 'GOOGLE_CLOUD_API_KEY not configured (required for TTS)');
  }

  try {
    logInfo('generate-lecture-audio', 'starting', { slideId, voices: ALL_VOICE_IDS, enableSegmentMapping });

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the lecture slide
    const { data: lectureSlide, error: fetchError } = await supabase
      .from('lecture_slides')
      .select('*, instructor_course:instructor_courses!instructor_course_id (instructor_id)')
      .eq('id', slideId)
      .single();

    if (fetchError || !lectureSlide) {
      console.error('Failed to fetch lecture slide:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Lecture slide not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // SECURITY: Verify caller identity and slide ownership
    // ========================================================================
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      if (token !== supabaseServiceKey) {
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      }
    }

    const courseOwner = (lectureSlide.instructor_course as any)?.instructor_id;
    if (userId && courseOwner && courseOwner !== userId) {
      logError('generate-lecture-audio', new Error('Authorization failed'), {
        userId,
        courseOwner,
        slideId,
      });
      return new Response(
        JSON.stringify({ error: 'Not authorized to generate audio for this slide' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Self-healing: if audio_status is stuck in 'generating' for >10 minutes, allow retry
    if (lectureSlide.audio_status === 'generating') {
      const updatedAt = new Date(lectureSlide.updated_at);
      const minutesSinceUpdate = (Date.now() - updatedAt.getTime()) / 60000;
      if (minutesSinceUpdate < 10) {
        console.log(`Audio generation already in progress (${Math.round(minutesSinceUpdate)}m ago), skipping`);
        return createSuccessResponse({
          success: true,
          message: 'Audio generation already in progress',
          alreadyGenerating: true,
        }, corsHeaders);
      }
      console.warn(`⚠️ Self-healing: audio_status stuck in 'generating' for ${Math.round(minutesSinceUpdate)}m — resetting and retrying`);
    }

    // Update audio status to generating
    await supabase
      .from('lecture_slides')
      .update({ audio_status: 'generating' })
      .eq('id', slideId);

    const slides = lectureSlide.slides as SlideWithAudio[];
    const totalSlides = slides.length;
    const unitTitle = lectureSlide.title || 'Lecture';
    const domain = (lectureSlide as any).detected_domain || 'general';
    
    console.log(`Generating audio for ${totalSlides} slides (Voices: ${ALL_VOICE_IDS.join(', ')}, TTS: Google Chirp 3 HD)...`);

    const updatedSlides: SlideWithAudio[] = [];
    let totalDurationSeconds = 0;
    let lastSlideError: string | null = null;
    const allSlideTitles = slides.map(s => s.title || 'Untitled');
    let previousNarrationTail = '';
    const auditEntries: Array<Record<string, unknown>> = [];

    // Process each slide
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      let narrationText = slide.speaker_notes || '';

      // PHASE 1: Generate AI narration if needed
      if (needsNarration(narrationText)) {
        console.log(`Slide ${i + 1}: Generating AI narration...`);
        try {
          narrationText = await generateNarration(
            {
              type: slide.type,
              title: slide.title,
              content: slide.content,
              speaker_notes: slide.speaker_notes,
            },
            {
              slideIndex: i,
              totalSlides,
              unitTitle,
              domain,
              previousNarrationTail,
              allSlideTitles,
            },
            OPENROUTER_API_KEY
          );
          console.log(`Slide ${i + 1}: AI narration generated (${narrationText.length} chars)`);
        } catch (err) {
          console.error(`Slide ${i + 1}: AI narration failed, using fallback:`, err);
          narrationText = generateSimpleFallback(slide);
        }
      } else if (!narrationText || narrationText.trim().length < 50) {
        narrationText = generateSimpleFallback(slide);
      }

      // Strip citation markers from narration
      narrationText = narrationText.replace(/\[Source\s*\d+\]/gi, '').replace(/\s{2,}/g, ' ').trim();

      if (!narrationText || narrationText.length === 0) {
        console.log(`Slide ${i + 1}: No content for narration, skipping`);
        updatedSlides.push(slide);
        continue;
      }

      // Update continuity tail for next slide
      const narrationWords = narrationText.split(/\s+/);
      previousNarrationTail = narrationWords.slice(Math.max(0, narrationWords.length - 100)).join(' ');

      console.log(`Slide ${i + 1}: Generating audio for ${ALL_VOICE_IDS.length} voices (${narrationText.length} chars)...`);

      try {
        // PHASE 2: Generate audio for ALL voices in parallel
        const voiceResults = await Promise.all(
          ALL_VOICE_IDS.map(async (vid) => {
            const result = await synthesizeSpeech(narrationText, vid, GOOGLE_CLOUD_API_KEY);
            // Upload to voice-specific path
            const fileName = `${slideId}/${vid}/slide_${i}.wav`;
            const { error: uploadError } = await supabase.storage
              .from('lecture-audio')
              .upload(fileName, result.wavBytes, {
                contentType: 'audio/wav',
                upsert: true,
              });
            if (uploadError) {
              console.error(`Upload error for slide ${i + 1}, voice ${vid}:`, uploadError);
              throw new Error(`Failed to upload audio for ${vid}: ${uploadError.message}`);
            }
            return { vid, fileName, durationSeconds: result.durationSeconds, chunkCount: result.chunkCount };
          })
        );

        // Use first voice's duration (identical text → near-identical duration)
        const primaryResult = voiceResults[0];
        const durationSeconds = primaryResult.durationSeconds;

        // Build audio_urls map
        const audioUrls: Record<string, string> = {};
        for (const vr of voiceResults) {
          audioUrls[vr.vid] = vr.fileName;
        }

        // PHASE 3: Map audio segments once (text-based, not voice-specific)
        let audioSegmentMap: SlideWithAudio['audio_segment_map'] = undefined;
        
        if (enableSegmentMapping) {
          console.log(`Slide ${i + 1}: Mapping audio segments...`);
          try {
            audioSegmentMap = await mapAudioSegments(
              {
                title: slide.title,
                content: slide.content,
                speaker_notes: narrationText,
              },
              durationSeconds,
              OPENROUTER_API_KEY
            );
            console.log(`Slide ${i + 1}: Mapped ${audioSegmentMap?.length || 0} segments`);
          } catch (err) {
            console.error(`Slide ${i + 1}: Segment mapping failed:`, err);
          }
        }

        // Build audit entry
        const wordCount = narrationText.split(/\s+/).length;
        const heuristicDuration = Math.ceil((wordCount / 150) * 60);
        const durationDeviationPercent = heuristicDuration > 0
          ? Math.round(Math.abs(durationSeconds - heuristicDuration) / heuristicDuration * 100)
          : 0;

        const auditEntry: Record<string, unknown> = {
          slide_index: i,
          slide_title: slide.title || 'Untitled',
          narration_input: {
            char_count: narrationText.length,
            word_count: wordCount,
            first_50_chars: narrationText.substring(0, 50),
          },
          tts_engine: 'google-cloud-chirp3-hd',
          voices_generated: ALL_VOICE_IDS,
          chunk_count: primaryResult.chunkCount,
          duration: {
            actual_seconds: durationSeconds,
            heuristic_seconds: heuristicDuration,
            deviation_percent: durationDeviationPercent,
          },
        };
        auditEntries.push(auditEntry);

        if (durationDeviationPercent > 20) {
          console.warn(`⚠️ Slide ${i + 1}: Duration deviation ${durationDeviationPercent}% (actual: ${durationSeconds}s, heuristic: ${heuristicDuration}s)`);
        }

        updatedSlides.push({
          ...slide,
          speaker_notes: narrationText,
          audio_url: audioUrls['Charon'], // backward compat default
          audio_urls: audioUrls,
          audio_duration_seconds: durationSeconds,
          audio_segment_map: audioSegmentMap,
        });

        totalDurationSeconds += durationSeconds;
        console.log(`Slide ${i + 1}: Audio generated for ${ALL_VOICE_IDS.length} voices (${durationSeconds}s, ${audioSegmentMap?.length || 0} segments)`);

        // Small delay between slides to avoid rate limiting
        if (i < slides.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (slideError) {
        const errMsg = slideError instanceof Error ? slideError.message : String(slideError);
        console.error(`Error processing slide ${i + 1}:`, slideError);
        lastSlideError = errMsg;
        updatedSlides.push(slide);
      }
    }

    // Build audit summary
    const durationDeviations = auditEntries.filter(e => (e.duration as any)?.deviation_percent > 20);
    const avgDeviation = auditEntries.length > 0
      ? Math.round(auditEntries.reduce((sum, e) => sum + ((e.duration as any)?.deviation_percent || 0), 0) / auditEntries.length)
      : 0;
    const maxDeviation = auditEntries.length > 0
      ? Math.max(...auditEntries.map(e => (e.duration as any)?.deviation_percent || 0))
      : 0;

    const auditLog = {
      generated_at: new Date().toISOString(),
      tts_engine: 'google-cloud-chirp3-hd',
      voices: ALL_VOICE_IDS,
      total_slides_processed: auditEntries.length,
      slides: auditEntries,
      summary: {
        avg_duration_deviation_percent: avgDeviation,
        max_duration_deviation_percent: maxDeviation,
        slides_with_duration_deviation: durationDeviations.length,
      },
    };

    // Determine audio completeness — only mark has_audio=true when ALL
    // content slides got audio (slides without narration text are excluded)
    const slidesWithAudio = updatedSlides.filter(s => s.audio_url).length;
    const slidesNeedingAudio = updatedSlides.filter(s => {
      // Slides that were skipped (no narration text) don't count against completeness
      const hasNarration = s.speaker_notes && s.speaker_notes.trim().length > 0;
      return hasNarration;
    }).length;
    const allComplete = slidesNeedingAudio > 0 && slidesWithAudio >= slidesNeedingAudio;

    // Update the lecture slide with audio URLs, segment maps, and audit log
    const { error: updateError } = await supabase
      .from('lecture_slides')
      .update({
        slides: updatedSlides,
        has_audio: allComplete,
        audio_status: allComplete ? 'ready' : 'failed',
        audio_generated_at: new Date().toISOString(),
        audio_audit_log: auditLog,
      })
      .eq('id', slideId);

    if (updateError) {
      console.error('Failed to update lecture slide:', updateError);
      throw new Error(`Failed to save audio URLs: ${updateError.message}`);
    }

    const slidesWithSegments = updatedSlides.filter(s => s.audio_segment_map?.length).length;

    // If no slides got audio, the update above already set audio_status='failed'
    if (slidesWithAudio === 0) {
      logError('generate-lecture-audio', new Error(`All slides failed: ${lastSlideError}`));
      return createErrorResponse('INTERNAL_ERROR', corsHeaders, `Audio generation failed for all slides: ${lastSlideError || 'Unknown error'}`);
    }

    logInfo('generate-lecture-audio', 'complete', {
      slideId,
      slidesWithAudio,
      slidesWithSegments,
      totalSlides: slides.length,
      totalDurationSeconds,
      ttsEngine: 'google-cloud-chirp3-hd',
      auditSummary: auditLog.summary,
    });

    return createSuccessResponse({
      success: true,
      slidesWithAudio,
      slidesWithSegments,
      totalSlides: slides.length,
      totalDurationSeconds,
      auditSummary: auditLog.summary,
      message: `Generated audio for ${slidesWithAudio} slides with ${slidesWithSegments} segment maps`
    }, corsHeaders);

  } catch (error) {
    logError('generate-lecture-audio', error instanceof Error ? error : new Error(String(error)));

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase
        .from('lecture_slides')
        .update({ audio_status: 'failed' })
        .eq('id', slideId);
    } catch {}

    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
