/**
 * generate-batch-audio – Course-level batch audio orchestrator
 *
 * Fire-and-forget pattern with concurrency control:
 *  1. Reset stale workers (stuck > 10 min in "generating").
 *  2. Count in-flight workers. If under MAX_CONCURRENT, pick next pending/failed units.
 *  3. Fire generate-lecture-audio for each (non-blocking).
 *  4. Self-continue with backoff delay via fetch() (NOT setTimeout).
 *
 * Input:  { instructorCourseId, delayMs?, idleLoops? }
 * Output: { success, dispatched, remaining, generating }
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

const BATCH_SIZE = 2;
const MAX_CONCURRENT = 4;
const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const BACKOFF_DELAY_MS = 15_000;            // 15s between self-calls
const IDLE_DELAY_MS = 30_000;               // 30s when waiting for workers
const MAX_IDLE_LOOPS = 20;                  // Cap idle continuations (~10 min)

Deno.serve(async (req: Request) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json();
    const { instructorCourseId, delayMs, idleLoops = 0 } = body;

    if (!instructorCourseId) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'instructorCourseId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ========================================================================
    // Backoff delay: sleep if the previous invocation requested a delay
    // ========================================================================
    if (delayMs && delayMs > 0) {
      const sleepTime = Math.min(delayMs, 55_000); // Cap at 55s to stay under timeout
      logInfo('generate-batch-audio', 'sleeping', { sleepTime });
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
    }

    // ========================================================================
    // SECURITY: Verify caller identity and course ownership
    // ========================================================================
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      if (token !== serviceKey) {
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      }
    }

    const { data: course, error: courseError } = await supabase
      .from('instructor_courses')
      .select('id, instructor_id')
      .eq('id', instructorCourseId)
      .single();

    if (courseError || !course) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Course not found');
    }

    if (userId && course.instructor_id && course.instructor_id !== userId) {
      logError('generate-batch-audio', new Error('Authorization failed'), {
        userId,
        courseOwner: course.instructor_id,
        instructorCourseId,
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Not authorized to generate audio for this course' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // STALE WORKER DETECTION: Reset slides stuck in "generating" > 10 min
    // ========================================================================
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
    const { data: staleSlides } = await supabase
      .from('lecture_slides')
      .update({ audio_status: null })
      .eq('instructor_course_id', instructorCourseId)
      .eq('audio_status', 'generating')
      .lt('updated_at', staleThreshold)
      .select('id');

    if (staleSlides?.length) {
      logInfo('generate-batch-audio', 'reset-stale-workers', {
        count: staleSlides.length,
        slideIds: staleSlides.map((s: { id: string }) => s.id),
      });
    }

    // ========================================================================
    // Count current state
    // ========================================================================
    const { count: generatingCount } = await supabase
      .from('lecture_slides')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_course_id', instructorCourseId)
      .in('status', ['ready', 'published'])
      .eq('audio_status', 'generating');

    const currentlyGenerating = generatingCount || 0;

    const slotsAvailable = Math.max(0, MAX_CONCURRENT - currentlyGenerating);
    const fetchLimit = Math.min(BATCH_SIZE, slotsAvailable);

    // Query units needing audio
    const { data: pendingUnits, error: queryError } = await supabase
      .from('lecture_slides')
      .select('id, title')
      .eq('instructor_course_id', instructorCourseId)
      .in('status', ['ready', 'published'])
      .eq('has_audio', false)
      .or('audio_status.is.null,audio_status.eq.pending,audio_status.eq.failed')
      .order('title', { ascending: true })
      .limit(fetchLimit > 0 ? fetchLimit : 1);

    if (queryError) {
      logError('generate-batch-audio', queryError);
      return createErrorResponse('DATABASE_ERROR', corsHeaders, queryError.message);
    }

    const pendingTotal = pendingUnits?.length || 0;
    const batch = fetchLimit > 0 ? (pendingUnits || []) : [];

    // Nothing pending AND nothing generating → done
    if (pendingTotal === 0 && currentlyGenerating === 0) {
      logInfo('generate-batch-audio', 'all-complete', { instructorCourseId });
      return createSuccessResponse({ success: true, dispatched: 0, remaining: 0, generating: 0 }, corsHeaders);
    }

    // ========================================================================
    // Fire-and-forget: dispatch audio generation for each unit in the batch
    // ========================================================================
    let dispatched = 0;

    for (const unit of batch) {
      logInfo('generate-batch-audio', 'dispatching-unit', {
        slideId: unit.id,
        title: unit.title,
      });

      await supabase
        .from('lecture_slides')
        .update({ audio_status: 'generating' })
        .eq('id', unit.id);

      fetch(`${supabaseUrl}/functions/v1/generate-lecture-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({ slideId: unit.id, enableSegmentMapping: true, skipGuard: true }),
      }).catch((err) => {
        logError('generate-batch-audio', err instanceof Error ? err : new Error(String(err)), {
          slideId: unit.id,
          context: 'fire-and-forget dispatch failed',
        });
      });

      dispatched++;
    }

    // ========================================================================
    // Remaining count after dispatch
    // ========================================================================
    const { count: remainingCount } = await supabase
      .from('lecture_slides')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_course_id', instructorCourseId)
      .in('status', ['ready', 'published'])
      .eq('has_audio', false)
      .or('audio_status.is.null,audio_status.eq.pending,audio_status.eq.failed');

    const remaining = remainingCount || 0;
    const totalInFlight = currentlyGenerating + dispatched;

    logInfo('generate-batch-audio', 'batch-dispatched', {
      instructorCourseId,
      dispatched,
      remaining,
      totalInFlight,
    });

    // ========================================================================
    // CIRCUIT BREAKER: Smart self-continuation
    // ========================================================================
    if (dispatched > 0 || (remaining > 0 && slotsAvailable > 0)) {
      // We did work or have capacity — continue with standard backoff
      logInfo('generate-batch-audio', 'self-continuing', { remaining, totalInFlight, delay: BACKOFF_DELAY_MS });

      fetch(`${supabaseUrl}/functions/v1/generate-batch-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({ instructorCourseId, delayMs: BACKOFF_DELAY_MS, idleLoops: 0 }),
      }).catch((err) => {
        logError('generate-batch-audio', err instanceof Error ? err : new Error(String(err)), {
          context: 'self-continuation failed',
        });
      });
    } else if (totalInFlight > 0 && remaining > 0) {
      // Workers running but no slots — wait longer before checking again
      logInfo('generate-batch-audio', 'waiting-for-workers', { totalInFlight, remaining, delay: IDLE_DELAY_MS });

      fetch(`${supabaseUrl}/functions/v1/generate-batch-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({ instructorCourseId, delayMs: IDLE_DELAY_MS, idleLoops: 0 }),
      }).catch((err) => {
        logError('generate-batch-audio', err instanceof Error ? err : new Error(String(err)), {
          context: 'idle self-continuation failed',
        });
      });
    } else if (currentlyGenerating > 0 && remaining === 0 && dispatched === 0 && idleLoops < MAX_IDLE_LOOPS) {
      // Workers still in-flight but no pending work — keep polling so stale detection can catch failures
      const nextIdleLoop = idleLoops + 1;
      logInfo('generate-batch-audio', 'idle-polling-for-stale', {
        currentlyGenerating,
        idleLoop: nextIdleLoop,
        maxIdleLoops: MAX_IDLE_LOOPS,
        delay: IDLE_DELAY_MS,
      });

      fetch(`${supabaseUrl}/functions/v1/generate-batch-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({ instructorCourseId, delayMs: IDLE_DELAY_MS, idleLoops: nextIdleLoop }),
      }).catch((err) => {
        logError('generate-batch-audio', err instanceof Error ? err : new Error(String(err)), {
          context: 'idle-stale-detection self-continuation failed',
        });
      });
    } else {
      logInfo('generate-batch-audio', 'loop-stopped', {
        instructorCourseId,
        dispatched,
        remaining,
        totalInFlight,
        idleLoops,
        reason: currentlyGenerating > 0 ? 'max-idle-loops-reached' : remaining === 0 ? 'no-remaining-work' : 'no-progress-possible',
      });
    }

    return createSuccessResponse({
      success: true,
      dispatched,
      remaining,
      generating: totalInFlight,
    }, corsHeaders);

  } catch (error) {
    logError('generate-batch-audio', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
});
