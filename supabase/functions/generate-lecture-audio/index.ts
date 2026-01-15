import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { generateNarration, needsNarration } from "../_shared/ai-narrator.ts";
import { transformToSSML, isSSML } from "../_shared/ssml-transformer.ts";
import { mapAudioSegments, extractContentBlocks } from "../_shared/segment-mapper.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  
  return parts.join(' ');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Neural2 voices are more natural than WaveNet at same price ($16/1M chars)
    // Options: Neural2-A (female), Neural2-D (male), Neural2-F (female), Neural2-J (male)
    const { slideId, voice = 'en-US-Neural2-D', enableSSML = true, enableSegmentMapping = true } = await req.json();

    if (!slideId) {
      return new Response(
        JSON.stringify({ error: 'slideId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GOOGLE_CLOUD_API_KEY = Deno.env.get('GOOGLE_CLOUD_API_KEY');
    if (!GOOGLE_CLOUD_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_CLOUD_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.warn('LOVABLE_API_KEY not set - AI narration and SSML will be disabled');
    }

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
    
    console.log(`Generating audio for ${totalSlides} slides (SSML: ${enableSSML}, Mapping: ${enableSegmentMapping})...`);

    const updatedSlides: SlideWithAudio[] = [];
    let totalDurationSeconds = 0;

    // Process each slide
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      let narrationText = slide.speaker_notes || '';

      // PHASE 1: Generate AI narration if needed
      if (LOVABLE_API_KEY && needsNarration(narrationText)) {
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
            },
            LOVABLE_API_KEY
          );
          console.log(`Slide ${i + 1}: AI narration generated (${narrationText.length} chars)`);
        } catch (err) {
          console.error(`Slide ${i + 1}: AI narration failed, using fallback:`, err);
          narrationText = generateSimpleFallback(slide);
        }
      } else if (!narrationText || narrationText.trim().length < 50) {
        narrationText = generateSimpleFallback(slide);
      }

      if (!narrationText || narrationText.trim().length === 0) {
        console.log(`Slide ${i + 1}: No content for narration, skipping`);
        updatedSlides.push(slide);
        continue;
      }

      // PHASE 2: Transform narration to SSML for natural prosody
      let ttsInput: { text?: string; ssml?: string } = { text: narrationText };
      
      if (enableSSML && LOVABLE_API_KEY && !isSSML(narrationText)) {
        console.log(`Slide ${i + 1}: Transforming to SSML...`);
        try {
          const ssmlOutput = await transformToSSML(
            narrationText,
            {
              slideType: slide.type || 'concept',
              slideIndex: i,
              totalSlides,
              hasDefinition: !!slide.content?.definition,
              hasExample: !!slide.content?.example,
              hasSteps: !!(slide.content?.steps?.length),
            },
            LOVABLE_API_KEY
          );
          
          if (isSSML(ssmlOutput)) {
            ttsInput = { ssml: ssmlOutput };
            console.log(`Slide ${i + 1}: SSML transformation complete`);
          } else {
            console.log(`Slide ${i + 1}: SSML invalid, using plain text`);
          }
        } catch (err) {
          console.error(`Slide ${i + 1}: SSML transformation failed:`, err);
        }
      }

      console.log(`Slide ${i + 1}: Generating audio (${narrationText.length} chars)...`);

      try {
        // PHASE 3: Call Google Cloud TTS API
        const ttsResponse = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_CLOUD_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: ttsInput,
              voice: {
                languageCode: voice.substring(0, 5), // e.g., 'en-US'
                name: voice,
                ssmlGender: voice.includes('Neural2-D') || voice.includes('Neural2-B') || voice.includes('Neural2-J') ? 'MALE' : 'FEMALE'
              },
              audioConfig: {
                audioEncoding: 'MP3',
                pitch: 0, // Natural pitch (was -1.0 which caused odd slowdowns)
                speakingRate: 1.0 // Normal speed (was 0.95 which was too slow)
              }
            })
          }
        );

        if (!ttsResponse.ok) {
          const errorText = await ttsResponse.text();
          console.error(`TTS API error for slide ${i + 1}:`, errorText);
          throw new Error(`TTS API failed: ${ttsResponse.status}`);
        }

        const ttsData = await ttsResponse.json();
        const audioContent = ttsData.audioContent; // Base64-encoded MP3

        if (!audioContent) {
          throw new Error('No audio content returned from TTS API');
        }

        // Decode base64 to Uint8Array
        const binaryString = atob(audioContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }

        // Upload to Supabase Storage
        const fileName = `${slideId}/slide_${i}.mp3`;
        const { error: uploadError } = await supabase.storage
          .from('lecture-audio')
          .upload(fileName, bytes, {
            contentType: 'audio/mpeg',
            upsert: true
          });

        if (uploadError) {
          console.error(`Upload error for slide ${i + 1}:`, uploadError);
          throw new Error(`Failed to upload audio: ${uploadError.message}`);
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('lecture-audio')
          .getPublicUrl(fileName);

        // Estimate duration: ~150 words per minute, adjusted for speaking rate
        const wordCount = narrationText.split(/\s+/).length;
        const estimatedDuration = Math.ceil((wordCount / (150 * 0.95)) * 60);

        // PHASE 4: Map audio segments to content blocks for sync highlighting
        let audioSegmentMap: SlideWithAudio['audio_segment_map'] = undefined;
        
        if (enableSegmentMapping && LOVABLE_API_KEY) {
          console.log(`Slide ${i + 1}: Mapping audio segments...`);
          try {
            audioSegmentMap = await mapAudioSegments(
              {
                title: slide.title,
                content: slide.content,
                speaker_notes: narrationText,
              },
              estimatedDuration,
              LOVABLE_API_KEY
            );
            console.log(`Slide ${i + 1}: Mapped ${audioSegmentMap?.length || 0} segments`);
          } catch (err) {
            console.error(`Slide ${i + 1}: Segment mapping failed:`, err);
          }
        }

        updatedSlides.push({
          ...slide,
          speaker_notes: narrationText, // Update with AI-generated narration if applicable
          audio_url: publicUrlData.publicUrl,
          audio_duration_seconds: estimatedDuration,
          audio_segment_map: audioSegmentMap,
        });

        totalDurationSeconds += estimatedDuration;
        console.log(`Slide ${i + 1}: Audio generated (${estimatedDuration}s, ${audioSegmentMap?.length || 0} segments)`);

        // Small delay to avoid rate limiting
        if (i < slides.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }

      } catch (slideError) {
        console.error(`Error processing slide ${i + 1}:`, slideError);
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
    console.log(`Audio generation complete: ${slidesWithAudio}/${slides.length} slides with audio, ${slidesWithSegments} with segment maps`);

    return new Response(
      JSON.stringify({
        success: true,
        slidesWithAudio,
        slidesWithSegments,
        totalSlides: slides.length,
        totalDurationSeconds,
        message: `Generated audio for ${slidesWithAudio} slides with ${slidesWithSegments} segment maps`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate lecture audio error:', error);

    // Try to update status to failed
    try {
      const { slideId } = await req.clone().json().catch(() => ({}));
      if (slideId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from('lecture_slides')
          .update({ audio_status: 'failed' })
          .eq('id', slideId);
      }
    } catch {}

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});