import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { MODEL_CONFIG } from '../_shared/ai-orchestrator.ts';
import { createVertexAIAuth } from '../_shared/vertex-ai-auth.ts';
import { createGCSClient, GCSClient } from '../_shared/gcs-client.ts';
import { createVertexAIBatchClient, VertexAIBatchClient } from '../_shared/vertex-ai-batch.ts';
// ============================================================================
// POLL BATCH STATUS - Check and process Vertex AI batch job results
// ============================================================================
//
// PURPOSE: Poll Vertex AI Batch Prediction API for job status and process results
//
// WHY THIS EXISTS:
//   - Vertex AI batch prediction is async - need to poll for completion
//   - When batch completes, download results from Cloud Storage
//   - Process results and update lecture_slides records
//   - Frontend polls this every 30 seconds
//
// FLOW:
//   1. Receive batch_job_id or instructor_course_id
//   2. If batch_job_id: Poll Vertex AI API for job status
//   3. If SUCCEEDED: Download results from Cloud Storage
//   4. Parse JSONL output and update lecture_slides
//   5. Update batch_jobs record with status/counts
//   6. Return current status to frontend
//
// VERTEX AI RESPONSE FORMAT:
//   - Job status from: GET /v1/projects/.../batchPredictionJobs/{id}
//   - Results in Cloud Storage: gs://bucket/outputs/{batchId}/predictions.jsonl
//   - Each line is: {"request": {...}, "response": {...}}
//
// ENVIRONMENT VARIABLES:
//   - GCP_SERVICE_ACCOUNT_KEY: Base64 encoded service account JSON key
//   - GCP_PROJECT_ID: Google Cloud project ID (optional, from service account)
//   - GCP_REGION: Vertex AI region (default: us-central1)
//   - GCS_BUCKET: Cloud Storage bucket for batch input/output
//
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { batch_job_id, instructor_course_id } = await req.json();

    // Initialize Vertex AI clients (needed for polling)
    let auth, gcsClient, batchClient;
    try {
      auth = createVertexAIAuth();
      gcsClient = createGCSClient(auth);
      batchClient = createVertexAIBatchClient(auth);
    } catch (error) {
      // If Vertex AI is not configured, return error for batch operations
      console.warn('[Poll] Vertex AI not configured:', error);
      // Fall through - will return status from database if clients unavailable
    }

    // ========================================================================
    // OPTION 1: Poll specific batch job
    // ========================================================================

    if (batch_job_id) {
      // Get batch job from database
      const { data: batchJob, error: batchError } = await supabase
        .from('batch_jobs')
        .select('*')
        .eq('id', batch_job_id)
        .single();

      if (batchError || !batchJob) {
        return new Response(
          JSON.stringify({ success: false, error: 'Batch job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If already completed, just return the status
      if (['completed', 'failed', 'partial'].includes(batchJob.status)) {
        return new Response(
          JSON.stringify({
            success: true,
            batch_job: batchJob,
            is_complete: true,
            progress_percent: 100,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Poll Vertex AI for current status
      if (batchClient && batchJob.google_batch_id) {
        try {
          const vertexStatus = await batchClient.getBatchJob(batchJob.google_batch_id);
          console.log(`[Poll] Vertex AI batch state: ${vertexStatus.state}`);

          // Map Vertex AI state to our internal status
          const updatedStatus = VertexAIBatchClient.mapJobStateToStatus(vertexStatus.state);

          // Extract completion counts from Vertex AI response
          const counts = VertexAIBatchClient.extractCounts(vertexStatus.completionStats);

          await supabase
            .from('batch_jobs')
            .update({
              status: updatedStatus,
              succeeded_count: counts.succeeded,
              failed_count: counts.failed,
              ...(VertexAIBatchClient.isTerminalState(vertexStatus.state) ? {
                completed_at: new Date().toISOString(),
              } : {}),
            })
            .eq('id', batch_job_id);

          // If batch succeeded, process the results from Cloud Storage
          if (VertexAIBatchClient.isSuccessState(vertexStatus.state)) {
            await processCompletedBatch(
              supabase,
              batchJob,
              vertexStatus,
              gcsClient!
            );
          }

          // Calculate progress
          const total = batchJob.total_requests || 1;
          const done = counts.succeeded + counts.failed;
          const progressPercent = Math.round((done / total) * 100);

          return new Response(
            JSON.stringify({
              success: true,
              batch_job: {
                ...batchJob,
                status: updatedStatus,
                succeeded_count: counts.succeeded,
                failed_count: counts.failed,
              },
              vertex_state: vertexStatus.state,
              is_complete: VertexAIBatchClient.isTerminalState(vertexStatus.state),
              progress_percent: progressPercent,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (pollError) {
          console.error('[Poll] Vertex AI poll error:', pollError);
          // Fall through to return database status
        }
      }

      // Fallback: return current database status
      return new Response(
        JSON.stringify({
          success: true,
          batch_job: batchJob,
          is_complete: false,
          progress_percent: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // OPTION 2: Get overall course status
    // ========================================================================

    if (instructor_course_id) {
      // Get all batch jobs for this course
      const { data: batchJobs } = await supabase
        .from('batch_jobs')
        .select('id, google_batch_id, status, total_requests, succeeded_count, failed_count, created_at')
        .eq('instructor_course_id', instructor_course_id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get all slides for this course
      const { data: slides } = await supabase
        .from('lecture_slides')
        .select('id, teaching_unit_id, status, batch_job_id')
        .eq('instructor_course_id', instructor_course_id);

      // Count statuses
      const statusCounts = {
        pending: 0,
        batch_pending: 0,
        generating: 0,
        ready: 0,
        published: 0,
        failed: 0,
      };

      for (const slide of slides || []) {
        const status = slide.status as keyof typeof statusCounts;
        if (status in statusCounts) statusCounts[status]++;
      }

      // Find active batch job (if any)
      const activeBatch = batchJobs?.find(j =>
        j.status === 'submitted' || j.status === 'processing' || j.status === 'pending'
      );

      // If there's an active batch and Vertex AI is configured, poll it
      if (activeBatch && batchClient && activeBatch.google_batch_id) {
        try {
          const vertexStatus = await batchClient.getBatchJob(activeBatch.google_batch_id);

          // Map Vertex AI state to our internal status
          const updatedStatus = VertexAIBatchClient.mapJobStateToStatus(vertexStatus.state);
          const counts = VertexAIBatchClient.extractCounts(vertexStatus.completionStats);

          await supabase
            .from('batch_jobs')
            .update({
              status: updatedStatus,
              succeeded_count: counts.succeeded,
              failed_count: counts.failed,
            })
            .eq('id', activeBatch.id);

          // Process results if complete
          if (VertexAIBatchClient.isSuccessState(vertexStatus.state)) {
            // Fetch full batch job for processing
            const { data: fullBatchJob } = await supabase
              .from('batch_jobs')
              .select('*')
              .eq('id', activeBatch.id)
              .single();

            if (fullBatchJob && gcsClient) {
              await processCompletedBatch(supabase, fullBatchJob, vertexStatus, gcsClient);
            }
          }

          activeBatch.status = updatedStatus;
          activeBatch.succeeded_count = counts.succeeded;
          activeBatch.failed_count = counts.failed;
        } catch (pollError) {
          console.error('[Poll] Error polling active batch:', pollError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          total_slides: slides?.length || 0,
          ...statusCounts,
          // Combine pending types for backwards compatibility
          generating: statusCounts.generating + statusCounts.batch_pending,
          active_batch: activeBatch ? {
            id: activeBatch.id,
            status: activeBatch.status,
            total: activeBatch.total_requests,
            succeeded: activeBatch.succeeded_count || 0,
            failed: activeBatch.failed_count || 0,
          } : null,
          recent_batches: batchJobs?.slice(0, 3) || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'batch_job_id or instructor_course_id required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Poll] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// JSON REPAIR UTILITY
// ============================================================================
//
// Attempts to repair truncated JSON from AI responses that hit token limits.
// Common issues:
//   - Unterminated strings (missing closing quote)
//   - Missing closing brackets/braces
//   - Truncated in the middle of a value
//

function repairTruncatedJson(jsonStr: string): string | null {
  try {
    // First, try to find the last complete slide object
    // Look for the pattern where we have complete slide entries
    
    // Count open brackets/braces
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let lastValidPos = 0;
    let prevChar = '';
    
    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];
      
      // Handle string state (ignore characters inside strings)
      if (char === '"' && prevChar !== '\\') {
        inString = !inString;
      }
      
      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') {
          braceCount--;
          // Mark valid position after closing a complete object
          if (braceCount >= 0) lastValidPos = i + 1;
        }
        else if (char === '[') bracketCount++;
        else if (char === ']') {
          bracketCount--;
          if (bracketCount >= 0) lastValidPos = i + 1;
        }
      }
      
      prevChar = char;
    }
    
    // If we're in a string, find the last complete object before the truncation
    if (inString || braceCount > 0 || bracketCount > 0) {
      // Try to find the last complete slide object
      // Look for },\n pattern that indicates end of a complete slide
      const slideEndPattern = /\}\s*,?\s*$/g;
      let match;
      let lastGoodEnd = 0;
      
      // Find positions where we might have complete objects
      const possibleEnds = [];
      const regex = /\}\s*,?\s*\n/g;
      while ((match = regex.exec(jsonStr)) !== null) {
        possibleEnds.push(match.index + match[0].length - 1);
      }
      
      // Try each possible end position, starting from the latest
      for (let i = possibleEnds.length - 1; i >= 0; i--) {
        const testStr = jsonStr.substring(0, possibleEnds[i] + 1);
        
        // Count brackets in the test string
        let testBraces = 0;
        let testBrackets = 0;
        let testInString = false;
        let testPrev = '';
        
        for (const c of testStr) {
          if (c === '"' && testPrev !== '\\') testInString = !testInString;
          if (!testInString) {
            if (c === '{') testBraces++;
            else if (c === '}') testBraces--;
            else if (c === '[') testBrackets++;
            else if (c === ']') testBrackets--;
          }
          testPrev = c;
        }
        
        // If this position has balanced inner structure, use it
        if (testBraces >= 1 && testBrackets >= 1) {
          lastGoodEnd = possibleEnds[i];
          break;
        }
      }
      
      if (lastGoodEnd > 0) {
        // Truncate to the last good position and close the structure
        let repaired = jsonStr.substring(0, lastGoodEnd + 1);
        
        // Remove any trailing comma
        repaired = repaired.replace(/,\s*$/, '');
        
        // Close any remaining open brackets/braces
        let finalBraces = 0;
        let finalBrackets = 0;
        let finalInString = false;
        let finalPrev = '';
        
        for (const c of repaired) {
          if (c === '"' && finalPrev !== '\\') finalInString = !finalInString;
          if (!finalInString) {
            if (c === '{') finalBraces++;
            else if (c === '}') finalBraces--;
            else if (c === '[') finalBrackets++;
            else if (c === ']') finalBrackets--;
          }
          finalPrev = c;
        }
        
        // Close open structures
        repaired += ']'.repeat(Math.max(0, finalBrackets));
        repaired += '}'.repeat(Math.max(0, finalBraces));
        
        // Validate the repair worked
        try {
          JSON.parse(repaired);
          return repaired;
        } catch {
          // Repair failed, return null
          return null;
        }
      }
    }
    
    return null;
  } catch (e) {
    console.error('[Poll] JSON repair error:', e);
    return null;
  }
}

// ============================================================================
// PROCESS COMPLETED BATCH
// ============================================================================
//
// When a Vertex AI batch job completes, download results from Cloud Storage
// and update lecture_slides records.
//
// Vertex AI Batch Output Format:
//   - Results are written to Cloud Storage as JSONL
//   - Output path: {outputUriPrefix}/predictions-*.jsonl
//   - Each line: {"request": {...}, "response": {...}}
//

async function processCompletedBatch(
  supabase: any,
  batchJob: any,
  vertexStatus: any,
  gcsClient: GCSClient
) {
  console.log(`[Poll] Processing completed batch: ${batchJob.google_batch_id}`);

  // Get output directory from Vertex AI job status
  const outputDir = vertexStatus.outputInfo?.gcsOutputDirectory;
  if (!outputDir) {
    console.error('[Poll] No output directory found in job status');
    return;
  }

  console.log(`[Poll] Output directory: ${outputDir}`);

  // List all output files (Vertex AI creates predictions-*.jsonl files)
  let outputFiles: string[];
  try {
    outputFiles = await gcsClient.listFiles(outputDir);
    outputFiles = outputFiles.filter(f => f.endsWith('.jsonl'));
    console.log(`[Poll] Found ${outputFiles.length} output files`);
  } catch (listError) {
    console.error('[Poll] Failed to list output files:', listError);
    return;
  }

  if (outputFiles.length === 0) {
    console.warn('[Poll] No output files found');
    return;
  }

  // Download and parse all output files
  const responses: any[] = [];
  for (const file of outputFiles) {
    try {
      const lines = await gcsClient.downloadJsonl(`gs://${gcsClient.bucketName}/${file}`);
      responses.push(...lines);
      console.log(`[Poll] Downloaded ${lines.length} responses from ${file}`);
    } catch (downloadError) {
      console.error(`[Poll] Failed to download ${file}:`, downloadError);
    }
  }

  console.log(`[Poll] Total responses to process: ${responses.length}`);

  if (responses.length === 0) {
    console.log('[Poll] No responses found in output files');
    return;
  }

  const requestMapping = batchJob.request_mapping || {};
  let succeededCount = 0;
  let failedCount = 0;

  // Process responses - Vertex AI format: { request: {...}, response: {...} }
  // Responses are in the same order as requests in the input JSONL
  for (let i = 0; i < responses.length; i++) {
    const responseWrapper = responses[i] as any;

    // Vertex AI batch response format:
    // { "request": {...}, "response": { "candidates": [...] }, "status": "..." }
    const response = responseWrapper.response || responseWrapper;
    const status = responseWrapper.status;

    // Use index-based mapping (responses match input order)
    const responseKey = `slide_${i}`;
    const teachingUnitId = requestMapping[responseKey] || requestMapping[i] || requestMapping[`slide_${i}`];

    if (!teachingUnitId) {
      console.warn(`[Poll] No mapping for index ${i}`);
      continue;
    }

    try {
      // Handle error in response (Vertex AI uses status field)
      if (status && status !== 'SUCCESS' && status !== '') {
        console.error(`[Poll] Error for index ${i}:`, status);
        failedCount++;

        await supabase
          .from('lecture_slides')
          .update({
            status: 'failed',
            error_message: `Batch generation failed: ${status}`,
          })
          .eq('teaching_unit_id', teachingUnitId);

        continue;
      }

      // Also check for error object in response
      if (response.error) {
        console.error(`[Poll] Error object for index ${i}:`, response.error);
        failedCount++;

        await supabase
          .from('lecture_slides')
          .update({
            status: 'failed',
            error_message: response.error.message || 'Batch generation failed',
          })
          .eq('teaching_unit_id', teachingUnitId);

        continue;
      }

      // Extract content from Vertex AI response format
      // Format: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
      const content = response.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        console.warn(`[Poll] No content for index ${i}`);
        failedCount++;
        continue;
      }

      // Parse JSON from response (robust markdown stripping with multiple fallback patterns)
      let slides;
      try {
        let jsonStr = content.trim();

        // Pattern 1: Standard markdown code blocks with 's' flag for multiline
        const codeBlockMatch = content.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```/s);
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonStr = codeBlockMatch[1].trim();
        } else {
          // Pattern 2: Remove leading/trailing backticks more aggressively
          jsonStr = jsonStr.replace(/^```(?:json|JSON)?\s*\n?/, '');
          jsonStr = jsonStr.replace(/\n?```\s*$/, '');
        }

        // Pattern 3: Final cleanup of any stray backticks
        jsonStr = jsonStr.replace(/^`+/, '').replace(/`+$/, '');

        // Try to parse the cleaned JSON, with repair for truncated responses
        let parsed;
        try {
          parsed = JSON.parse(jsonStr);
        } catch (initialParseError) {
          // Attempt to repair truncated JSON
          console.log(`[Poll] Attempting JSON repair for index ${i}`);
          const repaired = repairTruncatedJson(jsonStr);
          if (repaired) {
            parsed = JSON.parse(repaired);
            console.log(`[Poll] JSON repair successful for index ${i}`);
          } else {
            throw initialParseError; // Re-throw if repair failed
          }
        }
        slides = parsed.slides || parsed;
        
        // Validate slides have actual content (not just empty structure)
        const hasContent = Array.isArray(slides) && slides.some((slide: any) => 
          (slide.content?.main_text?.length > 10) || 
          (Array.isArray(slide.content?.key_points) && slide.content.key_points.length > 0)
        );

        if (!hasContent) {
          console.error(`[Poll] Slides parsed but content is empty for index ${i}`);
          failedCount++;
          await supabase
            .from('lecture_slides')
            .update({
              status: 'failed',
              error_message: 'AI returned empty or incomplete content',
            })
            .eq('teaching_unit_id', teachingUnitId);
          continue;
        }
      } catch (parseError) {
        console.error(`[Poll] JSON parse error for index ${i}:`, parseError);
        failedCount++;

        await supabase
          .from('lecture_slides')
          .update({
            status: 'failed',
            error_message: 'Failed to parse AI response',
          })
          .eq('teaching_unit_id', teachingUnitId);

        continue;
      }

      // Format slides for storage (including v3 layout hints)
      const formattedSlides = slides.map((slide: any) => ({
        order: slide.order,
        type: slide.type,
        title: slide.title,
        content: {
          main_text: slide.content?.main_text || '',
          // v3 parity: include layout hints for adaptive rendering
          main_text_layout: slide.content?.main_text_layout || { type: 'plain', emphasis_words: [] },
          key_points: slide.content?.key_points || [],
          // v3 parity: include layout hints for each key point
          key_points_layout: slide.content?.key_points_layout || [],
          definition: slide.content?.definition,
          example: slide.content?.example,
          misconception: slide.content?.misconception,
          steps: slide.content?.steps,
        },
        visual: {
          type: slide.visual_directive?.type || 'none',
          url: null, // Will be populated by post-batch image generation
          alt_text: slide.visual_directive?.description || '',
          fallback_description: slide.visual_directive?.description || '',
          elements: slide.visual_directive?.elements || [],
          style: slide.visual_directive?.style || '',
          // v3 parity: include educational purpose for image generation
          educational_purpose: slide.visual_directive?.educational_purpose || '',
        },
        speaker_notes: slide.speaker_notes || '',
        speaker_notes_duration_seconds: slide.estimated_seconds || 60,
        pedagogy: slide.pedagogy || {},
      }));

      // Update lecture_slides record
      // Note: Uses GEMINI_PRO because batch now uses same model as v3
      await supabase
        .from('lecture_slides')
        .update({
          slides: formattedSlides,
          total_slides: formattedSlides.length,
          status: 'ready', // Will change to 'images_pending' when image queue is added
          error_message: null, // Clear any previous error from failed attempts
          generation_model: MODEL_CONFIG.GEMINI_PRO, // v3 parity: batch now uses PRO
          estimated_duration_minutes: Math.round(formattedSlides.length * 1.5),
          generation_phases: {
            method: 'vertex_ai_batch',
            research_included: true, // v3 parity: research is now included
            completed_at: new Date().toISOString(),
          },
        })
        .eq('teaching_unit_id', teachingUnitId);

      succeededCount++;
      console.log(`[Poll] Saved ${formattedSlides.length} slides for ${teachingUnitId}`);

    } catch (err) {
      console.error(`[Poll] Error processing index ${i}:`, err);
      failedCount++;
    }
  }

  // Update batch job with final counts
  const finalStatus = failedCount === 0 ? 'completed' :
                      succeededCount === 0 ? 'failed' : 'partial';

  await supabase
    .from('batch_jobs')
    .update({
      status: finalStatus,
      succeeded_count: succeededCount,
      failed_count: failedCount,
      completed_at: new Date().toISOString(),
    })
    .eq('id', batchJob.id);

  console.log(`[Poll] Batch complete: ${succeededCount} succeeded, ${failedCount} failed`);

  // ========================================================================
  // POST-BATCH: Trigger Async Image Generation
  // ========================================================================
  //
  // After slides are saved, trigger async image generation via process-batch-images.
  // This is a fire-and-forget call - slides are already usable without images.
  // Images will be populated asynchronously to avoid timeout issues.
  //
  const enableImageGeneration = Deno.env.get('ENABLE_BATCH_IMAGE_GENERATION') !== 'false';

  if (succeededCount > 0 && enableImageGeneration) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      console.error(`[Poll] Missing env vars for image generation: SUPABASE_URL=${!!supabaseUrl}, SERVICE_KEY=${!!serviceKey}`);
    } else {
      const imageUrl = `${supabaseUrl}/functions/v1/process-batch-images`;
      console.log(`[Poll] Triggering async image generation: POST ${imageUrl}`);
      console.log(`[Poll] Payload: { batch_job_id: "${batchJob.id}" }`);

      // Fire-and-forget: Trigger image generation asynchronously
      // Don't await - let it run in background while we return the poll response
      fetch(imageUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batch_job_id: batchJob.id }),
      })
        .then(async (res) => {
          if (res.ok) {
            console.log(`[Poll] Image generation triggered successfully for batch ${batchJob.id}`);
          } else {
            const errorBody = await res.text().catch(() => 'Unable to read response body');
            console.error(`[Poll] Image generation trigger failed: ${res.status} ${res.statusText}`);
            console.error(`[Poll] Error response: ${errorBody.substring(0, 500)}`);
          }
        })
        .catch((err) => {
          console.error(`[Poll] Image generation trigger error (non-blocking):`, err.message || err);
        });
    }

    console.log(`[Poll] ${succeededCount} slides ready. Async image generation started.`);
  } else if (succeededCount > 0) {
    console.log(`[Poll] ${succeededCount} slides ready. Image generation disabled (ENABLE_BATCH_IMAGE_GENERATION=${Deno.env.get('ENABLE_BATCH_IMAGE_GENERATION')}).`);
  }
}
