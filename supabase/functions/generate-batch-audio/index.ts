/**
 * generate-batch-audio – Course-level batch audio orchestrator
 *
 * Follows the proven self-continuation pattern from process-batch-images:
 *  1. Pick the next N units that need audio (has_audio = false)
 *  2. Call generate-lecture-audio for each one sequentially
 *  3. Poll audio_status until ready/failed (with timeout)
 *  4. Self-invoke with an offset to continue the rest
 *
 * Input:  { instructorCourseId, offset?: number }
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

Deno.serve(async (req: Request) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json();
    const { instructorCourseId, offset = 0 } = body;

    if (!instructorCourseId) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'instructorCourseId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Query all units needing audio for this course
    const { data: allPending, error: queryError } = await supabase
      .from('lecture_slides')
      .select('id, title')
      .eq('instructor_course_id', instructorCourseId)
      .in('status', ['ready', 'published'])
      .eq('has_audio', false)
      .order('title', { ascending: true });

    if (queryError) {
      logError('generate-batch-audio', queryError);
      return createErrorResponse('DATABASE_ERROR', corsHeaders, queryError.message);
    }

    const total = allPending?.length || 0;

    if (total === 0) {
      logInfo('generate-batch-audio', 'nothing-to-do', { instructorCourseId });
      return createSuccessResponse({ success: true, processed: 0, remaining: 0, total: 0 }, corsHeaders);
    }

    // Take the current batch (offset-based)
    const batch = allPending.slice(offset, offset + BATCH_SIZE);
    let processed = 0;

    for (const unit of batch) {
      logInfo('generate-batch-audio', 'processing-unit', {
        slideId: unit.id,
        title: unit.title,
        position: offset + processed + 1,
        total,
      });

      // Fire the existing generate-lecture-audio function via internal fetch
      try {
        const audioResponse = await fetch(`${supabaseUrl}/functions/v1/generate-lecture-audio`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ slideId: unit.id, enableSegmentMapping: true }),
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
        // Continue to next unit even if one fails
      }

      processed++;

      // Inter-unit delay to respect rate limits
      if (processed < batch.length) {
        await new Promise(r => setTimeout(r, INTER_UNIT_DELAY_MS));
      }
    }

    const newOffset = offset + processed;
    const remaining = total - newOffset;

    // Self-continuation: if more units remain, fire-and-forget self-invoke
    if (remaining > 0) {
      logInfo('generate-batch-audio', 'self-continuing', { newOffset, remaining, total });

      // Fire-and-forget — don't await
      fetch(`${supabaseUrl}/functions/v1/generate-batch-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ instructorCourseId, offset: newOffset }),
      }).catch(err => {
        logError('generate-batch-audio', err instanceof Error ? err : new Error(String(err)), {
          context: 'self-continuation failed',
        });
      });
    } else {
      logInfo('generate-batch-audio', 'batch-complete', {
        instructorCourseId,
        totalProcessed: newOffset,
      });
    }

    return createSuccessResponse({
      success: true,
      processed,
      remaining,
      total,
      offset: newOffset,
    }, corsHeaders);

  } catch (error) {
    logError('generate-batch-audio', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
});
