import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// SUBMIT BATCH SLIDES - Google Batch API Integration
// ============================================================================
//
// PURPOSE: Submit all teaching units for a course to Google Batch API
//
// WHY THIS APPROACH:
//   - 50% cost savings vs real-time API
//   - Higher throughput (no MAX_CONCURRENT limit)
//   - Simpler code (no queue management)
//   - Better UX (single job to track)
//
// REPLACES: process-lecture-queue's 'queue-bulk' action
//
// FLOW:
//   1. Receive instructor_course_id and teaching_unit_ids[]
//   2. Fetch all teaching unit context data
//   3. Build prompts using same logic as generate-lecture-slides-v3
//   4. Create inline batch request (for <1000 items)
//   5. Submit to Google Batch API
//   6. Store batch job ID in database
//   7. Create lecture_slides records with status='batch_pending'
//   8. Return immediately - processing happens async on Google's side
//
// NOTE: Keep generate-lecture-slides-v3 for single slide generation
//       This function is ONLY for bulk "Generate All" operations
//
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Batch API endpoint
const GOOGLE_BATCH_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:batchGenerateContent';

// ============================================================================
// PROFESSOR SYSTEM PROMPT (Same as v3 - for consistency)
// ============================================================================
//
// NOTE: This is intentionally duplicated from generate-lecture-slides-v3
// to keep this function self-contained and avoid import issues.
// Any changes to prompts should be made in BOTH places.
//

const PROFESSOR_SYSTEM_PROMPT = `You are an expert university professor creating comprehensive, self-contained lecture slides. You have decades of teaching experience, deep subject matter expertise, and mastery of evidence-based pedagogy.

YOUR MISSION:
Create a complete slide deck that enables DEEP LEARNING. Every slide must provide substantive, textbook-quality content that students can study independently. NO superficial bullet points or vague phrases—only thorough, academically rigorous explanations.

CORE TEACHING PHILOSOPHY:
- Write as if this is the student's PRIMARY learning resource (not supplementary)
- Every concept deserves a proper textbook-style definition followed by detailed explanation
- Abstract ideas must be grounded in concrete, real-world examples with verifiable data
- Build understanding step-by-step, never assuming the student will "figure it out"
- Anticipate confusion and address it proactively

SLIDE TYPES (use appropriately):
- title: Opening that hooks attention with real-world relevance
- hook: Why students should care—use statistics, trends, career implications
- recap: Connect to prerequisites with specific callbacks
- definition: COMPREHENSIVE treatment—formal definition + explanation + significance
- explanation: Detailed conceptual exploration with reasoning
- example: Rich, detailed real-world application
- demonstration: Step-by-step walkthrough with explicit reasoning
- process: Multi-step procedures with clear explanations
- misconception: Directly address wrong beliefs
- practice: Guided mental exercise with thinking prompts
- synthesis: Connect multiple concepts, show relationships
- summary: Consolidate key learning points
- preview: Foreshadow next topics, create anticipation

CONTENT REQUIREMENTS:
1. main_text: 3-4 substantive sentences that TEACH
2. key_points: 4-5 detailed bullet points with explanations
3. speaker_notes: 200-300 words of natural lecture narration
4. visual_directive: Type, description, elements, style

QUALITY STANDARDS:
- NO vague phrases—be SPECIFIC
- NO unexplained jargon—define every term
- NO orphaned concepts—connect everything
- NO filler content—every sentence must teach

OUTPUT FORMAT: JSON with slides array containing order, type, title, content, visual_directive, speaker_notes, estimated_seconds, pedagogy.`;

// ============================================================================
// TYPES
// ============================================================================

interface TeachingUnitData {
  id: string;
  title: string;
  what_to_teach: string;
  why_this_matters: string;
  how_to_teach: string;
  target_duration_minutes: number;
  prerequisites: string[];
  common_misconceptions: string[];
  required_concepts: string[];
  learning_objective: {
    id: string;
    text: string;
    bloom_level: string;
    core_concept: string;
  };
  course: {
    id: string;
    title: string;
    code: string;
    detected_domain: string;
  };
  module: {
    title: string;
    description: string;
  };
}

