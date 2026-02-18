// ============================================================================
// POLL BATCH STATUS - Check slide generation progress
// ============================================================================
//
// PURPOSE: Return slide generation status for a single batch job or an entire
//          course. The frontend polls this every ~30 seconds to update the UI.
//
// MODES:
//   1. batch_job_id  → Single batch job status + slide counts
//   2. instructor_course_id → Aggregated course-wide slide status
//
// SELF-HEALING: Detects stalled records (>30 min inactive) and resets them
//   - 'generating' slides → 'failed'
//   - 'preparing'/'batch_pending' slides → 'pending' (retry)
//   - 'researching' batch jobs → 'failed'
//
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  logInfo,
  logError,
  withErrorHandling,
} from "../_shared/error-handler.ts";

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

// ============================================================================
// MAIN HANDLER
// ============================================================================

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);
  const functionName = "[poll-batch-status]";

  // Authenticate
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return createErrorResponse("UNAUTHORIZED", corsHeaders, "Missing authorization");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify user
  const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) {
    return createErrorResponse("UNAUTHORIZED", corsHeaders, "Invalid token");
  }

  const body = await req.json();
  const { batch_job_id, instructor_course_id } = body;

  // Verify ownership: ensure the user owns the course they're polling
  const courseIdToCheck = instructor_course_id
    || (batch_job_id ? undefined : null); // will resolve via batch job lookup below
  if (courseIdToCheck) {
    const { data: course } = await supabase
      .from("instructor_courses")
      .select("instructor_id")
      .eq("id", courseIdToCheck)
      .single();
    if (course?.instructor_id !== user.id) {
      return createErrorResponse("FORBIDDEN", corsHeaders, "Not authorized for this course");
    }
  }

  // ========================================================================
  // MODE 1: Single batch job
  // ========================================================================
  if (batch_job_id) {
    logInfo(functionName, "polling-batch", { batch_job_id });

    const { data: batchJob, error: jobError } = await supabase
      .from("batch_jobs")
      .select("*")
      .eq("id", batch_job_id)
      .single();

    if (jobError || !batchJob) {
      return createErrorResponse("NOT_FOUND", corsHeaders, "Batch job not found");
    }

    // Verify ownership via batch job's course
    const { data: batchCourse } = await supabase
      .from("instructor_courses")
      .select("instructor_id")
      .eq("id", batchJob.instructor_course_id)
      .single();
    if (batchCourse?.instructor_id !== user.id) {
      return createErrorResponse("FORBIDDEN", corsHeaders, "Not authorized for this course");
    }

    // Get slide counts for this batch's course
    const { data: slides } = await supabase
      .from("lecture_slides")
      .select("status")
      .eq("instructor_course_id", batchJob.instructor_course_id);

    const slideCounts = countSlideStatuses(slides || []);
    const total = slideCounts.ready + slideCounts.failed + slideCounts.batch_pending + slideCounts.generating;
    const progressPercent = total > 0 ? Math.round((slideCounts.ready / total) * 100) : 0;

    return createSuccessResponse(
      {
        success: true,
        batch_job: {
          id: batchJob.id,
          status: batchJob.status,
          total_requests: batchJob.total_requests,
          succeeded_count: batchJob.succeeded_count || 0,
          failed_count: batchJob.failed_count || 0,
          created_at: batchJob.created_at,
          completed_at: batchJob.completed_at,
          error_message: batchJob.error_message,
        },
        slides: slideCounts,
        progress_percent: progressPercent,
        is_complete: ["completed", "partial", "failed"].includes(batchJob.status),
      },
      corsHeaders
    );
  }

  // ========================================================================
  // MODE 2: Course-wide status
  // ========================================================================
  if (instructor_course_id) {
    logInfo(functionName, "polling-course", { instructor_course_id });

    // Count teaching units
    const { count: tuCount } = await supabase
      .from("teaching_units")
      .select("id", { count: "exact", head: true })
      .in(
        "learning_objective_id",
        (
          await supabase
            .from("learning_objectives")
            .select("id")
            .eq("instructor_course_id", instructor_course_id)
        ).data?.map((lo: { id: string }) => lo.id) || []
      );

    // Get all slides for this course
    const { data: slides } = await supabase
      .from("lecture_slides")
      .select("id, status, updated_at")
      .eq("instructor_course_id", instructor_course_id);

    const allSlides = slides || [];

    // Self-healing: reset stalled slides
    await selfHealSlides(supabase, allSlides, functionName);

    const slideCounts = countSlideStatuses(allSlides);

    // Get active batch (most recent non-terminal)
    const { data: activeBatches } = await supabase
      .from("batch_jobs")
      .select("id, status, total_requests, succeeded_count, failed_count, created_at")
      .eq("instructor_course_id", instructor_course_id)
      .in("status", ["submitted", "processing", "researching"])
      .order("created_at", { ascending: false })
      .limit(1);

    // Self-heal stalled batch jobs
    if (activeBatches && activeBatches.length > 0) {
      const batch = activeBatches[0];
      if (batch.status === "researching") {
        const updatedAt = new Date(batch.created_at).getTime();
        if (Date.now() - updatedAt > STALE_THRESHOLD_MS) {
          logInfo(functionName, "self-heal-batch", { batch_id: batch.id });
          await supabase
            .from("batch_jobs")
            .update({ status: "failed", error_message: "Timed out", updated_at: new Date().toISOString() })
            .eq("id", batch.id);
          activeBatches.length = 0;
        }
      }
    }

    // Get recent batches
    const { data: recentBatches } = await supabase
      .from("batch_jobs")
      .select("id, status, total_requests, succeeded_count, failed_count, created_at")
      .eq("instructor_course_id", instructor_course_id)
      .order("created_at", { ascending: false })
      .limit(5);

    const activeBatch =
      activeBatches && activeBatches.length > 0
        ? {
            id: activeBatches[0].id,
            status: activeBatches[0].status,
            total: activeBatches[0].total_requests,
            succeeded: activeBatches[0].succeeded_count || 0,
            failed: activeBatches[0].failed_count || 0,
          }
        : null;

    const totalSlides = allSlides.length;
    const progressPercent =
      totalSlides > 0 ? Math.round((slideCounts.ready / totalSlides) * 100) : 0;

    // Image generation queue stats (service role bypasses RLS)
    const { data: imageQueueItems } = await supabase
      .from("image_generation_queue")
      .select("status, lecture_slides_id!inner(instructor_course_id)")
      .eq("lecture_slides_id.instructor_course_id", instructor_course_id);

    const imageQueue = { pending: 0, processing: 0, completed: 0, failed: 0 };
    const queuedSlideIds = new Set<string>();
    for (const item of imageQueueItems || []) {
      const key = item.status as keyof typeof imageQueue;
      if (key in imageQueue) imageQueue[key]++;
      // Track which lecture_slides_ids have queue entries (any status)
      if (item.lecture_slides_id && typeof item.lecture_slides_id === "string") {
        queuedSlideIds.add(item.lecture_slides_id);
      }
    }

    // Count slides that have a visual type but no image URL and NO queue entry at all.
    // These are "orphaned" slides that were silently skipped during the original populate scan.
    // We surface them as `unqueued_missing` so the frontend can show the correct total count
    // and keep the "Generate Images" button visible.
    const { data: publishedSlides } = await supabase
      .from("lecture_slides")
      .select("id, slides")
      .eq("instructor_course_id", instructor_course_id)
      .in("status", ["published", "ready"]);

    let unqueuedMissing = 0;
    const unqueuedLectureSlidesIds: string[] = [];
    for (const lectureSlide of publishedSlides || []) {
      const slidesArray = Array.isArray(lectureSlide.slides) ? lectureSlide.slides : [];
      // Check if any slide in this lecture_slides record has a visual with type but no url
      const hasMissingVisual = slidesArray.some((slide: { visual?: { type?: string; url?: string | null } }) =>
        slide.visual?.type && slide.visual.type !== "none" && !slide.visual?.url
      );
      if (hasMissingVisual && !queuedSlideIds.has(lectureSlide.id)) {
        unqueuedMissing++;
        unqueuedLectureSlidesIds.push(lectureSlide.id);
      }
    }

    return createSuccessResponse(
      {
        success: true,
        total_teaching_units: tuCount || 0,
        total_slides: totalSlides,
        pending: slideCounts.pending,
        batch_pending: slideCounts.batch_pending,
        generating: slideCounts.generating,
        ready: slideCounts.ready,
        published: slideCounts.published,
        failed: slideCounts.failed,
        active_batch: activeBatch,
        recent_batches: (recentBatches || []).map((b) => ({
          id: b.id,
          status: b.status,
          total: b.total_requests,
          succeeded: b.succeeded_count || 0,
          failed: b.failed_count || 0,
          created_at: b.created_at,
        })),
        progress_percent: progressPercent,
        image_queue: imageQueue,
        unqueued_missing: unqueuedMissing,
        unqueued_lecture_slides_ids: unqueuedLectureSlidesIds,
      },
      corsHeaders
    );
  }

  return createErrorResponse(
    "BAD_REQUEST",
    corsHeaders,
    "Provide batch_job_id or instructor_course_id"
  );
};

