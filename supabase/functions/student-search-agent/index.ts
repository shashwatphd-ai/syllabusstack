/**
 * Student Search Agent — Testing Wrapper
 *
 * Thin edge function that exposes the student search agent for independent testing.
 * Call this directly to see what search queries the student agent generates for a
 * given learning objective/teaching unit — without running the full search pipeline.
 *
 * Usage:
 *   POST /functions/v1/student-search-agent
 *   Body: { "learning_objective_id": "...", "teaching_unit_id": "..." (optional) }
 *   Returns: { content_brief, had_teaching_context, teaching_unit_id }
 */

import { createClient } from "@supabase/supabase-js";
import { generateStudentSearchBrief } from "../_shared/query-intelligence/reasoners/student-search-agent.ts";
import type { QueryGenerationContext, TeachingContext } from "../_shared/query-intelligence/types.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
} from "../_shared/error-handler.ts";

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;
  const corsHeaders = getCorsHeaders(req);

  // Auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return createErrorResponse('No authorization header', corsHeaders, undefined, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return createErrorResponse('Invalid authentication', corsHeaders, undefined, 401);
  }

  const body = await req.json();
  const { learning_objective_id, teaching_unit_id } = body;

  if (!learning_objective_id) {
    return createErrorResponse('learning_objective_id is required', corsHeaders, undefined, 400);
  }

  console.log(`[student-search-agent] Testing for LO: ${learning_objective_id}, TU: ${teaching_unit_id || 'auto'}`);

  // Fetch LO with module and course context
  const { data: lo, error: loError } = await supabase
    .from('learning_objectives')
    .select(`
      id, text, core_concept, bloom_level, domain, search_keywords,
      expected_duration_minutes,
      module:module_id(title, description),
      course:instructor_course_id(title, description, code)
    `)
    .eq('id', learning_objective_id)
    .single();

  if (loError || !lo) {
    return createErrorResponse(`Learning objective not found: ${loError?.message}`, corsHeaders, undefined, 404);
  }

  // Fetch teaching unit (specific or first for this LO)
  let tu: any = null;
  if (teaching_unit_id) {
    const { data } = await supabase
      .from('teaching_units')
      .select('*')
      .eq('id', teaching_unit_id)
      .single();
    tu = data;
  } else {
    const { data } = await supabase
      .from('teaching_units')
      .select('*')
      .eq('learning_objective_id', learning_objective_id)
      .order('sequence_order')
      .limit(1)
      .single();
    tu = data;
  }

  // Build query generation context
  const moduleContext = lo.module as any;
  const courseContext = lo.course as any;

  const teachingContext: TeachingContext | undefined = tu ? {
    what_to_teach: tu.what_to_teach,
    why_this_matters: tu.why_this_matters,
    how_to_teach: tu.how_to_teach,
    common_misconceptions: tu.common_misconceptions,
    prerequisites: tu.prerequisites,
    enables: tu.enables,
    required_concepts: tu.required_concepts,
    target_video_type: tu.target_video_type,
  } : undefined;

  const context: QueryGenerationContext = {
    learningObjective: {
      id: lo.id,
      text: tu?.what_to_teach || lo.text,
      core_concept: tu?.title || lo.core_concept || '',
      action_verb: lo.search_keywords?.[0] || 'understand',
      bloom_level: (lo.bloom_level || 'understand') as any,
      domain: (lo.domain || 'other') as any,
      specificity: 'intermediate' as any,
      search_keywords: tu?.required_concepts?.length > 0 ? tu.required_concepts : (lo.search_keywords || []),
      expected_duration_minutes: tu?.target_duration_minutes || lo.expected_duration_minutes || 15,
    },
    module: moduleContext ? {
      title: moduleContext.title,
      description: moduleContext.description,
      sequence_order: 0,
    } : undefined,
    course: courseContext ? {
      title: courseContext.title,
      description: courseContext.description,
      code: courseContext.code,
    } : undefined,
    teaching: teachingContext,
  };

  // Call the student search agent
  const startTime = Date.now();
  const contentBrief = await generateStudentSearchBrief(context);
  const elapsed = Date.now() - startTime;

  console.log(`[student-search-agent] Completed in ${elapsed}ms, brief: ${contentBrief ? contentBrief.roles.map(r => r.role).join(', ') : 'null'}`);

  return createSuccessResponse({
    content_brief: contentBrief,
    had_teaching_context: !!tu,
    teaching_unit_id: tu?.id || null,
    teaching_unit_title: tu?.title || null,
    learning_objective: lo.text,
    elapsed_ms: elapsed,
  }, corsHeaders);
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
