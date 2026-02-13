/**
 * generate-batch-audio – Course-level batch audio orchestrator
 *
 * Fixed orchestrator using a shrinking-queue pattern:
 *  1. Query the next BATCH_SIZE units needing audio (has_audio = false, not already generating)
 *  2. Call generate-lecture-audio for each one with a 30s fetch timeout
 *  3. Poll audio_status until ready/failed (with timeout, marks stuck units as failed)
 *  4. Re-count remaining and self-invoke with retry logic to continue
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
const MAX_POLL_ATTEMPTS = 60; // 10 min max wait per unit (60 × 10s)
const INTER_UNIT_DELAY_MS = 5_000; // 5s pause between units
const FETCH_TIMEOUT_MS = 30_000; // 30s timeout for initial generate-lecture-audio call
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

    // BUG 1 FIX: Query with LIMIT instead of offset. Processed units drop out
    // of the result set (has_audio flips to true), so we always pick from the top.
    // Also exclude units already in 'generating' state to avoid double-processing.
    const { data: batch, error: queryError } = await supabase
      .from('lecture_slides')
      .select('id, title')
      .eq('instructor_course_id', instructorCourseId)
      .in('status', ['ready', 'published'])
      .eq('has_audio', false)
      .not('audio_status', 'eq', 'generating')
      .order('title', { ascending: true })
      .limit(BATCH_SIZE);

    if (queryError) {
      logError('generate-batch-audio', queryError);
      return createErrorResponse('DATABASE_ERROR', corsHeaders, queryError.message);
    }

    if (!batch || batch.length === 0) {
      logInfo('generate-batch-audio', 'nothing-to-do', { instructorCourseId });
      return createSuccessResponse({ success: true, processed: 0, remaining: 0, total: 0 }, corsHeaders);
    }

    let processed = 0;

    for (const unit of batch) {
      logInfo('generate-batch-audio', 'processing-unit', {
        slideId: unit.id,
        title: unit.title,
        position: processed + 1,
        batchSize: batch.length,
      });

      // FLAW 7 FIX: Add AbortSignal.timeout so we don't block on the full response.
      // The polling loop handles actual completion detection.
      try {
        const audioResponse = await fetch(`${supabaseUrl}/functions/v1/generate-lecture-audio`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
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
          // Mark as failed and continue to next unit
          await supabase
            .from('lecture_slides')
            .update({ audio_status: 'failed' })
            .eq('id', unit.id);
          processed++;
          continue;
        }

        // Check if already generating (returned immediately)
        const result = await audioResponse.json();
        if (result.alreadyGenerating) {
          logInfo('generate-batch-audio', 'already-generating', { slideId: unit.id });
        }
      } catch (fetchErr) {
        // Timeout or network error on the initial call.
        // The generate-lecture-audio function may still be running in the background,
        // so we proceed to polling rather than immediately marking as failed.
        const isTimeout = fetchErr instanceof DOMException && fetchErr.name === 'TimeoutError';
        logInfo('generate-batch-audio', isTimeout ? 'fetch-timeout-proceeding-to-poll' : 'fetch-error-proceeding-to-poll', {
          slideId: unit.id,
          error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
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
          .select('audio_status')
          .eq('id', unit.id)
          .single();

        finalStatus = statusData?.audio_status || 'unknown';

        if (finalStatus === 'ready' || finalStatus === 'failed') {
          break;
        }
      }

      // FLAW 4 FIX: If polling timed out, explicitly mark the unit as failed
      // to prevent infinite stuck loops.
      if (finalStatus !== 'ready' && finalStatus !== 'failed') {
        logError('generate-batch-audio', new Error('Polling timeout — marking unit as failed'), {
          slideId: unit.id,
          finalStatus,
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

      processed++;

      // Inter-unit delay to respect rate limits
      if (processed < batch.length) {
        await new Promise(r => setTimeout(r, INTER_UNIT_DELAY_MS));
      }
    }

    // Re-count remaining units (don't rely on stale counts)
    const { count: remaining } = await supabase
      .from('lecture_slides')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_course_id', instructorCourseId)
      .in('status', ['ready', 'published'])
      .eq('has_audio', false)
      .not('audio_status', 'eq', 'generating');

    const actualRemaining = remaining ?? 0;

    // FLAW 5 FIX: Self-continuation with retry loop instead of single fire-and-forget
    if (actualRemaining > 0) {
      logInfo('generate-batch-audio', 'self-continuing', { remaining: actualRemaining });

      let continued = false;
      for (let attempt = 1; attempt <= SELF_CONTINUE_MAX_RETRIES; attempt++) {
        try {
          const continueResponse = await fetch(`${supabaseUrl}/functions/v1/generate-batch-audio`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ instructorCourseId }),
            signal: AbortSignal.timeout(10_000),
          });

          if (continueResponse.ok) {
            continued = true;
            logInfo('generate-batch-audio', 'self-continuation-success', { attempt });
            break;
          } else {
            logError('generate-batch-audio', new Error(`Self-continuation attempt ${attempt} returned ${continueResponse.status}`));
          }
        } catch (err) {
          logError('generate-batch-audio', err instanceof Error ? err : new Error(String(err)), {
            context: `self-continuation attempt ${attempt} failed`,
          });
        }

        // Exponential backoff: 2s, 4s, 8s
        if (attempt < SELF_CONTINUE_MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
        }
      }

      if (!continued) {
        logError('generate-batch-audio', new Error('All self-continuation attempts failed'), {
          instructorCourseId,
          remaining: actualRemaining,
        });
      }
    } else {
      logInfo('generate-batch-audio', 'batch-complete', {
        instructorCourseId,
        totalProcessed: processed,
      });
    }

    return createSuccessResponse({
      success: true,
      processed,
      remaining: actualRemaining,
      total: processed + actualRemaining,
    }, corsHeaders);

  } catch (error) {
    logError('generate-batch-audio', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
});
