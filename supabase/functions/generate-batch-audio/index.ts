/**
 * generate-batch-audio – Course-level batch audio orchestrator
 *
 * Fire-and-forget pattern with concurrency control:
 *  1. Count in-flight workers. If under MAX_CONCURRENT, pick next pending/failed units.
 *  2. Fire generate-lecture-audio for each (non-blocking).
 *  3. Self-continue immediately via fetch() (NOT setTimeout — Deno kills timers after response).
 *     Each invocation is short-lived; the chain continues until all units are done.
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

const BATCH_SIZE = 2;       // Dispatch up to 2 units per invocation
const MAX_CONCURRENT = 4;   // Max workers running simultaneously

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

    // How many new workers can we start?
    const slotsAvailable = Math.max(0, MAX_CONCURRENT - currentlyGenerating);
    const fetchLimit = Math.min(BATCH_SIZE, slotsAvailable);

    // Query units needing audio — NULL, 'pending', or 'failed' status
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
        logError('generate-batch-audio', err instanceof Error ? err : new Error(String(err)), {
          slideId: unit.id,
          context: 'fire-and-forget dispatch failed',
        });
      });

      dispatched++;
    }

    // ========================================================================
    // Self-continuation: if work remains, fire another invocation immediately
    // ========================================================================
    // We count remaining AFTER dispatching (the ones we just dispatched are now
    // 'generating' so they won't appear here).
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

    if (remaining > 0 || totalInFlight > 0) {
      logInfo('generate-batch-audio', 'self-continuing', { remaining, totalInFlight });

      // Fire-and-forget self-continuation via fetch() — NOT setTimeout()
      // setTimeout is killed when the Deno isolate shuts down after response.
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
          context: 'self-continuation failed',
        });
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
