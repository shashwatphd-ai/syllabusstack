import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MODEL_CONFIG } from '../_shared/ai-orchestrator.ts';

// ============================================================================
// POLL BATCH STATUS - Check and process batch job results
// ============================================================================
//
// PURPOSE: Poll Google Batch API for job status and process results
//
// WHY THIS EXISTS:
//   - Google Batch API is async - need to poll for completion
//   - When batch completes, process results and update lecture_slides
//   - Frontend polls this every 30 seconds
//
// FLOW:
//   1. Receive batch_job_id or instructor_course_id
//   2. If batch_job_id: Poll Google API for status
//   3. If SUCCEEDED: Fetch results and update lecture_slides
//   4. Update batch_jobs record with status/counts
//   5. Return current status to frontend
//
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_BATCH_API = 'https://generativelanguage.googleapis.com/v1beta';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { batch_job_id, instructor_course_id } = await req.json();

    // ========================================================================
    // OPTION 1: Poll specific batch job
    // ========================================================================

    if (batch_job_id) {
      // Get batch job from database
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

      // If already completed, just return the status
      if (['completed', 'failed', 'partial'].includes(batchJob.status)) {
        return new Response(
          JSON.stringify({
            success: true,
            batch_job: batchJob,
            is_complete: true,
            progress_percent: 100,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Poll Google API for current status
      if (googleApiKey && batchJob.google_batch_id) {
        const pollResponse = await fetch(
          `${GOOGLE_BATCH_API}/${batchJob.google_batch_id}`,
          {
            method: 'GET',
            headers: {
              'x-goog-api-key': googleApiKey,
            },
          }
        );

        if (pollResponse.ok) {
          const googleStatus = await pollResponse.json();
          console.log(`[Poll] Google batch status: ${googleStatus.state}`);

          // Update our record with Google's counts
          // Google returns JOB_STATE_* format (e.g., JOB_STATE_SUCCEEDED)
          const updatedStatus =
            googleStatus.state === 'JOB_STATE_SUCCEEDED' || googleStatus.state === 'SUCCEEDED' ? 'completed' :
            googleStatus.state === 'JOB_STATE_FAILED' || googleStatus.state === 'FAILED' ? 'failed' :
            googleStatus.state === 'JOB_STATE_RUNNING' || googleStatus.state === 'RUNNING' ? 'processing' : 'submitted';

          await supabase
            .from('batch_jobs')
            .update({
              status: updatedStatus,
              succeeded_count: googleStatus.succeededCount || 0,
              failed_count: googleStatus.failedCount || 0,
              ...(updatedStatus === 'completed' || updatedStatus === 'failed' ? {
                completed_at: new Date().toISOString(),
              } : {}),
            })
            .eq('id', batch_job_id);

          // If batch is complete, process the results
          if (googleStatus.state === 'JOB_STATE_SUCCEEDED' || googleStatus.state === 'SUCCEEDED') {
            await processCompletedBatch(
              supabase,
              batchJob,
              googleStatus,
              googleApiKey
            );
          }

          // Calculate progress
          const total = batchJob.total_requests || 1;
          const done = (googleStatus.succeededCount || 0) + (googleStatus.failedCount || 0);
          const progressPercent = Math.round((done / total) * 100);

          return new Response(
            JSON.stringify({
              success: true,
              batch_job: {
                ...batchJob,
                status: updatedStatus,
                succeeded_count: googleStatus.succeededCount || 0,
                failed_count: googleStatus.failedCount || 0,
              },
              google_status: googleStatus.state,
              is_complete: ['SUCCEEDED', 'FAILED'].includes(googleStatus.state),
              progress_percent: progressPercent,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.error('[Poll] Google API error:', pollResponse.status);
        }
      }

      // Fallback: return current database status
      return new Response(
        JSON.stringify({
          success: true,
          batch_job: batchJob,
          is_complete: false,
          progress_percent: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // OPTION 2: Get overall course status
    // ========================================================================

    if (instructor_course_id) {
      // Get all batch jobs for this course
      const { data: batchJobs } = await supabase
        .from('batch_jobs')
        .select('id, google_batch_id, status, total_requests, succeeded_count, failed_count, created_at')
        .eq('instructor_course_id', instructor_course_id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get all slides for this course
      const { data: slides } = await supabase
        .from('lecture_slides')
        .select('id, teaching_unit_id, status, batch_job_id')
        .eq('instructor_course_id', instructor_course_id);

      // Count statuses
      const statusCounts = {
        pending: 0,
        batch_pending: 0,
        generating: 0,
        ready: 0,
        published: 0,
        failed: 0,
      };

      for (const slide of slides || []) {
        const status = slide.status as keyof typeof statusCounts;
        if (status in statusCounts) statusCounts[status]++;
      }

      // Find active batch job (if any)
      const activeBatch = batchJobs?.find(j =>
        j.status === 'submitted' || j.status === 'processing'
      );

      // If there's an active batch, poll it
      if (activeBatch && googleApiKey && activeBatch.google_batch_id) {
        const pollResponse = await fetch(
          `${GOOGLE_BATCH_API}/${activeBatch.google_batch_id}`,
          {
            method: 'GET',
            headers: {
              'x-goog-api-key': googleApiKey,
            },
          }
        );

        if (pollResponse.ok) {
          const googleStatus = await pollResponse.json();

          // Update batch job status
          const updatedStatus = googleStatus.state === 'SUCCEEDED' ? 'completed' :
                               googleStatus.state === 'FAILED' ? 'failed' :
                               googleStatus.state === 'RUNNING' ? 'processing' : 'submitted';

          await supabase
            .from('batch_jobs')
            .update({
              status: updatedStatus,
              succeeded_count: googleStatus.succeededCount || 0,
              failed_count: googleStatus.failedCount || 0,
            })
            .eq('id', activeBatch.id);

          // Process results if complete
          if (googleStatus.state === 'SUCCEEDED') {
            // Fetch full batch job for processing
            const { data: fullBatchJob } = await supabase
              .from('batch_jobs')
              .select('*')
              .eq('id', activeBatch.id)
              .single();

            if (fullBatchJob) {
              await processCompletedBatch(supabase, fullBatchJob, googleStatus, googleApiKey);
            }
          }

          activeBatch.status = updatedStatus;
          activeBatch.succeeded_count = googleStatus.succeededCount || 0;
          activeBatch.failed_count = googleStatus.failedCount || 0;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          total_slides: slides?.length || 0,
          ...statusCounts,
          // Combine pending types for backwards compatibility
          generating: statusCounts.generating + statusCounts.batch_pending,
          active_batch: activeBatch ? {
            id: activeBatch.id,
            status: activeBatch.status,
            total: activeBatch.total_requests,
            succeeded: activeBatch.succeeded_count || 0,
            failed: activeBatch.failed_count || 0,
          } : null,
          recent_batches: batchJobs?.slice(0, 3) || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'batch_job_id or instructor_course_id required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Poll] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// PROCESS COMPLETED BATCH
// ============================================================================
//
// When a batch job completes, fetch the results and update lecture_slides.
//

async function processCompletedBatch(
  supabase: any,
  batchJob: any,
  googleStatus: any,
  googleApiKey: string
) {
  console.log(`[Poll] Processing completed batch: ${batchJob.google_batch_id}`);

  // Fetch the full batch results
  // For inline batches, results are in googleStatus.inlined_responses (REST API)
  // or googleStatus.responses (SDK format)
  // For file-based batches, need to download from output URI
  const responses = googleStatus.inlined_responses || googleStatus.responses || [];

  if (responses.length === 0) {
    console.log('[Poll] No inline responses, batch may use file output');
    return;
  }

  const requestMapping = batchJob.request_mapping || {};
  let succeededCount = 0;
  let failedCount = 0;

  // Process responses - they include metadata.key for correlation
  for (let i = 0; i < responses.length; i++) {
    const responseWrapper = responses[i];
    // REST API wraps response in { response: {...}, metadata: {key: "slide_N"} }
    const response = responseWrapper.response || responseWrapper;
    const responseKey = responseWrapper.metadata?.key || `slide_${i}`;

    // Support both key-based (new) and index-based (legacy) mapping
    const teachingUnitId = requestMapping[responseKey] || requestMapping[i] || requestMapping[`slide_${i}`];

    if (!teachingUnitId) {
      console.warn(`[Poll] No mapping for index ${i}`);
      continue;
    }

    try {
      // Handle error in response
      if (response.error) {
        console.error(`[Poll] Error for index ${i}:`, response.error);
        failedCount++;

        await supabase
          .from('lecture_slides')
          .update({
            status: 'failed',
            error_message: response.error.message || 'Batch generation failed',
          })
          .eq('teaching_unit_id', teachingUnitId);

        continue;
      }

      // Extract content from response (support both formats)
      const content = response.candidates?.[0]?.content?.parts?.[0]?.text ||
                      response.response?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        console.warn(`[Poll] No content for index ${i}`);
        failedCount++;
        continue;
      }

      // Parse JSON from response (handle markdown code blocks)
      let slides;
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
        const parsed = JSON.parse(jsonStr);
        slides = parsed.slides || parsed;
      } catch (parseError) {
        console.error(`[Poll] JSON parse error for index ${i}:`, parseError);
        failedCount++;

        await supabase
          .from('lecture_slides')
          .update({
            status: 'failed',
            error_message: 'Failed to parse AI response',
          })
          .eq('teaching_unit_id', teachingUnitId);

        continue;
      }

      // Format slides for storage
      const formattedSlides = slides.map((slide: any) => ({
        order: slide.order,
        type: slide.type,
        title: slide.title,
        content: {
          main_text: slide.content?.main_text || '',
          key_points: slide.content?.key_points || [],
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
        },
        speaker_notes: slide.speaker_notes || '',
        speaker_notes_duration_seconds: slide.estimated_seconds || 60,
        pedagogy: slide.pedagogy || {},
      }));

      // Update lecture_slides record
      await supabase
        .from('lecture_slides')
        .update({
          slides: formattedSlides,
          total_slides: formattedSlides.length,
          status: 'ready',
          generation_model: MODEL_CONFIG.GEMINI_FLASH,
          estimated_duration_minutes: Math.round(formattedSlides.length * 1.5),
          generation_phases: {
            method: 'batch_api',
            completed_at: new Date().toISOString(),
          },
        })
        .eq('teaching_unit_id', teachingUnitId);

      succeededCount++;
      console.log(`[Poll] Saved ${formattedSlides.length} slides for ${teachingUnitId}`);

    } catch (err) {
      console.error(`[Poll] Error processing index ${i}:`, err);
      failedCount++;
    }
  }

  // Update batch job with final counts
  const finalStatus = failedCount === 0 ? 'completed' :
                      succeededCount === 0 ? 'failed' : 'partial';

  await supabase
    .from('batch_jobs')
    .update({
      status: finalStatus,
      succeeded_count: succeededCount,
      failed_count: failedCount,
      completed_at: new Date().toISOString(),
    })
    .eq('id', batchJob.id);

  console.log(`[Poll] Batch complete: ${succeededCount} succeeded, ${failedCount} failed`);
}
