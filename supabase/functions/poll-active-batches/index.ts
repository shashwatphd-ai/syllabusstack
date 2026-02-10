 // ============================================================================
 // POLL ACTIVE BATCHES - Centralized Single-Worker Vertex AI Polling
 // ============================================================================
 //
 // PURPOSE: Poll Vertex AI for ALL active batch jobs in a single cron sweep
 //
 // WHY THIS EXISTS:
 //   - Prevents 429 quota errors by centralizing Vertex API calls
 //   - Called by pg_cron every 30 seconds (not per-user)
 //   - Updates database → Supabase Realtime pushes to all connected users
 //   - Scales to 100K+ users with only 2 API calls per batch per minute
 //
 // ARCHITECTURE:
 //   pg_cron (30s) → poll-active-batches → Vertex AI (1 call per active batch)
 //                           ↓
 //                   UPDATE batch_jobs
 //                           ↓
 //                   Supabase Realtime → All connected users
 //
 // ============================================================================
 
 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
 import { createVertexAIAuth } from '../_shared/vertex-ai-auth.ts';
 import { createGCSClient, GCSClient } from '../_shared/gcs-client.ts';
 import { createVertexAIBatchClient, VertexAIBatchClient, BatchJobStatus } from '../_shared/vertex-ai-batch.ts';
 import { MODEL_CONFIG } from '../_shared/ai-orchestrator.ts';
 import { buildImagePrompt, slideNeedsImage } from '../_shared/image-prompt-builder.ts';
 import type { StoredSlide } from '../_shared/slide-types.ts';
 import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
 import {
   createErrorResponse,
   createSuccessResponse,
   logInfo,
   logError,
 } from "../_shared/error-handler.ts";
 
 // ============================================================================
 // BACKOFF CONFIGURATION
 // ============================================================================
 
 const BACKOFF_CONFIG = {
   initialDelay: 1000,    // 1 second
   maxDelay: 60000,       // 60 seconds
   multiplier: 2,
   maxRetries: 3,
 };
 
 function sleep(ms: number): Promise<void> {
   return new Promise(resolve => setTimeout(resolve, ms));
 }
 
 // ============================================================================
 // MAIN HANDLER
 // ============================================================================
 
 serve(async (req: Request): Promise<Response> => {
   // Handle CORS preflight
   const preflightResponse = handleCorsPreFlight(req);
   if (preflightResponse) return preflightResponse;
 
   const corsHeaders = getCorsHeaders(req);
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const supabase = createClient(supabaseUrl, serviceRoleKey);
 
     console.log('[PollActiveBatches] Starting centralized polling sweep...');
 
     // Initialize Vertex AI clients
     let auth, gcsClient: GCSClient, batchClient: VertexAIBatchClient;
     try {
       auth = createVertexAIAuth();
       gcsClient = createGCSClient(auth);
       batchClient = createVertexAIBatchClient(auth);
     } catch (error) {
       console.warn('[PollActiveBatches] Vertex AI not configured:', error);
       return createSuccessResponse({
         success: true,
         message: 'Vertex AI not configured - skipping poll',
         polled: 0,
       }, corsHeaders);
     }
 
     // ========================================================================
     // STEP 1: Get all active batch jobs
     // ========================================================================
     // Active = jobs that are NOT in a terminal state
     const { data: activeBatches, error: fetchError } = await supabase
       .from('batch_jobs')
       .select('id, google_batch_id, status, total_requests, instructor_course_id, request_mapping, research_data')
       .in('status', ['submitted', 'processing', 'pending', 'researching'])
       .not('google_batch_id', 'is', null);
 
     if (fetchError) {
       console.error('[PollActiveBatches] Failed to fetch active batches:', fetchError);
       return createErrorResponse('INTERNAL_ERROR', corsHeaders, 'Failed to fetch active batches');
     }
 
     if (!activeBatches || activeBatches.length === 0) {
       console.log('[PollActiveBatches] No active batches to poll');
       return createSuccessResponse({
         success: true,
         message: 'No active batches',
         polled: 0,
       }, corsHeaders);
     }
 
     console.log(`[PollActiveBatches] Found ${activeBatches.length} active batches to poll`);
 
     // ========================================================================
     // STEP 2: Poll each batch with exponential backoff
     // ========================================================================
     let successCount = 0;
     let errorCount = 0;
     let completedCount = 0;
 
     for (const batch of activeBatches) {
       try {
         const vertexStatus = await pollWithBackoff(batchClient, batch.google_batch_id);
 
         // Map Vertex AI state to our internal status
         const updatedStatus = VertexAIBatchClient.mapJobStateToStatus(vertexStatus.state);
         const counts = VertexAIBatchClient.extractCounts(vertexStatus.completionStats);
 
         console.log(`[PollActiveBatches] Batch ${batch.id}: ${vertexStatus.state} → ${updatedStatus} (${counts.succeeded}/${batch.total_requests})`);
 
         // Update database - this triggers Supabase Realtime to all subscribers
         await supabase
           .from('batch_jobs')
           .update({
             status: updatedStatus,
             succeeded_count: counts.succeeded,
             failed_count: counts.failed,
             updated_at: new Date().toISOString(),
             ...(VertexAIBatchClient.isTerminalState(vertexStatus.state) ? {
               completed_at: new Date().toISOString(),
             } : {}),
           })
           .eq('id', batch.id);
 
         // If batch completed successfully, process results
         if (VertexAIBatchClient.isSuccessState(vertexStatus.state)) {
           console.log(`[PollActiveBatches] Processing completed batch: ${batch.id}`);
           await processCompletedBatch(supabase, batch, vertexStatus, gcsClient);
           completedCount++;
         } else if (VertexAIBatchClient.isFailedState(vertexStatus.state)) {
           // Mark associated slides as failed
           await supabase
             .from('lecture_slides')
             .update({
               status: 'failed',
               error_message: vertexStatus.error?.message || 'Batch job failed',
             })
             .eq('batch_job_id', batch.id)
             .in('status', ['batch_pending', 'preparing', 'generating']);
           completedCount++;
         }
 
         successCount++;
       } catch (pollError) {
         console.error(`[PollActiveBatches] Error polling batch ${batch.id}:`, pollError);
         errorCount++;
         // Continue with other batches - don't let one failure stop the sweep
       }
     }
 
     console.log(`[PollActiveBatches] Sweep complete: ${successCount} polled, ${completedCount} completed, ${errorCount} errors`);
 
     return createSuccessResponse({
       success: true,
       polled: successCount,
       completed: completedCount,
       errors: errorCount,
       total_active: activeBatches.length,
     }, corsHeaders);
 
   } catch (error) {
     logError('poll-active-batches', error instanceof Error ? error : new Error(String(error)));
     return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
   }
 });
 
 // ============================================================================
 // EXPONENTIAL BACKOFF FOR VERTEX AI POLLING
 // ============================================================================
 
 async function pollWithBackoff(
   batchClient: VertexAIBatchClient,
   googleBatchId: string,
   attempt: number = 0
 ): Promise<BatchJobStatus> {
   try {
     return await batchClient.getBatchJob(googleBatchId);
   } catch (error) {
     const isRateLimited = error instanceof Error &&
       (error.message.includes('429') || error.message.includes('quota'));
 
     if (isRateLimited && attempt < BACKOFF_CONFIG.maxRetries) {
       const delay = Math.min(
         BACKOFF_CONFIG.initialDelay * Math.pow(BACKOFF_CONFIG.multiplier, attempt),
         BACKOFF_CONFIG.maxDelay
       );
       console.warn(`[PollActiveBatches] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${BACKOFF_CONFIG.maxRetries})`);
       await sleep(delay);
       return pollWithBackoff(batchClient, googleBatchId, attempt + 1);
     }
     throw error;
   }
 }
 
 // ============================================================================
 // PROCESS COMPLETED BATCH
 // ============================================================================
 // Moved from poll-batch-status - processes Vertex AI results and updates slides
 
 async function processCompletedBatch(
   supabase: any,
   batchJob: any,
   vertexStatus: any,
   gcsClient: GCSClient
 ) {
   console.log(`[PollActiveBatches] Processing completed batch: ${batchJob.google_batch_id}`);
 
   // Get output directory from Vertex AI job status
   const outputDir = vertexStatus.outputInfo?.gcsOutputDirectory;
   if (!outputDir) {
     console.error('[PollActiveBatches] No output directory found in job status');
     return;
   }
 
   console.log(`[PollActiveBatches] Output directory: ${outputDir}`);
 
   // List all output files (Vertex AI creates predictions-*.jsonl files)
   let outputFiles: string[];
   try {
     outputFiles = await gcsClient.listFiles(outputDir);
     outputFiles = outputFiles.filter(f => f.endsWith('.jsonl'));
     console.log(`[PollActiveBatches] Found ${outputFiles.length} output files`);
   } catch (listError) {
     console.error('[PollActiveBatches] Failed to list output files:', listError);
     return;
   }
 
   if (outputFiles.length === 0) {
     console.warn('[PollActiveBatches] No output files found');
     return;
   }
 
   // Download and parse all output files
   const responses: any[] = [];
   for (const file of outputFiles) {
     try {
       const lines = await gcsClient.downloadJsonl(`gs://${gcsClient.bucketName}/${file}`);
       responses.push(...lines);
       console.log(`[PollActiveBatches] Downloaded ${lines.length} responses from ${file}`);
     } catch (downloadError) {
       console.error(`[PollActiveBatches] Failed to download ${file}:`, downloadError);
     }
   }
 
   console.log(`[PollActiveBatches] Total responses to process: ${responses.length}`);
 
   if (responses.length === 0) {
     console.log('[PollActiveBatches] No responses found in output files');
     return;
   }
 
   const requestMapping = batchJob.request_mapping || {};
   let succeededCount = 0;
   let failedCount = 0;
 
   // Process each response
   for (let i = 0; i < responses.length; i++) {
     const responseWrapper = responses[i] as any;
     const response = responseWrapper.response || responseWrapper;
     const status = responseWrapper.status;
     const customId = responseWrapper.custom_id;
     const responseKey = customId || `slide_${i}`;
     const teachingUnitId = requestMapping[responseKey];
 
     if (!teachingUnitId) {
       console.warn(`[PollActiveBatches] No mapping for key ${responseKey}`);
       continue;
     }
 
     try {
       // Handle error in response
       if (status && status !== 'SUCCESS' && status !== '') {
         console.error(`[PollActiveBatches] Error for index ${i}:`, status);
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
 
       if (response.error) {
         console.error(`[PollActiveBatches] Error object for index ${i}:`, response.error);
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
       const content = response.candidates?.[0]?.content?.parts?.[0]?.text;
 
       if (!content) {
         console.warn(`[PollActiveBatches] No content for index ${i}`);
         failedCount++;
         continue;
       }
 
       // Parse JSON from response
       let slides;
       try {
         let jsonStr = content.trim();
         const codeBlockMatch = content.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```/s);
         if (codeBlockMatch && codeBlockMatch[1]) {
           jsonStr = codeBlockMatch[1].trim();
         } else {
           jsonStr = jsonStr.replace(/^```(?:json|JSON)?\s*\n?/, '');
           jsonStr = jsonStr.replace(/\n?```\s*$/, '');
         }
         jsonStr = jsonStr.replace(/^`+/, '').replace(/`+$/, '');
 
         let parsed;
         try {
           parsed = JSON.parse(jsonStr);
         } catch (initialParseError) {
           console.log(`[PollActiveBatches] Attempting JSON repair for index ${i}`);
           const repaired = repairTruncatedJson(jsonStr);
           if (repaired) {
             parsed = JSON.parse(repaired);
           } else {
             throw initialParseError;
           }
         }
         slides = parsed.slides || parsed;
 
         const hasContent = Array.isArray(slides) && slides.some((slide: any) =>
           (slide.content?.main_text?.length > 10) ||
           (Array.isArray(slide.content?.key_points) && slide.content.key_points.length > 0)
         );
 
         if (!hasContent) {
           console.error(`[PollActiveBatches] Slides parsed but content is empty for index ${i}`);
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
         console.error(`[PollActiveBatches] JSON parse error for index ${i}:`, parseError);
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
 
       // Format slides for storage
       const formattedSlides = slides.map((slide: any) => ({
         order: slide.order,
         type: slide.type,
         title: slide.title,
         content: {
           main_text: slide.content?.main_text || '',
           main_text_layout: slide.content?.main_text_layout || { type: 'plain', emphasis_words: [] },
           key_points: slide.content?.key_points || [],
           key_points_layout: slide.content?.key_points_layout || [],
           definition: slide.content?.definition,
           example: slide.content?.example,
           misconception: slide.content?.misconception,
           steps: slide.content?.steps,
         },
         visual: {
           type: slide.visual_directive?.type || 'none',
           url: null,
           alt_text: slide.visual_directive?.description || '',
           fallback_description: slide.visual_directive?.description || '',
           elements: slide.visual_directive?.elements || [],
           style: slide.visual_directive?.style || '',
           educational_purpose: slide.visual_directive?.educational_purpose || '',
         },
         speaker_notes: slide.speaker_notes || '',
         speaker_notes_duration_seconds: slide.estimated_seconds || 60,
         pedagogy: slide.pedagogy || {},
       }));
 
       // Calculate quality score
       const avgSpeakerNotesLength = formattedSlides.reduce(
         (sum: number, s: any) => sum + (s.speaker_notes?.length || 0), 0
       ) / formattedSlides.length;
 
       let qualityScore = 70;
       if (avgSpeakerNotesLength > 500) qualityScore += 10;
       if (formattedSlides.some((s: any) => s.type === 'misconception')) qualityScore += 5;
       if (formattedSlides.some((s: any) => s.content?.definition)) qualityScore += 5;
 
       // Get research context from batch_jobs.research_data
       const researchContext = batchJob.research_data?.[teachingUnitId];
       const hasResearch = researchContext?.grounded_content?.length > 0;
       const citationCount = researchContext?.grounded_content?.length || 0;
 
       // Update lecture_slides record
       await supabase
         .from('lecture_slides')
         .update({
           slides: formattedSlides,
           total_slides: formattedSlides.length,
           status: 'ready',
           error_message: null,
           batch_job_id: batchJob.id,
           generation_model: MODEL_CONFIG.GEMINI_3_FLASH,
           estimated_duration_minutes: Math.round(formattedSlides.length * 1.5),
           generation_phases: {
             method: 'vertex_ai_batch',
             research_included: true,
             completed_at: new Date().toISOString(),
           },
           quality_score: qualityScore,
           is_research_grounded: hasResearch,
           citation_count: citationCount,
           research_context: hasResearch ? researchContext : null,
         })
         .eq('teaching_unit_id', teachingUnitId);
 
       succeededCount++;
       console.log(`[PollActiveBatches] Saved ${formattedSlides.length} slides for ${teachingUnitId}`);
 
     } catch (err) {
       console.error(`[PollActiveBatches] Error processing index ${i}:`, err);
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
 
   console.log(`[PollActiveBatches] Batch complete: ${succeededCount} succeeded, ${failedCount} failed`);
 
   // Populate image generation queue
   await populateImageQueue(supabase, batchJob);
 }
 
 // ============================================================================
 // IMAGE QUEUE POPULATION
 // ============================================================================
 
 async function populateImageQueue(supabase: any, batchJob: any) {
   const enableImageGeneration = Deno.env.get('ENABLE_BATCH_IMAGE_GENERATION') !== 'false';
   if (!enableImageGeneration) return;
 
   console.log(`[PollActiveBatches] Populating image generation queue for batch ${batchJob.id}`);
 
   // Get domain for this course
   const { data: course } = await supabase
     .from('instructor_courses')
     .select('detected_domain')
     .eq('id', batchJob.instructor_course_id)
     .single();
   const domain = course?.detected_domain || undefined;
 
   // Get all ready lectures from this batch
   const { data: lectures } = await supabase
     .from('lecture_slides')
     .select('id, title, slides')
     .eq('batch_job_id', batchJob.id)
     .eq('status', 'ready');
 
   if (!lectures || lectures.length === 0) return;
 
   let totalQueueItems = 0;
 
   for (const lecture of lectures) {
     const slides = (lecture.slides || []) as StoredSlide[];
     const queueItems: Array<{
       lecture_slides_id: string;
       slide_index: number;
       slide_title: string;
       prompt: string;
       status: string;
     }> = [];
 
     for (let index = 0; index < slides.length; index++) {
       const slide = slides[index];
       if (!slideNeedsImage(slide)) continue;

       const prompt = await buildImagePrompt(slide, lecture.title, domain);
       if (!prompt) continue;

       queueItems.push({
         lecture_slides_id: lecture.id,
         slide_index: index,
         slide_title: slide.title || `Slide ${index + 1}`,
         prompt,
         status: 'pending',
       });
     }
 
     if (queueItems.length > 0) {
       const { error: queueError } = await supabase
         .from('image_generation_queue')
         .upsert(queueItems, {
           onConflict: 'lecture_slides_id,slide_index',
           ignoreDuplicates: false,
         });
 
       if (queueError) {
         console.error(`[PollActiveBatches] Error populating image queue:`, queueError);
       } else {
         totalQueueItems += queueItems.length;

         // Update generation_phases with queued image count
         await supabase
           .from('lecture_slides')
           .update({
             generation_phases: {
               method: 'vertex_ai_batch',
               research_included: true,
               completed_at: new Date().toISOString(),
               current_phase: 'images_queued',
               images_queued: queueItems.length,
             },
           })
           .eq('id', lecture.id);
       }
     }
   }
 
   console.log(`[PollActiveBatches] Queued ${totalQueueItems} images for generation`);
 
   // Trigger image processing - await to ensure request is dispatched before function exits
   if (totalQueueItems > 0) {
     const supabaseUrl = Deno.env.get('SUPABASE_URL');
     const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
     if (supabaseUrl && serviceKey) {
       try {
         const triggerResp = await fetch(`${supabaseUrl}/functions/v1/process-batch-images`, {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${serviceKey}`,
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({ continue: true }),
         });
         console.log(`[PollActiveBatches] Image processing trigger: ${triggerResp.status}`);
       } catch (err) {
         console.error('[PollActiveBatches] Failed to trigger image processing:', err);
       }
     }
   }
 }
 
 // ============================================================================
 // JSON REPAIR UTILITY (copied from poll-batch-status)
 // ============================================================================
 
 function repairTruncatedJson(jsonStr: string): string | null {
   try {
     let braceCount = 0;
     let bracketCount = 0;
     let inString = false;
     let lastValidPos = 0;
     let prevChar = '';
 
     for (let i = 0; i < jsonStr.length; i++) {
       const char = jsonStr[i];
       if (char === '"' && prevChar !== '\\') {
         inString = !inString;
       }
       if (!inString) {
         if (char === '{') braceCount++;
         else if (char === '}') {
           braceCount--;
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
 
     if (inString || braceCount > 0 || bracketCount > 0) {
       const possibleEnds = [];
       const regex = /\}\s*,?\s*\n/g;
       let match;
       while ((match = regex.exec(jsonStr)) !== null) {
         possibleEnds.push(match.index + match[0].length - 1);
       }
 
       for (let i = possibleEnds.length - 1; i >= 0; i--) {
         const testStr = jsonStr.substring(0, possibleEnds[i] + 1);
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
 
         if (testBraces >= 1 && testBrackets >= 1) {
           lastValidPos = possibleEnds[i];
           break;
         }
       }
 
       if (lastValidPos > 0) {
         let repaired = jsonStr.substring(0, lastValidPos + 1);
         repaired = repaired.replace(/,\s*$/, '');
 
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
 
         repaired += ']'.repeat(Math.max(0, finalBrackets));
         repaired += '}'.repeat(Math.max(0, finalBraces));
 
         try {
           JSON.parse(repaired);
           return repaired;
         } catch {
           return null;
         }
       }
     }
 
     return null;
   } catch (e) {
     console.error('[PollActiveBatches] JSON repair error:', e);
     return null;
   }
 }