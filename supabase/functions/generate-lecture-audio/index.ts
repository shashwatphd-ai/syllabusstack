import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SlideWithAudio {
  order: number;
  speaker_notes: string;
  audio_url?: string;
  audio_duration_seconds?: number;
  [key: string]: unknown;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Neural2 voices are more natural than WaveNet at same price ($16/1M chars)
    // Options: Neural2-A (female), Neural2-D (male), Neural2-F (female), Neural2-J (male)
    const { slideId, voice = 'en-US-Neural2-D' } = await req.json();

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

    console.log(`Generating audio for ${lectureSlide.slides.length} slides...`);

    const slides = lectureSlide.slides as SlideWithAudio[];
    const updatedSlides: SlideWithAudio[] = [];
    let totalDurationSeconds = 0;

    // Process each slide
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const speakerNotes = slide.speaker_notes;

      if (!speakerNotes || speakerNotes.trim().length === 0) {
        console.log(`Slide ${i + 1}: No speaker notes, skipping audio`);
        updatedSlides.push(slide);
        continue;
      }

      console.log(`Slide ${i + 1}: Generating audio (${speakerNotes.length} chars)...`);

      try {
        // Call Google Cloud TTS API
        const ttsResponse = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_CLOUD_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: { text: speakerNotes },
              voice: {
                languageCode: voice.substring(0, 5), // e.g., 'en-US'
                name: voice,
                ssmlGender: voice.includes('Wavenet-D') || voice.includes('Wavenet-B') || voice.includes('Wavenet-J') ? 'MALE' : 'FEMALE'
              },
              audioConfig: {
                audioEncoding: 'MP3',
                pitch: -1.0, // Slightly lower for authority
                speakingRate: 0.95 // Slightly slower for clarity
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

        // Estimate duration: ~150 words per minute, 5 chars per word
        const wordCount = speakerNotes.split(/\s+/).length;
        const estimatedDuration = Math.ceil((wordCount / 150) * 60);

        updatedSlides.push({
          ...slide,
          audio_url: publicUrlData.publicUrl,
          audio_duration_seconds: estimatedDuration
        });

        totalDurationSeconds += estimatedDuration;
        console.log(`Slide ${i + 1}: Audio generated (${estimatedDuration}s)`);

        // Small delay to avoid rate limiting
        if (i < slides.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (slideError) {
        console.error(`Error processing slide ${i + 1}:`, slideError);
        // Continue with original slide without audio
        updatedSlides.push(slide);
      }
    }

    // Update the lecture slide with audio URLs
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
    console.log(`Audio generation complete: ${slidesWithAudio}/${slides.length} slides with audio`);

    return new Response(
      JSON.stringify({
        success: true,
        slidesWithAudio,
        totalSlides: slides.length,
        totalDurationSeconds,
        message: `Generated audio for ${slidesWithAudio} slides`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate lecture audio error:', error);

    // Try to update status to failed
    try {
      const { slideId } = await (await fetch(req.url, { method: 'POST', body: req.body })).json().catch(() => ({}));
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
