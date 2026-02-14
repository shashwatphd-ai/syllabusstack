/**
 * generate-batch-audio – Course-level batch audio orchestrator
 *
 * Fire-and-forget pattern (no in-function polling):
 *  1. Pick the next N units that need audio (audio_status IS NULL or 'pending')
 *  2. Fire generate-lecture-audio for each (non-blocking, don't wait)
 *  3. Self-continue after a delay so the next invocation picks up more pending units
 *     or detects all are done/in-flight.
 *
 * Input:  { instructorCourseId }
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

const BATCH_SIZE = 4; // Fire up to 4 units per invocation
const SELF_CONTINUE_DELAY_MS = 15_000; // 15s delay before self-continuing (gives units time to start)
const SELF_CONTINUE_MAX_RETRIES = 3;

Deno.serve(async (req: Request) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json();
    const { instructorCourseId } = body;

    if (!instructorCourseId) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'instructorCourseId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

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
    // Count current state
    // ========================================================================
    const { count: generatingCount } = await supabase
      .from('lecture_slides')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_course_id', instructorCourseId)
      .in('status', ['ready', 'published'])
      .eq('audio_status', 'generating');

    const currentlyGenerating = generatingCount || 0;

    // Query units needing audio — NULL or 'pending' status
    const { data: pendingUnits, error: queryError } = await supabase
      .from('lecture_slides')
      .select('id, title')
      .eq('instructor_course_id', instructorCourseId)
      .in('status', ['ready', 'published'])
      .eq('has_audio', false)
      .or('audio_status.is.null,audio_status.eq.pending')
      .order('title', { ascending: true })
      .limit(BATCH_SIZE);

    if (queryError) {
      logError('generate-batch-audio', queryError);
      return createErrorResponse('DATABASE_ERROR', corsHeaders, queryError.message);
    }

    const batch = pendingUnits || [];

    if (batch.length === 0 && currentlyGenerating === 0) {
      logInfo('generate-batch-audio', 'nothing-to-do', { instructorCourseId });
      return createSuccessResponse({ success: true, dispatched: 0, remaining: 0, generating: 0 }, corsHeaders);
    }

    // ========================================================================
    // Fire-and-forget: dispatch audio generation for each pending unit
    // ========================================================================
    let dispatched = 0;

    for (const unit of batch) {
      logInfo('generate-batch-audio', 'dispatching-unit', {
        slideId: unit.id,
        title: unit.title,
      });

      // Mark as generating immediately so next invocation skips it
      await supabase
        .from('lecture_slides')
        .update({ audio_status: 'generating' })
        .eq('id', unit.id);

      // Fire-and-forget — don't await the response
      fetch(`${supabaseUrl}/functions/v1/generate-lecture-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({ slideId: unit.id, enableSegmentMapping: true, skipGuard: true }),
      }).catch((err) => {
        // Log but don't block — the worker function handles its own status updates
        logError('generate-batch-audio', err instanceof Error ? err : new Error(String(err)), {
          slideId: unit.id,
          context: 'fire-and-forget dispatch failed',
        });
      });

      dispatched++;
    }

    // ========================================================================
    // Re-count remaining pending units
    // ========================================================================
    const { count: remainingCount } = await supabase
      .from('lecture_slides')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_course_id', instructorCourseId)
      .in('status', ['ready', 'published'])
      .eq('has_audio', false)
      .or('audio_status.is.null,audio_status.eq.pending');

    const remaining = remainingCount || 0;

    // Also count how many are now in-flight
    const { count: newGeneratingCount } = await supabase
      .from('lecture_slides')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_course_id', instructorCourseId)
      .in('status', ['ready', 'published'])
      .eq('audio_status', 'generating');

    const totalInFlight = newGeneratingCount || 0;

    logInfo('generate-batch-audio', 'batch-dispatched', {
      instructorCourseId,
      dispatched,
      remaining,
      totalInFlight,
    });

    // ========================================================================
    // Self-continuation: if there are still pending units, schedule next batch
    // ========================================================================
    if (remaining > 0 || totalInFlight > 0) {
      logInfo('generate-batch-audio', 'scheduling-self-continuation', { remaining, totalInFlight, delayMs: SELF_CONTINUE_DELAY_MS });

      // Fire-and-forget self-continuation after a delay
      // Do NOT await — this lets the current invocation return immediately
      setTimeout(() => {
        fetch(`${supabaseUrl}/functions/v1/generate-batch-audio`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
          },
          body: JSON.stringify({ instructorCourseId }),
        }).catch((err) => {
          logError('generate-batch-audio', err instanceof Error ? err : new Error(String(err)), {
            context: 'self-continuation fire-and-forget failed',
          });
        });
      }, SELF_CONTINUE_DELAY_MS);
    } else if (totalInFlight > 0) {
      // All dispatched but some still generating — schedule a check-back
      logInfo('generate-batch-audio', 'all-dispatched-waiting', {
        instructorCourseId,
        totalInFlight,
      });
    } else {
      logInfo('generate-batch-audio', 'batch-complete', { instructorCourseId, dispatched });
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