// ============================================================================
// HELPERS
// ============================================================================

function countSlideStatuses(slides: { status: string }[]) {
  const counts = { pending: 0, preparing: 0, batch_pending: 0, generating: 0, ready: 0, published: 0, failed: 0 };
  for (const s of slides) {
    const key = s.status as keyof typeof counts;
    if (key in counts) counts[key]++;
  }
  return counts;
}

async function selfHealSlides(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  slides: { id: string; status: string; updated_at: string }[],
  functionName: string
) {
  const now = Date.now();
  const staleIds: { toFailed: string[]; toPending: string[] } = { toFailed: [], toPending: [] };

  for (const slide of slides) {
    const age = now - new Date(slide.updated_at).getTime();
    if (age < STALE_THRESHOLD_MS) continue;

    if (slide.status === "generating") staleIds.toFailed.push(slide.id);
    else if (slide.status === "preparing" || slide.status === "batch_pending")
      staleIds.toPending.push(slide.id);
  }

  if (staleIds.toFailed.length > 0) {
    logInfo(functionName, "self-heal-generating", { count: staleIds.toFailed.length });
    await supabase
      .from("lecture_slides")
      .update({ status: "failed", error_message: "Timed out after 30 minutes" })
      .in("id", staleIds.toFailed);
  }

  if (staleIds.toPending.length > 0) {
    logInfo(functionName, "self-heal-pending", { count: staleIds.toPending.length });
    await supabase
      .from("lecture_slides")
      .update({ status: "pending" })
      .in("id", staleIds.toPending);
  }
}

Deno.serve(withErrorHandling(handler, getCorsHeaders));
