import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createErrorResponse, createSuccessResponse, logInfo, logError, withErrorHandling } from "../_shared/error-handler.ts";

// ============================================================================
// SUBMIT BATCH SLIDES - Fast Placeholder Creation
// ============================================================================
//
// PURPOSE: Create placeholder records for batch slide generation
//
// WHY THIS APPROACH:
//   - Edge functions have 150s timeout
//   - Research for 78+ units takes 5+ minutes
//   - This function returns FAST (creates placeholders only)
//   - Frontend calls process-batch-research AFTER this returns
//
// FLOW:
//   1. Receive instructor_course_id and teaching_unit_ids[]
//   2. Validate input and check existing slides
//   3. Create batch_jobs record with status='preparing'
//   4. Create lecture_slides records with status='preparing'
//   5. Return immediately with batch_job_id
//   6. Frontend then calls process-batch-research to do the heavy work
//
// NOTE: This function does NOT call any AI models. The PROFESSOR_SYSTEM_PROMPT
// and prompt builders that were previously duplicated here (as dead code) have
// been consolidated into _shared/slide-prompts.ts and are used by
// process-batch-research when it actually generates slides.
//
// ============================================================================

// ============================================================================
// MAIN HANDLER
// ============================================================================

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    // ========================================================================
    // 1. SETUP AND VALIDATION
    // ========================================================================

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      if (token !== serviceRoleKey) {
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      }
    }

    // Parse request body
    const { instructor_course_id, teaching_unit_ids } = await req.json();

    if (!instructor_course_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'instructor_course_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!teaching_unit_ids?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'teaching_unit_ids array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Batch] Starting batch submission for ${teaching_unit_ids.length} teaching units`);

    // ========================================================================
    // 2. FETCH TEACHING UNIT DATA
    // ========================================================================

    const { data: units, error: unitsError } = await supabase
      .from('teaching_units')
      .select(`
        id,
        title,
        learning_objective_id
      `)
      .in('id', teaching_unit_ids);

    if (unitsError) {
      console.error('[Batch] Error fetching teaching units:', unitsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch teaching units' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!units || units.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No teaching units found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch course data for ownership check
    const { data: course, error: courseError } = await supabase
      .from('instructor_courses')
      .select('id, title, instructor_id')
      .eq('id', instructor_course_id)
      .single();

    if (courseError || !course) {
      console.error('[Batch] Error fetching course:', courseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Course not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // SECURITY: Verify course ownership
    // ========================================================================
    if (userId && course.instructor_id && course.instructor_id !== userId) {
      console.warn(`[Batch] Authorization failed. User ${userId} attempted to generate slides for course ${course.id} owned by ${course.instructor_id}.`);
      return new Response(
        JSON.stringify({ success: false, error: 'Not authorized to generate slides for this course' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Batch] Found ${units.length} teaching units for course: ${course.title}`);

    // ========================================================================
    // 3. CHECK FOR ACTIVE BATCH JOBS (DUPLICATE PREVENTION)
    // ========================================================================

    const { data: activeBatches } = await supabase
      .from('batch_jobs')
      .select('id, status, total_requests, succeeded_count, created_at')
      .eq('instructor_course_id', instructor_course_id)
      .in('status', ['preparing', 'researching', 'submitting', 'pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (activeBatches && activeBatches.length > 0) {
      const activeBatch = activeBatches[0];
      console.log(`[Batch] BLOCKED: Active batch ${activeBatch.id} already exists (status: ${activeBatch.status})`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `A batch job is already in progress (${activeBatch.status}). Please wait for it to complete.`,
          existing_batch: {
            id: activeBatch.id,
            status: activeBatch.status,
            total: activeBatch.total_requests,
            succeeded: activeBatch.succeeded_count,
            created_at: activeBatch.created_at,
          },
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // 4. CHECK FOR EXISTING SLIDES
    // ========================================================================

    const { data: existingSlides } = await supabase
      .from('lecture_slides')
      .select('teaching_unit_id, status')
      .in('teaching_unit_id', teaching_unit_ids);

    const existingMap = new Map(existingSlides?.map(s => [s.teaching_unit_id, s.status]) || []);

    const unitsToProcess = units.filter(unit => {
      const status = existingMap.get(unit.id);
      // Skip units that already have content or are actively being processed
      // BUT include 'pending' (orphan) and 'failed' records — they should be re-processed
      if (status === 'ready' || status === 'published' || status === 'generating' ||
          status === 'batch_pending' || status === 'preparing') {
        return false;
      }
      return true;
    });

    if (unitsToProcess.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All slides already generated or in progress',
          skipped: units.length,
          batch_job_id: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Batch] Processing ${unitsToProcess.length} units (skipping ${units.length - unitsToProcess.length} existing)`);

    // ========================================================================
    // 5. CREATE PLACEHOLDER RECORDS AND RETURN IMMEDIATELY
    // ========================================================================

    const preliminaryBatchJobId = crypto.randomUUID();

    const { error: prelimJobError } = await supabase
      .from('batch_jobs')
      .insert({
        id: preliminaryBatchJobId,
        google_batch_id: `pending-${preliminaryBatchJobId}`,
        instructor_course_id,
        job_type: 'slides',
        total_requests: unitsToProcess.length,
        status: 'preparing',
        request_mapping: {},
        created_by: userId,
      });

    if (prelimJobError) {
      console.error('[Batch] Error creating preliminary batch job:', prelimJobError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create batch job record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create pending slide records for UI progress tracking
    const pendingSlides = unitsToProcess.map((unit) => ({
      teaching_unit_id: unit.id,
      learning_objective_id: unit.learning_objective_id,
      instructor_course_id,
      title: unit.title,
      slides: [],
      total_slides: 0,
      status: 'preparing',
      batch_job_id: preliminaryBatchJobId,
      created_by: userId,
    }));

    const { error: slidesError } = await supabase
      .from('lecture_slides')
      .upsert(pendingSlides, { onConflict: 'teaching_unit_id' });

    if (slidesError) {
      logError('submit-batch-slides', new Error(slidesError.message), { action: 'create_slide_records' });
      // Clean up the batch job since slides failed
      await supabase.from('batch_jobs').update({ status: 'failed', error_message: slidesError.message }).eq('id', preliminaryBatchJobId);
      return createErrorResponse('INTERNAL_ERROR', corsHeaders,
        `Failed to create slide records: ${slidesError.message}`);
    }

    console.log(`[Batch] Created ${pendingSlides.length} preparing slide records`);

    // ========================================================================
    // 6. RETURN IMMEDIATELY - Frontend calls process-batch-research next
    // ========================================================================

    return new Response(
      JSON.stringify({
        success: true,
        batch_job_id: preliminaryBatchJobId,
        google_batch_id: null,
        total: unitsToProcess.length,
        skipped: units.length - unitsToProcess.length,
        status: 'preparing',
        message: `Created ${unitsToProcess.length} slide placeholders. Call process-batch-research to start.`,
        next_step: 'process-batch-research',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError("submit-batch-slides", error instanceof Error ? error : new Error(String(error)), { action: "batch_submission" });
    return createErrorResponse("INTERNAL_ERROR", corsHeaders, error instanceof Error ? error.message : "Unknown error");
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
