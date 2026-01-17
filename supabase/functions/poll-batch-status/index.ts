import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// POLL BATCH STATUS - Check batch job progress
// ============================================================================
//
// PURPOSE: Check the status of a batch slide generation job
//
// WHY THIS EXISTS:
//   - Frontend needs to poll for batch job completion
//   - Provides clear progress visibility (X of Y complete)
//   - Replaces confusing "2 active, 83 queued" display
//
// REPLACES: process-lecture-queue's 'get-status' action
//
// USAGE:
//   - Frontend polls every 30 seconds (not 5s like old queue)
//   - Returns current status, progress counts, completion state
//   - Can also get overall course status without specific batch_job_id
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
    // ========================================================================
    // SETUP
    // ========================================================================

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { batch_job_id, instructor_course_id } = await req.json();

    // ========================================================================
    // OPTION 1: Get specific batch job status
    // ========================================================================
    //
    // If batch_job_id is provided, return detailed status for that job.
    //

    if (batch_job_id) {
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

      // Get current slide counts for this batch
      const { data: slides } = await supabase
        .from('lecture_slides')
        .select('status')
        .eq('batch_job_id', batch_job_id);

      const statusCounts = {
        ready: 0,
        failed: 0,
        batch_pending: 0,
        generating: 0,
      };

      for (const slide of slides || []) {
        const status = slide.status as keyof typeof statusCounts;
        if (status in statusCounts) statusCounts[status]++;
      }

      return new Response(
        JSON.stringify({
          success: true,
          batch_job: {
            id: batchJob.id,
            status: batchJob.status,
            total_requests: batchJob.total_requests,
            succeeded_count: batchJob.succeeded_count,
            failed_count: batchJob.failed_count,
            created_at: batchJob.created_at,
            completed_at: batchJob.completed_at,
            error_message: batchJob.error_message,
          },
          slides: statusCounts,
          // Progress percentage for UI
          progress_percent: Math.round(
            ((batchJob.succeeded_count + batchJob.failed_count) / batchJob.total_requests) * 100
          ),
          // Is the job done?
          is_complete: ['completed', 'failed', 'partial'].includes(batchJob.status),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // OPTION 2: Get overall course slides status
    // ========================================================================
    //
    // If only instructor_course_id is provided, return aggregate status.
    // This is used for the course detail page to show overall progress.
    //

    if (instructor_course_id) {
      // Get all batch jobs for this course
      const { data: batchJobs } = await supabase
        .from('batch_jobs')
        .select('id, status, total_requests, succeeded_count, failed_count, created_at')
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

      // Get total teaching units for this course (to know how many need slides)
      const { count: totalUnits } = await supabase
        .from('teaching_units')
        .select('id', { count: 'exact', head: true })
        .in('learning_objective_id',
          supabase
            .from('learning_objectives')
            .select('id')
            .eq('instructor_course_id', instructor_course_id)
        );

      // Find active batch job (if any)
      const activeBatch = batchJobs?.find(j =>
        j.status === 'submitted' || j.status === 'processing'
      );

      return new Response(
        JSON.stringify({
          success: true,
          // Overall status counts
          total_teaching_units: totalUnits || 0,
          total_slides: slides?.length || 0,
          ...statusCounts,
          // Active batch info (if any)
          active_batch: activeBatch ? {
            id: activeBatch.id,
            status: activeBatch.status,
            total: activeBatch.total_requests,
            succeeded: activeBatch.succeeded_count,
            failed: activeBatch.failed_count,
          } : null,
          // Recent batch jobs for history
          recent_batches: batchJobs?.slice(0, 3).map(j => ({
            id: j.id,
            status: j.status,
            total: j.total_requests,
            succeeded: j.succeeded_count,
            failed: j.failed_count,
            created_at: j.created_at,
          })) || [],
          // For backwards compatibility with old queue status format
          generating: statusCounts.generating + statusCounts.batch_pending,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // NEITHER PROVIDED
    // ========================================================================

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Either batch_job_id or instructor_course_id is required'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Poll] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
