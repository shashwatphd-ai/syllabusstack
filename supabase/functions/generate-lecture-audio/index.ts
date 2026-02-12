import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { generateNarration, needsNarration } from "../_shared/ai-narrator.ts";
import { mapAudioSegments, extractContentBlocks } from "../_shared/segment-mapper.ts";
import { callOpenRouter, MODELS } from "../_shared/openrouter-client.ts";
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
  const { slideId, voiceId = 'onyx', enableSegmentMapping } = validation.data;

  // Verify OpenRouter is configured (used for narration, TTS, and segment mapping)
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  if (!OPENROUTER_API_KEY) {
    return createErrorResponse('CONFIG_ERROR', corsHeaders, 'OPENROUTER_API_KEY not configured');
  }

  try {
    logInfo('generate-lecture-audio', 'starting', { slideId, voiceId, enableSegmentMapping });

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the lecture slide
    const { data: lectureSlide, error: fetchError } = await supabase
      .from('lecture_slides')
      .select('*')
      .eq('id', slideId)
      .single();

    if (fetchError || !lectureSlide) {
      console.error('Failed to fetch lecture slide:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Lecture slide not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    
    console.log(`Generating audio for ${totalSlides} slides (Voice: ${voiceId}, Mapping: ${enableSegmentMapping})...`);

    const updatedSlides: SlideWithAudio[] = [];
    let totalDurationSeconds = 0;
    let lastSlideError: string | null = null;
    const allSlideTitles = slides.map(s => s.title || 'Untitled');
    let previousNarrationTail = '';

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

      // Strip citation markers from narration (regardless of source)
      narrationText = narrationText.replace(/\[Source\s*\d+\]/gi, '').replace(/\s{2,}/g, ' ').trim();

      if (!narrationText || narrationText.length === 0) {
        console.log(`Slide ${i + 1}: No content for narration, skipping`);
        updatedSlides.push(slide);
        continue;
      }

      // Update continuity tail for next slide
      const narrationWords = narrationText.split(/\s+/);
      previousNarrationTail = narrationWords.slice(Math.max(0, narrationWords.length - 100)).join(' ');

      // PHASE 2 (SSML) — REMOVED: GPT Audio handles prosody natively

      console.log(`Slide ${i + 1}: Generating audio via GPT Audio (${narrationText.length} chars)...`);

      try {
        // PHASE 3: Generate audio via GPT Audio (OpenRouter)
        const audioResponse = await callOpenRouter({
          model: MODELS.AUDIO,
          messages: [
            {
              role: 'system',
              content: 'You are a master educator delivering a continuous lecture monologue. Read the following narration naturally with warmth, intellectual generosity, and calm, unhurried pacing. Do not add any commentary, greetings, dialogue, or acknowledgments. This is a one-way narration -- never say "thank you," never respond as if someone spoke, never add your own introduction or sign-off. If you encounter URLs or abbreviations, handle them naturally. If you encounter academic citations like "Smith et al. (2019)" or "Source 1", skip them entirely -- do not read them aloud.',
            },
            {
              role: 'user',
              content: narrationText,
            },
          ],
          modalities: ['text', 'audio'],
          audio: { voice: voiceId, format: 'pcm16' },
          fallbacks: [MODELS.AUDIO_HD],
        }, `[Audio TTS Slide ${i + 1}]`);

        const audioData = audioResponse.choices[0]?.message?.audio?.data;
        if (!audioData) {
          throw new Error('No audio data in GPT Audio response');
        }

        // Decode base64 PCM16 to bytes
        const binaryString = atob(audioData);
        const pcmBytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) {
          pcmBytes[j] = binaryString.charCodeAt(j);
        }

        // Wrap PCM16 data in a WAV header for browser playback
        const sampleRate = 24000; // OpenAI default
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        const dataSize = pcmBytes.length;
        const headerSize = 44;
        const wavBuffer = new ArrayBuffer(headerSize + dataSize);
        const view = new DataView(wavBuffer);
        const writeString = (offset: number, str: string) => {
          for (let k = 0; k < str.length; k++) view.setUint8(offset + k, str.charCodeAt(k));
        };
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);
        new Uint8Array(wavBuffer, headerSize).set(pcmBytes);
        const bytes = new Uint8Array(wavBuffer);

        // Upload to Supabase Storage (WAV format, browsers natively support it)
        const fileName = `${slideId}/slide_${i}.wav`;
        const { error: uploadError } = await supabase.storage
          .from('lecture-audio')
          .upload(fileName, bytes, {
            contentType: 'audio/wav',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error for slide ${i + 1}:`, uploadError);
          throw new Error(`Failed to upload audio: ${uploadError.message}`);
        }

        // Estimate duration: ~150 words per minute
        const wordCount = narrationText.split(/\s+/).length;
        const estimatedDuration = Math.ceil((wordCount / 150) * 60);

        // PHASE 4: Map audio segments to content blocks for sync highlighting
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
              estimatedDuration,
              OPENROUTER_API_KEY
            );
            console.log(`Slide ${i + 1}: Mapped ${audioSegmentMap?.length || 0} segments`);
          } catch (err) {
            console.error(`Slide ${i + 1}: Segment mapping failed:`, err);
          }
        }

        updatedSlides.push({
          ...slide,
          speaker_notes: narrationText,
          audio_url: fileName,
          audio_duration_seconds: estimatedDuration,
          audio_segment_map: audioSegmentMap,
        });

        totalDurationSeconds += estimatedDuration;
        console.log(`Slide ${i + 1}: Audio generated (${estimatedDuration}s, ${audioSegmentMap?.length || 0} segments)`);

        // Small delay to avoid rate limiting
        if (i < slides.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (slideError) {
        const errMsg = slideError instanceof Error ? slideError.message : String(slideError);
        console.error(`Error processing slide ${i + 1}:`, slideError);
        lastSlideError = errMsg;
        // Continue with original slide without audio
        updatedSlides.push(slide);
      }
    }

    // Update the lecture slide with audio URLs and segment maps
    const { error: updateError } = await supabase
      .from('lecture_slides')
      .update({
        slides: updatedSlides,
        has_audio: updatedSlides.some(s => s.audio_url),
        audio_status: 'ready'
      })
      .eq('id', slideId);

    if (updateError) {
      console.error('Failed to update lecture slide:', updateError);
      throw new Error(`Failed to save audio URLs: ${updateError.message}`);
    }

    const slidesWithAudio = updatedSlides.filter(s => s.audio_url).length;
    const slidesWithSegments = updatedSlides.filter(s => s.audio_segment_map?.length).length;

    // If no slides got audio, treat as failure
    if (slidesWithAudio === 0) {
      // Reset status to failed
      await supabase
        .from('lecture_slides')
        .update({ audio_status: 'failed' })
        .eq('id', slideId);

      logError('generate-lecture-audio', new Error(`All slides failed: ${lastSlideError}`));
      return createErrorResponse('INTERNAL_ERROR', corsHeaders, `Audio generation failed for all slides: ${lastSlideError || 'Unknown error'}`);
    }

    logInfo('generate-lecture-audio', 'complete', {
      slideId,
      slidesWithAudio,
      slidesWithSegments,
      totalSlides: slides.length,
      totalDurationSeconds,
    });

    return createSuccessResponse({
      success: true,
      slidesWithAudio,
      slidesWithSegments,
      totalSlides: slides.length,
      totalDurationSeconds,
      message: `Generated audio for ${slidesWithAudio} slides with ${slidesWithSegments} segment maps`
    }, corsHeaders);

  } catch (error) {
    logError('generate-lecture-audio', error instanceof Error ? error : new Error(String(error)));

    // Try to update status to failed
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

serve(withErrorHandling(handler, getCorsHeaders));
