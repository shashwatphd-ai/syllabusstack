// ============================================================================
// SHARED CONTEXT FETCHER - Teaching unit context gathering
// ============================================================================
//
// CANONICAL SOURCE: Extracted from generate-lecture-slides-v3/index.ts
// Used by: generate-lecture-slides-v3, generate-batch-slides
//

import type { TeachingUnitContext, DomainConfig } from './slide-types.ts';

// ============================================================================
// SINGLE TEACHING UNIT CONTEXT
// ============================================================================

export async function fetchTeachingUnitContext(
  supabase: any,
  teachingUnitId: string,
  userId?: string | null
): Promise<TeachingUnitContext> {
  console.log('[Context] Fetching complete teaching unit context', { teachingUnitId, userId: userId ? 'present' : 'missing' });

  // 1) Teaching unit (no joins) — avoids false negatives when related rows are missing
  const { data: unit, error: unitError } = await supabase
    .from('teaching_units')
    .select('*')
    .eq('id', teachingUnitId)
    .maybeSingle();

  if (unitError) {
    console.error('[Context] Error fetching teaching unit:', unitError);
    throw new Error('Failed to fetch teaching unit');
  }

  if (!unit) {
    console.error('[Context] Teaching unit not found:', { teachingUnitId });
    throw new Error('Teaching unit not found');
  }

  if (!unit.learning_objective_id) {
    console.error('[Context] Teaching unit missing learning_objective_id:', { teachingUnitId });
    throw new Error('Teaching unit is missing learning objective linkage');
  }

  // 2) Learning objective
  const { data: lo, error: loError } = await supabase
    .from('learning_objectives')
    .select('id, text, bloom_level, core_concept, action_verb, module_id, instructor_course_id, user_id')
    .eq('id', unit.learning_objective_id)
    .maybeSingle();

  if (loError) {
    console.error('[Context] Error fetching learning objective:', loError);
    throw new Error('Failed to fetch learning objective');
  }

  if (!lo) {
    console.error('[Context] Learning objective not found for teaching unit:', {
      teachingUnitId,
      learningObjectiveId: unit.learning_objective_id,
    });
    throw new Error('Learning objective not found for teaching unit');
  }

  if (!lo.instructor_course_id) {
    console.error('[Context] Learning objective missing instructor_course_id:', { learningObjectiveId: lo.id });
    throw new Error('Learning objective is missing course linkage');
  }

  // 3) Course (used for domain + syllabus grounding)
  const { data: course, error: courseError } = await supabase
    .from('instructor_courses')
    .select('id, title, detected_domain, code, syllabus_text, instructor_id, domain_config')
    .eq('id', lo.instructor_course_id)
    .maybeSingle();

  if (courseError) {
    console.error('[Context] Error fetching course:', courseError);
    throw new Error('Failed to fetch course for teaching unit');
  }

  if (!course) {
    console.error('[Context] Course not found for teaching unit:', { teachingUnitId, instructorCourseId: lo.instructor_course_id });
    throw new Error('Course not found for teaching unit');
  }

  // Multi-user safety: if we have an authenticated user, enforce ownership
  if (userId && course.instructor_id && course.instructor_id !== userId) {
    console.warn('[Auth] Instructor mismatch for teaching unit generation', {
      teachingUnitId,
      expectedInstructorId: course.instructor_id,
      actualUserId: userId,
    });
    throw new Error('Not authorized to generate lecture for this course');
  }

  // 4) Module (optional)
  let moduleTitle = 'Unassigned';
  let moduleDescription = '';
  let moduleSequence = 0;

  if (lo.module_id) {
    const { data: mod, error: modError } = await supabase
      .from('modules')
      .select('title, description, sequence_order')
      .eq('id', lo.module_id)
      .maybeSingle();

    if (modError) {
      console.warn('[Context] Module fetch failed (continuing with defaults):', modError);
    } else if (mod) {
      moduleTitle = mod.title || moduleTitle;
      moduleDescription = mod.description || moduleDescription;
      moduleSequence = typeof mod.sequence_order === 'number' ? mod.sequence_order : moduleSequence;
    }
  }

  // 5) Sibling teaching units for sequence context
  const { data: siblingUnits, error: siblingsError } = await supabase
    .from('teaching_units')
    .select('id, title, what_to_teach, sequence_order')
    .eq('learning_objective_id', lo.id)
    .order('sequence_order');

  if (siblingsError) {
    console.warn('[Context] Failed to fetch sibling units (continuing):', siblingsError);
  }

  const siblings = siblingUnits || [];
  const currentIndex = siblings.findIndex((s: any) => s.id === teachingUnitId);

  const context: TeachingUnitContext = {
    id: unit.id,
    title: unit.title,
    what_to_teach: unit.what_to_teach || '',
    why_this_matters: unit.why_this_matters || '',
    how_to_teach: unit.how_to_teach || '',
    target_duration_minutes: unit.target_duration_minutes || 8,
    target_video_type: unit.target_video_type || 'explainer',
    prerequisites: unit.prerequisites || [],
    enables: unit.enables || [],
    common_misconceptions: unit.common_misconceptions || [],
    required_concepts: unit.required_concepts || [],
    avoid_terms: unit.avoid_terms || [],
    search_queries: unit.search_queries || [],
    domain: course.detected_domain || 'general',
    syllabus_text: course.syllabus_text,
    learning_objective: {
      id: lo.id,
      text: lo.text,
      bloom_level: lo.bloom_level || 'understand',
      core_concept: lo.core_concept || '',
      action_verb: lo.action_verb || 'explain',
    },
    module: {
      title: moduleTitle,
      description: moduleDescription,
      sequence_order: moduleSequence,
    },
    course: {
      id: course.id,
      title: course.title,
      detected_domain: course.detected_domain || '',
      code: course.code || '',
    },
    sibling_units: siblings.map((s: any) => ({
      id: s.id,
      title: s.title,
      what_to_teach: s.what_to_teach || '',
      sequence_order: s.sequence_order,
    })),
    sequence_position: currentIndex >= 0 ? currentIndex + 1 : 1,
    total_siblings: siblings.length,
    domain_config: course.domain_config as DomainConfig | null,
  };

  console.log('[Context] Context built:', {
    title: context.title,
    duration: context.target_duration_minutes,
    prerequisites: context.prerequisites.length,
    misconceptions: context.common_misconceptions.length,
    siblings: context.total_siblings,
    position: context.sequence_position,
  });

  return context;
}

// ============================================================================
// BATCH CONTEXT FETCHER - For multiple teaching units
// ============================================================================

export async function fetchBatchTeachingUnits(
  supabase: any,
  teachingUnitIds: string[]
): Promise<TeachingUnitContext[]> {
  console.log(`[Context] Fetching batch context for ${teachingUnitIds.length} teaching units`);

  const contexts: TeachingUnitContext[] = [];

  for (const id of teachingUnitIds) {
    try {
      const context = await fetchTeachingUnitContext(supabase, id);
      contexts.push(context);
    } catch (error) {
      console.error(`[Context] Failed to fetch context for unit ${id}:`, error);
      // Continue with remaining units
    }
  }

  console.log(`[Context] Batch complete: ${contexts.length}/${teachingUnitIds.length} units fetched`);
  return contexts;
}
