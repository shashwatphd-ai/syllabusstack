// ============================================================================
// POLL BATCH EVALUATION - Process Vertex AI Batch Evaluation Results
// ============================================================================
//
// PURPOSE: Check Vertex AI batch job status, download results, parse scores,
// and update content_matches with evaluation data.
//
// TRIGGER: Called periodically (cron) or manually after submit-batch-evaluation
//
// FLOW:
//   1. Fetch batch_jobs record
//   2. Get Vertex AI job status
//   3. If complete: Download output from GCS
//   4. Parse JSONL results
//   5. Update content_matches with scores
//   6. Update batch_jobs with final status
//
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { createVertexAIAuth } from '../_shared/vertex-ai-auth.ts';
import { createGCSClient } from '../_shared/gcs-client.ts';
import { createVertexAIBatchClient, VertexAIBatchClient } from '../_shared/vertex-ai-batch.ts';
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

// ============================================================================
// TYPES
// ============================================================================

interface VideoEvaluation {
  video_id: string;
  relevance_score: number;
  pedagogy_score: number;
  quality_score: number;
  total_score: number;
  reasoning: string;
  recommendation: 'highly_recommended' | 'recommended' | 'acceptable' | 'not_recommended';
  red_flags: string[] | null;
  strengths: string[] | null;
}

