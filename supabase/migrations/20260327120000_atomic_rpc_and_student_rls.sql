-- ============================================================================
-- Migration: Atomic RPC for project creation + Student RLS on capstone_projects
-- ============================================================================

-- ============================================================================
-- 1. PL/pgSQL function: create_project_atomic
--    Inserts into capstone_projects, project_forms, and project_metadata
--    atomically within a single transaction.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_project_atomic(
  p_project_data JSONB,
  p_forms_data JSONB,
  p_metadata_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  -- Step 1: Insert into capstone_projects
  INSERT INTO public.capstone_projects (
    instructor_course_id,
    company_profile_id,
    title,
    description,
    tasks,
    deliverables,
    skills,
    tier,
    lo_alignment,
    lo_alignment_score,
    feasibility_score,
    final_score,
    contact,
    equipment,
    majors,
    status
  ) VALUES (
    (p_project_data->>'instructor_course_id')::UUID,
    (p_project_data->>'company_profile_id')::UUID,
    p_project_data->>'title',
    p_project_data->>'description',
    p_project_data->'tasks',
    p_project_data->'deliverables',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_project_data->'skills', '[]'::JSONB))),
    p_project_data->>'tier',
    p_project_data->>'lo_alignment',
    (p_project_data->>'lo_alignment_score')::NUMERIC,
    (p_project_data->>'feasibility_score')::NUMERIC,
    (p_project_data->>'final_score')::NUMERIC,
    p_project_data->'contact',
    p_project_data->>'equipment',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_project_data->'majors', '[]'::JSONB))),
    COALESCE(p_project_data->>'status', 'generated')
  )
  RETURNING id INTO v_project_id;

  -- Step 2: Insert into project_forms
  INSERT INTO public.project_forms (
    capstone_project_id,
    form1_project_details,
    form2_contact_info,
    form3_requirements,
    form4_timeline,
    form5_logistics,
    form6_academic,
    milestones
  ) VALUES (
    v_project_id,
    p_forms_data->'form1_project_details',
    p_forms_data->'form2_contact_info',
    p_forms_data->'form3_requirements',
    p_forms_data->'form4_timeline',
    p_forms_data->'form5_logistics',
    p_forms_data->'form6_academic',
    p_forms_data->'milestones'
  );

  -- Step 3: Insert into project_metadata
  INSERT INTO public.project_metadata (
    project_id,
    ai_model_version,
    market_alignment_score,
    estimated_roi,
    pricing_breakdown,
    lo_alignment_detail,
    lo_mapping_tasks,
    lo_mapping_deliverables,
    market_signals_used,
    value_analysis,
    stakeholder_insights,
    partnership_quality_score,
    synergistic_value_index,
    skill_gap_analysis,
    salary_projections,
    discovery_quality,
    algorithm_transparency,
    verification_checks,
    enhanced_market_intel
  ) VALUES (
    v_project_id,
    p_metadata_data->>'ai_model_version',
    (p_metadata_data->>'market_alignment_score')::NUMERIC,
    p_metadata_data->'estimated_roi',
    p_metadata_data->'pricing_breakdown',
    p_metadata_data->'lo_alignment_detail',
    p_metadata_data->'lo_mapping_tasks',
    p_metadata_data->'lo_mapping_deliverables',
    p_metadata_data->'market_signals_used',
    p_metadata_data->'value_analysis',
    p_metadata_data->'stakeholder_insights',
    (p_metadata_data->>'partnership_quality_score')::NUMERIC,
    (p_metadata_data->>'synergistic_value_index')::NUMERIC,
    p_metadata_data->'skill_gap_analysis',
    p_metadata_data->'salary_projections',
    p_metadata_data->'discovery_quality',
    p_metadata_data->'algorithm_transparency',
    p_metadata_data->'verification_checks',
    p_metadata_data->'enhanced_market_intel'
  );

  -- Return the newly created project ID
  RETURN jsonb_build_object('project_id', v_project_id);

EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'create_project_atomic failed: % %', SQLERRM, SQLSTATE;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.create_project_atomic(JSONB, JSONB, JSONB)
  IS 'Atomically creates a capstone project with its forms and metadata in a single transaction';

-- ============================================================================
-- 2. RLS policy on capstone_projects for students
--    Students can SELECT projects if they are enrolled in the course OR
--    have an application for the project.
-- ============================================================================

CREATE POLICY "Students can view projects via enrollment or application"
  ON public.capstone_projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.instructor_course_id = capstone_projects.instructor_course_id
        AND ce.student_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.project_applications pa
      WHERE pa.project_id = capstone_projects.id
        AND pa.student_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. Index on project_applications(student_id, capstone_project_id)
--    Wrapped in DO block to only create if the table exists.
--    Note: The actual column is project_id (not capstone_project_id).
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_applications'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_project_applications_student
      ON public.project_applications(student_id, project_id);
  END IF;
END $$;
