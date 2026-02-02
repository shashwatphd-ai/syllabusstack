// ============================================================================
// POLL BATCH CURRICULUM - Process Vertex AI Batch Results
// ============================================================================
//
// PURPOSE: Check Vertex AI batch job status, download results, parse teaching
// units, and insert them into the database.
//
// TRIGGER: Called periodically (cron) or manually after submit-batch-curriculum
//
// FLOW:
//   1. Fetch batch_jobs record
//   2. Get Vertex AI job status
//   3. If complete: Download output from GCS
//   4. Parse JSONL results
//   5. Insert teaching_units
//   6. Update LO decomposition_status
//   7. Update batch_jobs with final status
//
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { createVertexAIAuth } from '../_shared/vertex-ai-auth.ts';
import { createGCSClient, GCSClient } from '../_shared/gcs-client.ts';
import { createVertexAIBatchClient, VertexAIBatchClient, BatchJobState } from '../_shared/vertex-ai-batch.ts';
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createErrorResponse, createSuccessResponse, logInfo, logError, withErrorHandling } from "../_shared/error-handler.ts";

// ============================================================================
// TYPES
// ============================================================================

interface TeachingUnitFromAI {
  sequence_order: number;
  title: string;
  description: string;
  what_to_teach: string;
  why_this_matters: string;
  how_to_teach: string;
  common_misconceptions: string[];
  prerequisites: string[];
  enables: string[];
  target_video_type: string;
  target_duration_minutes: number;
  search_queries: string[];
  required_concepts: string[];
  avoid_terms: string[];
}

interface AIResponse {
  reasoning_chain: string;
  domain_context: string;
  total_estimated_time_minutes: number;
  teaching_units: TeachingUnitFromAI[];
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);
  const functionName = '[poll-batch-curriculum]';
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

    if (batchJob.job_type !== 'curriculum') {
      throw new Error(`Invalid job type: ${batchJob.job_type}, expected 'curriculum'`);
    }

    // Already completed?
    if (['completed', 'partial', 'failed'].includes(batchJob.status)) {
      console.log(`${functionName} Job already in terminal state: ${batchJob.status}`);
      return createSuccessResponse({
        success: true,
        status: batchJob.status,
        succeeded_count: batchJob.succeeded_count || 0,
        failed_count: batchJob.failed_count || 0,
        teaching_units_created: (batchJob.succeeded_count || 0) * 5, // Estimate
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
        teaching_units_created: 0,
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
    // STEP 5: Process results and insert teaching units
    // ========================================================================
    const requestMapping = batchJob.request_mapping || {};
    let succeededCount = 0;
    let failedCount = 0;
    let teachingUnitsCreated = 0;

    // Valid video types (same as curriculum-reasoning-agent)
    const validVideoTypes = ['explainer', 'tutorial', 'case_study', 'worked_example', 'lecture', 'demonstration'];

    for (let i = 0; i < allResults.length; i++) {
      const result = allResults[i] as any;

      // Get LO ID from mapping (using same key format as slides)
      const responseKey = `slide_${i}`;
      const loId = requestMapping[responseKey] || requestMapping[i] || requestMapping[`slide_${i}`];

      if (!loId) {
        console.warn(`${functionName} No mapping for index ${i}`);
        failedCount++;
        continue;
      }

      // Check for error in response
      const responseStatus = result.status;
      if (responseStatus && responseStatus !== 'SUCCESS' && responseStatus !== '') {
        console.error(`${functionName} Error for LO ${loId}:`, responseStatus);
        failedCount++;

        await supabase
          .from('learning_objectives')
          .update({ decomposition_status: 'failed' })
          .eq('id', loId);

        continue;
      }

      // Also check for error object
      if (result.response?.error || result.error) {
        console.error(`${functionName} Error object for LO ${loId}:`, result.response?.error || result.error);
        failedCount++;

        await supabase
          .from('learning_objectives')
          .update({ decomposition_status: 'failed' })
          .eq('id', loId);

        continue;
      }

      // Extract content from response
      const content = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        console.warn(`${functionName} No content in response for LO ${loId}`);
        failedCount++;
        await supabase
          .from('learning_objectives')
          .update({ decomposition_status: 'failed' })
          .eq('id', loId);
        continue;
      }

      // Parse JSON response (with markdown stripping - same patterns as poll-batch-status)
      let aiResponse: AIResponse;
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

        aiResponse = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error(`${functionName} JSON parse error for LO ${loId}:`, parseError);
        failedCount++;
        await supabase
          .from('learning_objectives')
          .update({ decomposition_status: 'failed' })
          .eq('id', loId);
        continue;
      }

      // Validate response has teaching units
      if (!aiResponse.teaching_units || !Array.isArray(aiResponse.teaching_units) || aiResponse.teaching_units.length === 0) {
        console.warn(`${functionName} No teaching units in response for LO ${loId}`);
        failedCount++;
        await supabase
          .from('learning_objectives')
          .update({ decomposition_status: 'failed' })
          .eq('id', loId);
        continue;
      }

      // Insert teaching units (same validation as curriculum-reasoning-agent)
      const teachingUnitsToInsert = aiResponse.teaching_units.map((unit, index) => ({
        id: crypto.randomUUID(),
        learning_objective_id: loId,
        sequence_order: unit.sequence_order || index + 1,
        title: unit.title,
        description: unit.description,
        what_to_teach: unit.what_to_teach,
        why_this_matters: unit.why_this_matters,
        how_to_teach: unit.how_to_teach,
        common_misconceptions: unit.common_misconceptions || [],
        prerequisites: unit.prerequisites || [],
        enables: unit.enables || [],
        target_video_type: validVideoTypes.includes(unit.target_video_type)
          ? unit.target_video_type
          : 'explainer',
        target_duration_minutes: unit.target_duration_minutes || 10,
        search_queries: unit.search_queries?.slice(0, 5) || [],
        required_concepts: unit.required_concepts || [],
        avoid_terms: unit.avoid_terms || [],
        status: 'pending'
      }));

      const { error: insertError } = await supabase
        .from('teaching_units')
        .insert(teachingUnitsToInsert);

      if (insertError) {
        console.error(`${functionName} Insert error for LO ${loId}:`, insertError);
        failedCount++;
        await supabase
          .from('learning_objectives')
          .update({ decomposition_status: 'failed' })
          .eq('id', loId);
        continue;
      }

      // Success!
      succeededCount++;
      teachingUnitsCreated += teachingUnitsToInsert.length;

      await supabase
        .from('learning_objectives')
        .update({ decomposition_status: 'completed' })
        .eq('id', loId);

      console.log(`${functionName} Created ${teachingUnitsToInsert.length} units for LO ${loId}`);
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

    console.log(`${functionName} Completed: ${succeededCount} succeeded, ${failedCount} failed, ${teachingUnitsCreated} units created`);

    // ========================================================================
    // STEP 7: Return result
    // ========================================================================
    return createSuccessResponse({
      success: true,
      status: finalStatus,
      succeeded_count: succeededCount,
      failed_count: failedCount,
      teaching_units_created: teachingUnitsCreated,
      message: `Processed ${succeededCount + failedCount} LOs, created ${teachingUnitsCreated} teaching units`,
      is_complete: true
    }, corsHeaders);

  } catch (error) {
    logError("poll-batch-curriculum", error instanceof Error ? error : new Error(String(error)), { action: "polling" });
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : String(error));
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
