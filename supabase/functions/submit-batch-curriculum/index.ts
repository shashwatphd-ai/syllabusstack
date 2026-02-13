// ============================================================================
// SUBMIT BATCH CURRICULUM - Batch LO Decomposition via Vertex AI
// ============================================================================
//
// PURPOSE: Submit all learning objectives for a course to Vertex AI batch
// prediction for curriculum decomposition into teaching units.
//
// TRIGGER: Called by process-syllabus after LO creation, or manually
//
// FLOW:
//   1. Validate input and permissions
//   2. Fetch all LOs that need decomposition
//   3. Build JSONL batch request
//   4. Upload to GCS
//   5. Create Vertex AI batch job
//   6. Create batch_jobs record
//   7. Update LOs with batch job reference
//   8. Return batch job ID
//
// FALLBACK: If this fails, search-youtube-content will use sync decomposition
//
// ============================================================================

import { createClient } from "@supabase/supabase-js";
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
import { MODEL_CONFIG } from "../_shared/ai-orchestrator.ts";

const BATCH_CONFIG = {
  // Minimum LOs to justify batch (below this, use sync)
  MIN_BATCH_SIZE: 3,
  // Maximum LOs per batch (Vertex AI limit is 10,000)
  MAX_BATCH_SIZE: 500,
  // GCS path prefix
  GCS_PREFIX: 'curriculum-batch',
};

// ============================================================================
// SYSTEM PROMPT (Identical to curriculum-reasoning-agent for consistency)
// ============================================================================

const CURRICULUM_SYSTEM_PROMPT = `You are an expert curriculum designer with deep expertise in pedagogical sequencing, instructional design, and Bloom's Taxonomy. Your task is to decompose high-level learning objectives into teachable micro-concepts that can be taught through individual videos.

CRITICAL RULES:
1. Each teaching unit should represent ONE focused concept that can be taught in a single 5-15 minute video
2. Units must be ordered by prerequisite dependencies - foundational concepts FIRST
3. Search queries must be HIGHLY SPECIFIC to find the exact teaching content needed
4. Think about what a student ACTUALLY needs to learn to achieve the learning objective
5. Generate 3-8 teaching units per learning objective based on complexity

OUTPUT FORMAT: Return valid JSON only, no markdown code blocks or explanations outside the JSON.`;

// ============================================================================
// TYPES
// ============================================================================

interface LearningObjective {
  id: string;
  text: string;
  core_concept: string | null;
  bloom_level: string | null;
  expected_duration_minutes: number | null;
  module_id: string | null;
  instructor_course_id: string;
}

interface ModuleContext {
  id: string;
  title: string;
  description: string | null;
}