interface BatchRequest {
  key: string;
  request: {
    contents: Array<{
      role: string;
      parts: Array<{ text: string }>;
    }>;
    systemInstruction: {
      parts: Array<{ text: string }>;
    };
    generationConfig: {
      temperature: number;
      maxOutputTokens: number;
    };
  };
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================
//
// Builds the lecture brief and user prompt for a teaching unit.
// Same logic as generate-lecture-slides-v3 for consistency.
//

function buildPromptForUnit(unit: TeachingUnitData): string {
  const targetSlides = Math.max(5, Math.round(unit.target_duration_minutes * 1.5));

  const lectureBrief = `
=== COURSE CONTEXT ===
Course: ${unit.course.title} (${unit.course.code || 'No code'})
Domain: ${unit.course.detected_domain || 'general'}

=== MODULE CONTEXT ===
Module: ${unit.module.title}
Description: ${unit.module.description || 'No description provided'}

=== LEARNING OBJECTIVE ===
"${unit.learning_objective.text}"
Bloom Level: ${unit.learning_objective.bloom_level}
Core Concept: ${unit.learning_objective.core_concept}

=== CURRENT TEACHING UNIT: ${unit.title} ===

WHAT TO TEACH:
${unit.what_to_teach}

WHY THIS MATTERS:
${unit.why_this_matters}

HOW TO TEACH:
${unit.how_to_teach || 'Use clear explanations with concrete examples'}

PREREQUISITES (assume student knows):
${unit.prerequisites?.length > 0 ? unit.prerequisites.map(p => `- ${p}`).join('\n') : '- None specified'}

COMMON MISCONCEPTIONS (must address):
${unit.common_misconceptions?.length > 0 ? unit.common_misconceptions.map(m => `- ${m}`).join('\n') : '- None specified'}

REQUIRED CONCEPTS (must define):
${unit.required_concepts?.length > 0 ? unit.required_concepts.map(c => `- ${c}`).join('\n') : '- Derive from what_to_teach'}

TARGET DURATION: ${unit.target_duration_minutes} minutes
`.trim();

  const userPrompt = `${lectureBrief}

=== YOUR TASK ===
Create a comprehensive ${targetSlides}-slide lecture deck for this teaching unit.

CRITICAL REQUIREMENTS:
1. Every common_misconception MUST have a dedicated "misconception" slide
2. Every required_concept MUST be defined with formal definition + explanation
3. Speaker notes MUST be 200-300 words of natural lecture narration
4. Bloom level "${unit.learning_objective.bloom_level}" dictates cognitive depth

OUTPUT (JSON array of slides):
{
  "slides": [
    {
      "order": 1,
      "type": "title",
      "title": "Engaging title",
      "content": {
        "main_text": "3-4 substantive sentences...",
        "key_points": ["Detailed point 1", "Detailed point 2"]
      },
      "visual_directive": {
        "type": "illustration",
        "description": "Description for image generation",
        "elements": ["element1", "element2"],
        "style": "clean academic"
      },
      "speaker_notes": "200-300 words of natural lecture narration...",
      "estimated_seconds": 90,
      "pedagogy": {
        "purpose": "Hook attention",
        "bloom_action": "activate prior knowledge",
        "transition_to_next": "Now let's define..."
      }
    }
  ]
}

Generate all ${targetSlides} slides now with RICH, EDUCATIONAL content.`;

  return userPrompt;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ========================================================================
    // 1. SETUP AND VALIDATION
    // ========================================================================

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');

    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'GOOGLE_CLOUD_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      if (token !== serviceRoleKey) {
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      }
    }

    // Parse request body
    const { instructor_course_id, teaching_unit_ids } = await req.json();

    if (!instructor_course_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'instructor_course_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!teaching_unit_ids?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'teaching_unit_ids array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Batch] Starting batch submission for ${teaching_unit_ids.length} teaching units`);

    // ========================================================================
    // 2. FETCH TEACHING UNIT DATA
    // ========================================================================
    //
    // Get all the context needed to build prompts for each teaching unit.
    // This includes course, module, and learning objective data.
    //

    const { data: units, error: unitsError } = await supabase
      .from('teaching_units')
      .select(`
        id,
        title,
        what_to_teach,
        why_this_matters,
        how_to_teach,
        target_duration_minutes,
        prerequisites,
        common_misconceptions,
        required_concepts,
        learning_objective_id,
        learning_objectives!inner (
          id,
          text,
          bloom_level,
          core_concept,
          module_id,
          instructor_course_id,
          modules (
            title,
            description
          )
        )
      `)
      .in('id', teaching_unit_ids);

    if (unitsError) {
      console.error('[Batch] Error fetching teaching units:', unitsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch teaching units' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!units || units.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No teaching units found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch course data
    const { data: course, error: courseError } = await supabase
      .from('instructor_courses')
      .select('id, title, code, detected_domain')
      .eq('id', instructor_course_id)
      .single();

    if (courseError || !course) {
      console.error('[Batch] Error fetching course:', courseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Course not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Batch] Found ${units.length} teaching units for course: ${course.title}`);

    // ========================================================================
    // 3. CHECK FOR EXISTING SLIDES
    // ========================================================================
    //
    // Skip units that already have ready/published slides.
    // Re-queue failed ones.
    //

    const { data: existingSlides } = await supabase
      .from('lecture_slides')
      .select('teaching_unit_id, status')
      .in('teaching_unit_id', teaching_unit_ids);

    const existingMap = new Map(existingSlides?.map(s => [s.teaching_unit_id, s.status]) || []);

    // Filter to only units that need generation
    const unitsToProcess = units.filter(unit => {
      const status = existingMap.get(unit.id);
      // Skip ready, published, or currently generating
      if (status === 'ready' || status === 'published' || status === 'generating' || status === 'batch_pending') {
        return false;
      }
      return true;
    });

    if (unitsToProcess.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All slides already generated or in progress',
          skipped: units.length,
          batch_job_id: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Batch] Processing ${unitsToProcess.length} units (skipping ${units.length - unitsToProcess.length} existing)`);

    // ========================================================================
    // 4. BUILD BATCH REQUESTS
    // ========================================================================
    //
    // Create the batch request body for Google Batch API.
    // Each request has a unique key for correlation.
    //

    const batchRequests: BatchRequest[] = [];
    const requestMapping: Record<string, string> = {}; // key -> teaching_unit_id

    for (let i = 0; i < unitsToProcess.length; i++) {
      const unit = unitsToProcess[i];
      const lo = unit.learning_objectives as any;
      const module = lo?.modules;

      // Build enriched unit data
      const unitData: TeachingUnitData = {
        id: unit.id,
        title: unit.title,
        what_to_teach: unit.what_to_teach || '',
        why_this_matters: unit.why_this_matters || '',
        how_to_teach: unit.how_to_teach || '',
        target_duration_minutes: unit.target_duration_minutes || 8,
        prerequisites: unit.prerequisites || [],
        common_misconceptions: unit.common_misconceptions || [],
        required_concepts: unit.required_concepts || [],
        learning_objective: {
          id: lo?.id || '',
          text: lo?.text || '',
          bloom_level: lo?.bloom_level || 'understand',
          core_concept: lo?.core_concept || '',
        },
        course: {
          id: course.id,
          title: course.title,
          code: course.code || '',
          detected_domain: course.detected_domain || 'general',
        },
        module: {
          title: module?.title || 'Module',
          description: module?.description || '',
        },
      };

      // Build prompt
      const userPrompt = buildPromptForUnit(unitData);

      // Create request key (used to correlate responses)
      const requestKey = `slide_${i}`;
      requestMapping[requestKey] = unit.id;

      // Add to batch
      batchRequests.push({
        key: requestKey,
        request: {
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }],
            },
          ],
          systemInstruction: {
            parts: [{ text: PROFESSOR_SYSTEM_PROMPT }],
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        },
      });
    }

    console.log(`[Batch] Built ${batchRequests.length} batch requests`);

    // ========================================================================
    // 5. SUBMIT TO GOOGLE BATCH API
    // ========================================================================
    //
    // Submit the batch to Google's Batch API endpoint.
    // For inline requests (<1000), we send directly in the request body.
    //
    // API Documentation: https://ai.google.dev/gemini-api/docs/batch-api
    //

    const batchResponse = await fetch(
      `${GOOGLE_BATCH_API}?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: batchRequests.map(r => r.request),
        }),
      }
    );

    if (!batchResponse.ok) {
      const errorText = await batchResponse.text();
      console.error('[Batch] Google API error:', batchResponse.status, errorText);

      // Handle specific error codes
      if (batchResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (batchResponse.status === 403) {
        return new Response(
          JSON.stringify({ success: false, error: 'API quota exceeded or billing issue. Check Google Cloud account.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: `Batch API error: ${batchResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const batchData = await batchResponse.json();

    // For synchronous batch (batchGenerateContent), responses are inline
    // For async batch (batches.create), we'd get a job ID to poll
    console.log('[Batch] Received batch response');

    // ========================================================================
    // 6. CREATE BATCH JOB RECORD
    // ========================================================================
    //
    // Store the batch job in our database for tracking.
    // Even for sync batches, this helps with audit trail.
    //

    const { data: batchJob, error: batchJobError } = await supabase
      .from('batch_jobs')
      .insert({
        google_batch_id: `sync_batch_${Date.now()}`, // For sync batch, generate our own ID
        instructor_course_id,
        job_type: 'slides',
        total_requests: batchRequests.length,
        status: 'processing', // Sync batch processes immediately
        request_mapping: requestMapping,
        created_by: userId,
      })
      .select('id')
      .single();

    if (batchJobError) {
      console.error('[Batch] Error creating batch job record:', batchJobError);
      // Continue anyway - we have the results
    }

    const batchJobId = batchJob?.id;
    console.log(`[Batch] Created batch job record: ${batchJobId}`);

    // ========================================================================
    // 7. PROCESS RESPONSES AND CREATE SLIDES
    // ========================================================================
    //
    // For synchronous batchGenerateContent, responses come back immediately.
    // Parse each response and create/update lecture_slides records.
    //

    const responses = batchData.responses || [];
    let succeededCount = 0;
    let failedCount = 0;
    const failedKeys: string[] = [];

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const requestKey = `slide_${i}`;
      const teachingUnitId = requestMapping[requestKey];

      if (!teachingUnitId) {
        console.warn(`[Batch] No mapping for key ${requestKey}`);
        continue;
      }

      try {
        // Check for error in response
        if (response.error) {
          console.error(`[Batch] Error for ${requestKey}:`, response.error);
          failedCount++;
          failedKeys.push(requestKey);

          // Mark as failed in database
          await supabase
            .from('lecture_slides')
            .upsert({
              teaching_unit_id: teachingUnitId,
              learning_objective_id: unitsToProcess.find(u => u.id === teachingUnitId)?.learning_objective_id,
              instructor_course_id,
              title: unitsToProcess.find(u => u.id === teachingUnitId)?.title || 'Untitled',
              status: 'failed',
              error_message: response.error.message || 'Batch generation failed',
              batch_job_id: batchJobId,
              created_by: userId,
            }, {
              onConflict: 'teaching_unit_id',
            });

          continue;
        }

        // Extract content from response
        const content = response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) {
          console.warn(`[Batch] No content for ${requestKey}`);
          failedCount++;
          failedKeys.push(requestKey);
          continue;
        }

        // Parse JSON from response (handle markdown code blocks)
        let slides;
        try {
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
          const parsed = JSON.parse(jsonStr);
          slides = parsed.slides || parsed;
        } catch (parseError) {
          console.error(`[Batch] JSON parse error for ${requestKey}:`, parseError);
          failedCount++;
          failedKeys.push(requestKey);

          await supabase
            .from('lecture_slides')
            .upsert({
              teaching_unit_id: teachingUnitId,
              learning_objective_id: unitsToProcess.find(u => u.id === teachingUnitId)?.learning_objective_id,
              instructor_course_id,
              title: unitsToProcess.find(u => u.id === teachingUnitId)?.title || 'Untitled',
              status: 'failed',
              error_message: 'Failed to parse AI response',
              batch_job_id: batchJobId,
              created_by: userId,
            }, {
              onConflict: 'teaching_unit_id',
            });

          continue;
        }

        // Format slides for storage
        const formattedSlides = slides.map((slide: any) => ({
          order: slide.order,
          type: slide.type,
          title: slide.title,
          content: {
            main_text: slide.content?.main_text || '',
            key_points: slide.content?.key_points || [],
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
          },
          speaker_notes: slide.speaker_notes || '',
          speaker_notes_duration_seconds: slide.estimated_seconds || 60,
          pedagogy: slide.pedagogy || {},
        }));

        // Save to database
        const unitData = unitsToProcess.find(u => u.id === teachingUnitId);
        const { error: saveError } = await supabase
          .from('lecture_slides')
          .upsert({
            teaching_unit_id: teachingUnitId,
            learning_objective_id: unitData?.learning_objective_id,
            instructor_course_id,
            title: unitData?.title || 'Untitled',
            slides: formattedSlides,
            total_slides: formattedSlides.length,
            status: 'ready',
            slide_style: 'standard',
            generation_model: 'gemini-2.5-flash',
            estimated_duration_minutes: Math.round(formattedSlides.length * 1.5),
            batch_job_id: batchJobId,
            created_by: userId,
            generation_phases: {
              method: 'batch_api',
              completed_at: new Date().toISOString(),
            },
          }, {
            onConflict: 'teaching_unit_id',
          });

        if (saveError) {
          console.error(`[Batch] Error saving slides for ${requestKey}:`, saveError);
          failedCount++;
          failedKeys.push(requestKey);
        } else {
          succeededCount++;
          console.log(`[Batch] Successfully saved ${formattedSlides.length} slides for ${teachingUnitId}`);
        }

      } catch (err) {
        console.error(`[Batch] Unexpected error processing ${requestKey}:`, err);
        failedCount++;
        failedKeys.push(requestKey);
      }
    }

    // ========================================================================
    // 8. UPDATE BATCH JOB STATUS
    // ========================================================================

    if (batchJobId) {
      const finalStatus = failedCount === 0 ? 'completed' :
                          succeededCount === 0 ? 'failed' : 'partial';

      await supabase
        .from('batch_jobs')
        .update({
          status: finalStatus,
          succeeded_count: succeededCount,
          failed_count: failedCount,
          failed_request_keys: failedKeys,
          completed_at: new Date().toISOString(),
        })
        .eq('id', batchJobId);
    }

    console.log(`[Batch] Complete: ${succeededCount} succeeded, ${failedCount} failed`);

    // ========================================================================
    // 9. RETURN RESULT
    // ========================================================================

    return new Response(
      JSON.stringify({
        success: true,
        batch_job_id: batchJobId,
        total: batchRequests.length,
        succeeded: succeededCount,
        failed: failedCount,
        skipped: units.length - unitsToProcess.length,
        message: `Generated ${succeededCount} slide decks${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Batch] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
