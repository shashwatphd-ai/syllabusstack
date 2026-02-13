/**
 * generate-batch-audio – Course-level batch audio orchestrator
 *
 * Self-continuation pattern (shrinking-queue):
 *  1. Pick the next N units that need audio (has_audio = false, audio_status != 'generating')
 *  2. Fire generate-lecture-audio for each (non-blocking with 30s timeout), then poll status
 *  3. Re-count remaining and self-invoke with retry logic to continue
 *
 * Input:  { instructorCourseId }
 * Output: { success, processed, remaining, total }
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

const BATCH_SIZE = 2; // Units per invocation before self-continuing
const POLL_INTERVAL_MS = 10_000; // 10s between status polls
const MAX_POLL_ATTEMPTS = 36; // 6 min max wait per unit (36 × 10s)
const INTER_UNIT_DELAY_MS = 5_000; // 5s pause between units
const FETCH_TIMEOUT_MS = 30_000; // 30s timeout for initial generate-lecture-audio call
const SELF_CONTINUE_MAX_RETRIES = 3;
const SELF_CONTINUE_DELAY_MS = 2_000;

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
    // Use service role key for apikey header too — gateway rejects mismatched keys
    const gatewayKey = serviceKey;
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

    // Query units needing audio — only pick up units that haven't been attempted.
    // Exclude 'generating' (in-flight), 'ready' (done), and 'failed' (already tried)
    // to avoid infinite retry loops. Failed units can be retried manually by the user.
    const { data: pendingUnits, error: queryError } = await supabase
      .from('lecture_slides')
      .select('id, title')
      .eq('instructor_course_id', instructorCourseId)
      .in('status', ['ready', 'published'])
      .eq('has_audio', false)
      .not('audio_status', 'in', '("generating","ready","failed")')
      .order('title', { ascending: true })
      .limit(BATCH_SIZE);

    if (queryError) {
      logError('generate-batch-audio', queryError);
      return createErrorResponse('DATABASE_ERROR', corsHeaders, queryError.message);
    }

    const batch = pendingUnits || [];

    if (batch.length === 0) {
      logInfo('generate-batch-audio', 'nothing-to-do', { instructorCourseId });
      return createSuccessResponse({ success: true, processed: 0, remaining: 0, total: 0 }, corsHeaders);
    }

    let processed = 0;

    for (const unit of batch) {
      logInfo('generate-batch-audio', 'processing-unit', {
        slideId: unit.id,
        title: unit.title,
      });

      try {
        // Fire generate-lecture-audio with a timeout so we don't block on the
        // full processing duration. The polling loop handles completion detection.
        try {
          const audioResponse = await fetch(`${supabaseUrl}/functions/v1/generate-lecture-audio`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': gatewayKey,
            },
            body: JSON.stringify({ slideId: unit.id, enableSegmentMapping: true }),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });

          if (!audioResponse.ok) {
            const errorBody = await audioResponse.text();
            logError('generate-batch-audio', new Error(`generate-lecture-audio returned ${audioResponse.status}`), {
              slideId: unit.id,
              body: errorBody.substring(0, 500),
            });
            await supabase
              .from('lecture_slides')
              .update({ audio_status: 'failed' })
              .eq('id', unit.id);
            processed++;
            continue;
          }
        } catch (fetchErr) {
          // Timeout or network error — the function may still be running in the background.
          // Proceed to polling which checks the DB directly.
          const isTimeout = fetchErr instanceof DOMException && fetchErr.name === 'TimeoutError';
          const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          logInfo('generate-batch-audio', isTimeout ? 'fetch-timeout-proceeding-to-poll' : 'fetch-error-proceeding-to-poll', {
            slideId: unit.id,
            reason: msg,
          });
        }

        // Poll until audio_status becomes ready or failed
        let pollCount = 0;
        let finalStatus = 'generating';

        while (pollCount < MAX_POLL_ATTEMPTS) {
          await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
          pollCount++;

          const { data: statusData } = await supabase
            .from('lecture_slides')
            .select('audio_status, has_audio')
            .eq('id', unit.id)
            .single();

          finalStatus = statusData?.audio_status || 'unknown';

          if (finalStatus === 'ready' || finalStatus === 'failed') {
            break;
          }
        }

        // If polling timed out, mark as failed so it doesn't stay stuck
        if (finalStatus !== 'ready' && finalStatus !== 'failed') {
          logError('generate-batch-audio', new Error('Polling timeout — marking unit as failed'), {
            slideId: unit.id,
            lastStatus: finalStatus,
            pollAttempts: pollCount,
          });
          await supabase
            .from('lecture_slides')
            .update({ audio_status: 'failed' })
            .eq('id', unit.id);
          finalStatus = 'failed';
        }

        logInfo('generate-batch-audio', 'unit-complete', {
          slideId: unit.id,
          title: unit.title,
          finalStatus,
          pollAttempts: pollCount,
        });

      } catch (err) {
        logError('generate-batch-audio', err instanceof Error ? err : new Error(String(err)), {
          slideId: unit.id,
        });
      }

      processed++;

      if (processed < batch.length) {
        await new Promise(r => setTimeout(r, INTER_UNIT_DELAY_MS));
      }
    }

    // Re-count remaining units (must match the main query filter)
    const { count: remainingCount } = await supabase
      .from('lecture_slides')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_course_id', instructorCourseId)
      .in('status', ['ready', 'published'])
      .eq('has_audio', false)
      .not('audio_status', 'in', '("generating","ready","failed")');

    const remaining = remainingCount || 0;

    // Self-continuation with retry
    if (remaining > 0) {
      logInfo('generate-batch-audio', 'self-continuing', { remaining });

      let continued = false;
      for (let attempt = 1; attempt <= SELF_CONTINUE_MAX_RETRIES; attempt++) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/generate-batch-audio`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': gatewayKey,
            },
            body: JSON.stringify({ instructorCourseId }),
            signal: AbortSignal.timeout(30_000),
          });
          if (res.ok) {
            continued = true;
            logInfo('generate-batch-audio', 'self-continuation-success', { attempt });
            break;
          }
          logError('generate-batch-audio', new Error(`Self-continue returned ${res.status}`), { attempt });
        } catch (err) {
          logError('generate-batch-audio', err instanceof Error ? err : new Error(String(err)), {
            context: `self-continuation attempt ${attempt}/${SELF_CONTINUE_MAX_RETRIES}`,
          });
        }
        if (attempt < SELF_CONTINUE_MAX_RETRIES) {
          await new Promise(r => setTimeout(r, SELF_CONTINUE_DELAY_MS * Math.pow(2, attempt - 1)));
        }
      }

      if (!continued) {
        logError('generate-batch-audio', new Error('All self-continuation attempts failed'), {
          instructorCourseId,
          remaining,
        });
      }
    } else {
      logInfo('generate-batch-audio', 'batch-complete', { instructorCourseId, totalProcessed: processed });
    }

    return createSuccessResponse({
      success: true,
      processed,
      remaining,
      total: processed + remaining,
    }, corsHeaders);

  } catch (error) {
    logError('generate-batch-audio', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
});