interface CourseContext {
  id: string;
  title: string;
  description: string | null;
  syllabus_text: string | null;
  detected_domain: string | null;
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function buildUserPrompt(
  lo: LearningObjective,
  module: ModuleContext | null,
  course: CourseContext
): string {
  return `TASK: Decompose this learning objective into 3-8 teachable micro-concepts.

LEARNING OBJECTIVE:
"${lo.text}"
${lo.core_concept ? `Core Concept: ${lo.core_concept}` : ''}
${lo.bloom_level ? `Bloom's Level: ${lo.bloom_level}` : ''}
${lo.expected_duration_minutes ? `Expected Duration: ${lo.expected_duration_minutes} minutes` : ''}

CONTEXT:
Course: ${course.title}
${course.description ? `Course Description: ${course.description}` : ''}
${course.detected_domain ? `Domain: ${course.detected_domain}` : ''}
${module ? `Module: ${module.title}` : ''}
${module?.description ? `Module Description: ${module.description}` : ''}
${course.syllabus_text ? `Syllabus Context (first 3000 chars): ${course.syllabus_text.substring(0, 3000)}` : ''}

REQUIRED OUTPUT FORMAT (JSON):
{
  "reasoning_chain": "Step-by-step explanation of how you decomposed this objective",
  "domain_context": "The specific academic/professional field this belongs to",
  "total_estimated_time_minutes": <number>,
  "teaching_units": [
    {
      "sequence_order": 1,
      "title": "Clear, specific title for this micro-concept",
      "description": "2-3 sentence description of what this unit covers",
      "what_to_teach": "Specific knowledge or skill to convey",
      "why_this_matters": "Connection to the overall learning objective",
      "how_to_teach": "Recommended pedagogical approach",
      "common_misconceptions": ["misconception 1", "misconception 2"],
      "prerequisites": ["concept A", "concept B"],
      "enables": ["concept X", "concept Y"],
      "target_video_type": "explainer|tutorial|case_study|worked_example|lecture|demonstration",
      "target_duration_minutes": <5-15>,
      "search_queries": ["specific query 1", "specific query 2", "specific query 3", "specific query 4", "specific query 5"],
      "required_concepts": ["key term 1", "key term 2"],
      "avoid_terms": ["ambiguous term", "outdated term"]
    }
  ]
}

Generate the teaching units now:`;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);
  const fnName = '[submit-batch-curriculum]';
  logInfo('submit-batch-curriculum', 'starting');

  try {
    // ========================================================================
    // STEP 0: Check feature flag
    // ========================================================================
    const enableBatchCurriculum = Deno.env.get('ENABLE_BATCH_CURRICULUM') !== 'false';
    if (!enableBatchCurriculum) {
      logInfo('submit-batch-curriculum', 'feature_disabled');
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Batch curriculum is disabled. Use curriculum-reasoning-agent directly');
    }

    // ========================================================================
    // STEP 1: Parse request and authenticate
    // ========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Missing authorization header');
    }

    const { instructor_course_id, learning_objective_ids } = await req.json();

    if (!instructor_course_id) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'instructor_course_id is required');
    }

    logInfo('submit-batch-curriculum', 'processing', { courseId: instructor_course_id });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const token = authHeader.replace('Bearer ', '');
    let userId: string | null = null;
    if (token !== supabaseKey) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        throw new Error('Invalid authorization');
      }
      userId = user.id;
    }

    // ========================================================================
    // STEP 2: Verify course ownership
    // ========================================================================
    const { data: course, error: courseError } = await supabase
      .from('instructor_courses')
      .select('id, title, description, syllabus_text, detected_domain, instructor_id')
      .eq('id', instructor_course_id)
      .single();

    if (courseError || !course) {
      throw new Error(`Course not found: ${instructor_course_id}`);
    }

    if (userId && course.instructor_id !== userId) {
      throw new Error('Not authorized to modify this course');
    }

    console.log(`${fnName} Course verified: ${course.title}`);

    // ========================================================================
    // STEP 3: Fetch LOs that need decomposition
    // ========================================================================
    let loQuery = supabase
      .from('learning_objectives')
      .select(`
        id, text, core_concept, bloom_level,
        expected_duration_minutes, module_id, instructor_course_id
      `)
      .eq('instructor_course_id', instructor_course_id)
      .in('decomposition_status', ['not_started', 'failed']);

    // If specific LO IDs provided, filter to those
    if (learning_objective_ids && learning_objective_ids.length > 0) {
      loQuery = loQuery.in('id', learning_objective_ids);
    }

    const { data: learningObjectives, error: loError } = await loQuery;

    if (loError) {
      throw new Error(`Failed to fetch learning objectives: ${loError.message}`);
    }

    if (!learningObjectives || learningObjectives.length === 0) {
      console.log(`${fnName} No LOs need decomposition`);
      return new Response(
        JSON.stringify({
          success: true,
          batch_job_id: null,
          total_requests: 0,
          message: 'No learning objectives need decomposition'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${fnName} Found ${learningObjectives.length} LOs to decompose`);