interface EvaluationResponse {
  evaluations: VideoEvaluation[];
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);
  const functionName = '[poll-batch-evaluation]';
  console.log(`${functionName} Starting...`);

  try {
    // ========================================================================
    // STEP 1: Parse request
    // ========================================================================
    const { batch_job_id } = await req.json();

    if (!batch_job_id) {
      throw new Error('batch_job_id is required');
    }

    console.log(`${functionName} Polling job: ${batch_job_id}`);

    // Initialize clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ========================================================================
    // STEP 2: Fetch batch_jobs record
    // ========================================================================
    const { data: batchJob, error: jobError } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('id', batch_job_id)
      .single();

    if (jobError || !batchJob) {
      throw new Error(`Batch job not found: ${batch_job_id}`);
    }

    if (batchJob.job_type !== 'evaluation') {
      throw new Error(`Invalid job type: ${batchJob.job_type}, expected 'evaluation'`);
    }

    // Already completed?
    if (['completed', 'partial', 'failed'].includes(batchJob.status)) {
      console.log(`${functionName} Job already in terminal state: ${batchJob.status}`);
      return createSuccessResponse({
        success: true,
        status: batchJob.status,
        succeeded_count: batchJob.succeeded_count || 0,
        failed_count: batchJob.failed_count || 0,
        message: `Job already ${batchJob.status}`,
        is_complete: true
      }, corsHeaders);
    }

    // ========================================================================
    // STEP 3: Get Vertex AI job status
    // ========================================================================
    let auth, gcsClient, batchClient;
    try {
      auth = createVertexAIAuth();
      gcsClient = createGCSClient(auth);
      batchClient = createVertexAIBatchClient(auth);
    } catch (error) {
      console.error(`${functionName} Vertex AI init failed:`, error);
      throw error;
    }

    if (!batchJob.google_batch_id || batchJob.google_batch_id.startsWith('pending-')) {
      throw new Error('No valid google_batch_id found for this job');
    }

    const vertexStatus = await batchClient.getBatchJob(batchJob.google_batch_id);
    console.log(`${functionName} Vertex AI status: ${vertexStatus.state}`);

    // Map Vertex state to our status
    const newStatus = VertexAIBatchClient.mapJobStateToStatus(vertexStatus.state);

    // If still processing, just update status and return
    if (!VertexAIBatchClient.isTerminalState(vertexStatus.state)) {
      await supabase
        .from('batch_jobs')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', batch_job_id);

      return createSuccessResponse({
        success: true,
        status: newStatus,
        vertex_state: vertexStatus.state,
        succeeded_count: 0,
        failed_count: 0,
        message: `Job still ${newStatus}, check again later`,
        is_complete: false
      }, corsHeaders);
    }

    // ========================================================================
    // STEP 4: Download output from GCS
    // ========================================================================
    if (!vertexStatus.outputInfo?.gcsOutputDirectory) {
      throw new Error('No output directory in Vertex AI response');
    }

    console.log(`${functionName} Downloading results from: ${vertexStatus.outputInfo.gcsOutputDirectory}`);

    // List files in output directory
    const outputFiles = await gcsClient.listFiles(vertexStatus.outputInfo.gcsOutputDirectory);
    const jsonlFiles = outputFiles.filter(f => f.endsWith('.jsonl'));

    if (jsonlFiles.length === 0) {
      throw new Error('No JSONL output files found');
    }

    // Download and concatenate all JSONL files
    const allResults: any[] = [];
    for (const file of jsonlFiles) {
      try {
        const lines = await gcsClient.downloadJsonl(`gs://${gcsClient.bucketName}/${file}`);
        allResults.push(...lines);
        console.log(`${functionName} Downloaded ${lines.length} results from ${file}`);
      } catch (downloadError) {
        console.error(`${functionName} Failed to download ${file}:`, downloadError);
      }
    }

    console.log(`${functionName} Total results to process: ${allResults.length}`);

    // ========================================================================
    // STEP 5: Process results and update content_matches
    // ========================================================================
    const requestMapping = batchJob.request_mapping || {};
    let succeededCount = 0;
    let failedCount = 0;
    let videosEvaluated = 0;

    for (let i = 0; i < allResults.length; i++) {
      const result = allResults[i] as any;

      // Get content_match IDs and video IDs from mapping
      // Format: "eval_0" -> ["match_id:video_id", "match_id:video_id", ...]
      const mappingKey = `eval_${i}`;
      const mappingValue = requestMapping[mappingKey];

      if (!mappingValue || !Array.isArray(mappingValue)) {
        console.warn(`${functionName} No mapping for key ${mappingKey}`);
        failedCount++;
        continue;
      }

      // Build lookup from video_id to content_match_id
      const videoToMatch: Record<string, string> = {};
      for (const pair of mappingValue) {
        const [matchId, videoId] = pair.split(':');
        if (matchId && videoId) {
          videoToMatch[videoId] = matchId;
        }
      }

      // Check for error in response
      const responseStatus = result.status;
      if (responseStatus && responseStatus !== 'SUCCESS' && responseStatus !== '') {
        console.error(`${functionName} Error for request ${i}:`, responseStatus);
        failedCount++;

        // Mark all matches in this request as failed (reset to pending for retry)
        for (const matchId of Object.values(videoToMatch)) {
          await supabase
            .from('content_matches')
            .update({ status: 'pending' })
            .eq('id', matchId);
        }
        continue;
      }

      // Also check for error object
      if (result.response?.error || result.error) {
        console.error(`${functionName} Error object for request ${i}:`, result.response?.error || result.error);
        failedCount++;

        for (const matchId of Object.values(videoToMatch)) {
          await supabase
            .from('content_matches')
            .update({ status: 'pending' })
            .eq('id', matchId);
        }
        continue;
      }

      // Extract content from response
      const content = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        console.warn(`${functionName} No content in response for request ${i}`);
        failedCount++;
        for (const matchId of Object.values(videoToMatch)) {
          await supabase
            .from('content_matches')
            .update({ status: 'pending' })
            .eq('id', matchId);
        }
        continue;
      }

      // Parse JSON response (with markdown stripping)
      let evalResponse: EvaluationResponse;
      try {
        let jsonStr = content.trim();

        // Pattern 1: Standard markdown code blocks
        const codeBlockMatch = content.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```/s);
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonStr = codeBlockMatch[1].trim();
        } else {
          // Pattern 2: Remove leading/trailing backticks
          jsonStr = jsonStr.replace(/^```(?:json|JSON)?\s*\n?/, '');
          jsonStr = jsonStr.replace(/\n?```\s*$/, '');
        }

        // Pattern 3: Final cleanup
        jsonStr = jsonStr.replace(/^`+/, '').replace(/`+$/, '');

        evalResponse = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error(`${functionName} JSON parse error for request ${i}:`, parseError);
        failedCount++;
        for (const matchId of Object.values(videoToMatch)) {
          await supabase
            .from('content_matches')
            .update({ status: 'pending' })
            .eq('id', matchId);
        }
        continue;
      }

      // Validate response has evaluations
      if (!evalResponse.evaluations || !Array.isArray(evalResponse.evaluations)) {
        console.warn(`${functionName} No evaluations in response for request ${i}`);
        failedCount++;
        for (const matchId of Object.values(videoToMatch)) {
          await supabase
            .from('content_matches')
            .update({ status: 'pending' })
            .eq('id', matchId);
        }
        continue;
      }

      // Process each video evaluation
      for (const evaluation of evalResponse.evaluations) {
        const matchId = videoToMatch[evaluation.video_id];

        if (!matchId) {
          console.warn(`${functionName} No match ID for video ${evaluation.video_id}`);
          continue;
        }

        // Determine new status based on recommendation
        // Auto-approve highly recommended videos
        const newStatus = evaluation.recommendation === 'highly_recommended'
          ? 'auto_approved'
          : 'pending';

        // Update content_match with evaluation scores
        const { error: updateError } = await supabase
          .from('content_matches')
          .update({
            ai_relevance_score: evaluation.relevance_score / 100,
            ai_pedagogy_score: evaluation.pedagogy_score / 100,
            ai_quality_score: evaluation.quality_score / 100,
            match_score: evaluation.total_score / 100,
            ai_reasoning: evaluation.reasoning,
            ai_recommendation: evaluation.recommendation,
            status: newStatus,
            evaluation_batch_job_id: batch_job_id
          })
          .eq('id', matchId);

        if (updateError) {
          console.error(`${functionName} Update error for match ${matchId}:`, updateError);
        } else {
          videosEvaluated++;
          console.log(`${functionName} Updated match ${matchId}: score=${evaluation.total_score}, recommendation=${evaluation.recommendation}`);
        }
      }

      succeededCount++;
    }

    // ========================================================================
    // STEP 6: Update batch_jobs with final status
    // ========================================================================
    const finalStatus = failedCount === 0 ? 'completed' :
                       succeededCount === 0 ? 'failed' : 'partial';

    await supabase
      .from('batch_jobs')
      .update({
        status: finalStatus,
        succeeded_count: succeededCount,
        failed_count: failedCount,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', batch_job_id);

    console.log(`${functionName} Completed: ${succeededCount} requests succeeded, ${failedCount} failed, ${videosEvaluated} videos evaluated`);

    // ========================================================================
    // STEP 7: Return result
    // ========================================================================
    return createSuccessResponse({
      success: true,
      status: finalStatus,
      succeeded_count: succeededCount,
      failed_count: failedCount,
      videos_evaluated: videosEvaluated,
      message: `Processed ${succeededCount + failedCount} requests, evaluated ${videosEvaluated} videos`,
      is_complete: true
    }, corsHeaders);

  } catch (error) {
    logError("poll-batch-evaluation", error instanceof Error ? error : new Error(String(error)), { action: "polling" });
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : String(error));
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
