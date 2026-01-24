import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

// ============================================================================
// GENERATE MODULE AUDIO - Batch Audio Generation for a Module
// ============================================================================
//
// PURPOSE: Generate audio for all slides in a module sequentially.
//
// WHY THIS EXISTS:
//   - Module-level audio generation allows users to generate audio for
//     all slides in a module with a single click
//   - Sequential generation ensures consistent quality and avoids rate limits
//   - Provides progress tracking at module level
//
// FLOW:
//   1. Receive module_id
//   2. Get all teaching units for the module
//   3. Get all lecture_slides for those teaching units
//   4. Process each slide sequentially (call generate-lecture-audio logic)
//   5. Update module audio_status
//
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { module_id, voice = 'en-US-Neural2-D' } = await req.json();

    if (!module_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'module_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[ModuleAudio] Starting audio generation for module: ${module_id}`);

    // ========================================================================
    // 1. Get module data and verify it exists
    // ========================================================================

    const { data: moduleData, error: moduleError } = await supabase
      .from('modules')
      .select('id, title, instructor_course_id')
      .eq('id', module_id)
      .single();

    if (moduleError || !moduleData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Module not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update module audio status to generating
    await supabase
      .from('modules')
      .update({ audio_status: 'generating' })
      .eq('id', module_id);

    // ========================================================================
    // 2. Get all learning objectives for this module
    // ========================================================================

    const { data: learningObjectives, error: loError } = await supabase
      .from('learning_objectives')
      .select('id')
      .eq('module_id', module_id);

    if (loError || !learningObjectives?.length) {
      console.warn('[ModuleAudio] No learning objectives found for module');
      await supabase
        .from('modules')
        .update({ audio_status: 'completed' })
        .eq('id', module_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'No learning objectives found',
          processed: 0,
          total: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const loIds = learningObjectives.map(lo => lo.id);

    // ========================================================================
    // 3. Get all teaching units for these learning objectives
    // ========================================================================

    const { data: teachingUnits, error: tuError } = await supabase
      .from('teaching_units')
      .select('id')
      .in('learning_objective_id', loIds);

    if (tuError || !teachingUnits?.length) {
      console.warn('[ModuleAudio] No teaching units found');
      await supabase
        .from('modules')
        .update({ audio_status: 'completed' })
        .eq('id', module_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'No teaching units found',
          processed: 0,
          total: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tuIds = teachingUnits.map(tu => tu.id);

    // ========================================================================
    // 4. Get all lecture slides that need audio
    // ========================================================================

    const { data: slides, error: slidesError } = await supabase
      .from('lecture_slides')
      .select('id, title, has_audio, audio_status, status')
      .in('teaching_unit_id', tuIds)
      .eq('status', 'ready'); // Only process ready slides

    if (slidesError) {
      console.error('[ModuleAudio] Error fetching slides:', slidesError);
      throw new Error('Failed to fetch lecture slides');
    }

    if (!slides?.length) {
      console.log('[ModuleAudio] No ready slides found');
      await supabase
        .from('modules')
        .update({ audio_status: 'completed' })
        .eq('id', module_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'No ready slides found for audio generation',
          processed: 0,
          total: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter to slides that don't have audio yet or have failed
    const slidesToProcess = slides.filter(
      s => !s.has_audio || s.audio_status === 'failed'
    );

    console.log(`[ModuleAudio] Found ${slidesToProcess.length} slides needing audio out of ${slides.length} total`);

    if (slidesToProcess.length === 0) {
      await supabase
        .from('modules')
        .update({ audio_status: 'completed' })
        .eq('id', module_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'All slides already have audio',
          processed: 0,
          total: slides.length,
          alreadyWithAudio: slides.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // 5. Process each slide sequentially
    // ========================================================================

    let successCount = 0;
    let failCount = 0;
    let totalDuration = 0;

    for (const slide of slidesToProcess) {
      console.log(`[ModuleAudio] Processing slide: ${slide.id} - ${slide.title}`);

      try {
        // Call the generate-lecture-audio function for this slide
        const { data: audioResult, error: audioError } = await supabase.functions.invoke(
          'generate-lecture-audio',
          {
            body: {
              slideId: slide.id,
              voice,
              enableSSML: true,
              enableSegmentMapping: true,
            },
          }
        );

        if (audioError) {
          console.error(`[ModuleAudio] Error generating audio for slide ${slide.id}:`, audioError);
          failCount++;
        } else if (audioResult?.success) {
          console.log(`[ModuleAudio] Audio generated for slide ${slide.id}: ${audioResult.slidesWithAudio} slides, ${audioResult.totalDurationSeconds}s`);
          successCount++;
          totalDuration += audioResult.totalDurationSeconds || 0;
        } else {
          console.warn(`[ModuleAudio] Audio generation returned unsuccessful for slide ${slide.id}`);
          failCount++;
        }

        // Small delay between slides to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`[ModuleAudio] Exception processing slide ${slide.id}:`, err);
        failCount++;
      }
    }

    // ========================================================================
    // 6. Update module audio status
    // ========================================================================

    const finalStatus = failCount === 0 ? 'completed' :
                        successCount === 0 ? 'failed' : 'partial';

    await supabase
      .from('modules')
      .update({ audio_status: finalStatus })
      .eq('id', module_id);

    console.log(`[ModuleAudio] Module audio generation complete: ${successCount} success, ${failCount} failed, ${totalDuration}s total duration`);

    return new Response(
      JSON.stringify({
        success: true,
        module_id,
        status: finalStatus,
        processed: successCount,
        failed: failCount,
        total: slidesToProcess.length,
        totalDurationSeconds: totalDuration,
        message: `Generated audio for ${successCount}/${slidesToProcess.length} slides (${Math.round(totalDuration / 60)}min total)`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ModuleAudio] Fatal error:', error);

    // Try to update module status to failed
    try {
      const { module_id } = await req.clone().json().catch(() => ({}));
      if (module_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from('modules')
          .update({ audio_status: 'failed' })
          .eq('id', module_id);
      }
    } catch {}

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