    // Check minimum batch size
    if (learningObjectives.length < BATCH_CONFIG.MIN_BATCH_SIZE) {
      console.log(`${fnName} Below minimum batch size, use sync decomposition`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Only ${learningObjectives.length} LOs, below minimum ${BATCH_CONFIG.MIN_BATCH_SIZE}`,
          fallback: 'Use curriculum-reasoning-agent directly for small batches'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ========================================================================
    // STEP 4: Fetch module context for each LO
    // ========================================================================
    const moduleIds = [...new Set(learningObjectives.map(lo => lo.module_id).filter(Boolean))];

    let modules: Record<string, ModuleContext> = {};
    if (moduleIds.length > 0) {
      const { data: moduleData } = await supabase
        .from('modules')
        .select('id, title, description')
        .in('id', moduleIds);

      if (moduleData) {
        modules = Object.fromEntries(moduleData.map(m => [m.id, m]));
      }
    }

    // ========================================================================
    // STEP 5: Build JSONL batch request
    // ========================================================================
    console.log(`${fnName} Building batch request...`);

    // Build request mapping for result processing
    const requestMapping: Record<string, string> = {};
    const batchLines: object[] = [];

    for (let i = 0; i < learningObjectives.length; i++) {
      const lo = learningObjectives[i];
      const module = lo.module_id ? modules[lo.module_id] : null;

      const userPrompt = buildUserPrompt(lo, module, course as CourseContext);

      // Vertex AI batch request format
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }]
          }
        ],
        systemInstruction: {
          parts: [{ text: CURRICULUM_SYSTEM_PROMPT }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      };

      batchLines.push(request);
      requestMapping[`slide_${i}`] = lo.id; // Use same key format as slides for consistency
    }

    console.log(`${fnName} Built ${batchLines.length} requests`);

    // ========================================================================
    // STEP 6: Create batch_jobs record first (for reference)
    // ========================================================================
    const batchJobId = crypto.randomUUID();

    const { error: insertJobError } = await supabase
      .from('batch_jobs')
      .insert({
        id: batchJobId,
        google_batch_id: `pending-${batchJobId}`, // Placeholder, will be updated with Vertex AI job ID
        instructor_course_id,
        job_type: 'curriculum',
        total_requests: learningObjectives.length,
        status: 'preparing',
        request_mapping: requestMapping,
        created_by: userId
      });

    if (insertJobError) {
      throw new Error(`Failed to create batch job record: ${insertJobError.message}`);
    }

    console.log(`${fnName} Created batch job: ${batchJobId}`);

    // ========================================================================
    // STEP 7: Upload JSONL to GCS
    // ========================================================================
    let auth, gcsClient, batchClient;
    try {
      auth = createVertexAIAuth();
      gcsClient = createGCSClient(auth);
      batchClient = createVertexAIBatchClient(auth);
    } catch (error) {
      // Clean up batch job record on initialization failure
      await supabase
        .from('batch_jobs')
        .update({ status: 'failed', error_message: `Vertex AI init failed: ${error}` })
        .eq('id', batchJobId);
      throw error;
    }

    const inputPath = `${BATCH_CONFIG.GCS_PREFIX}/${batchJobId}/input.jsonl`;

    try {
      const gcsUri = await gcsClient.uploadJsonl(inputPath, batchLines);
      console.log(`${fnName} Uploaded to GCS: ${gcsUri}`);
    } catch (gcsError) {
      // Clean up batch job record on GCS failure
      await supabase
        .from('batch_jobs')
        .update({ status: 'failed', error_message: `GCS upload failed: ${gcsError}` })
        .eq('id', batchJobId);
      throw gcsError;
    }

    // ========================================================================
    // STEP 8: Create Vertex AI batch job
    // ========================================================================
    const modelPath = VertexAIBatchClient.buildModelPath(MODEL_CONFIG.GEMINI_PRO);
    const bucketName = gcsClient.bucketName;

    try {
      const batchJob = await batchClient.createBatchJob({
        displayName: `curriculum-${instructor_course_id.substring(0, 8)}-${Date.now()}`,
        model: modelPath,
        inputUri: `gs://${bucketName}/${inputPath}`,
        outputUriPrefix: `gs://${bucketName}/${BATCH_CONFIG.GCS_PREFIX}/${batchJobId}/output/`
      });

      console.log(`${fnName} Created Vertex AI job: ${batchJob.name}`);

      // Update batch_jobs with Vertex AI job ID
      await supabase
        .from('batch_jobs')
        .update({
          google_batch_id: batchJob.name,
          status: 'submitted'
        })
        .eq('id', batchJobId);

    } catch (vertexError) {
      // Clean up on Vertex AI failure
      try {
        await gcsClient.deleteFile(inputPath);
      } catch (cleanupError) {
        console.warn(`${fnName} Failed to cleanup GCS file:`, cleanupError);
      }
      await supabase
        .from('batch_jobs')
        .update({
          status: 'failed',
          error_message: `Vertex AI job creation failed: ${vertexError}`
        })
        .eq('id', batchJobId);
      throw vertexError;
    }

    // ========================================================================
    // STEP 9: Update LOs with batch job reference
    // ========================================================================
    const loIds = learningObjectives.map(lo => lo.id);

    await supabase
      .from('learning_objectives')
      .update({
        decomposition_status: 'in_progress',
        curriculum_batch_job_id: batchJobId
      })
      .in('id', loIds);

    console.log(`${fnName} Updated ${loIds.length} LOs with batch job reference`);

    // ========================================================================
    // STEP 10: Return success
    // ========================================================================
    logInfo('submit-batch-curriculum', 'complete', { batchJobId, count: learningObjectives.length });

    return createSuccessResponse({
      success: true,
      batch_job_id: batchJobId,
      total_requests: learningObjectives.length,
      message: `Batch curriculum job submitted. Call poll-batch-curriculum to check status.`
    }, corsHeaders);

  } catch (error) {
    logError('submit-batch-curriculum', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
