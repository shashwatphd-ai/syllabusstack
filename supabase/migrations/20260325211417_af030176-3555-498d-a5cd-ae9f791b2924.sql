-- Create project_metadata table
CREATE TABLE IF NOT EXISTS public.project_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.capstone_projects(id) ON DELETE CASCADE,
  ai_model_version TEXT,
  market_alignment_score NUMERIC,
  estimated_roi JSONB,
  pricing_breakdown JSONB,
  lo_alignment_detail JSONB,
  lo_mapping_tasks JSONB,
  lo_mapping_deliverables JSONB,
  market_signals_used JSONB,
  value_analysis JSONB,
  stakeholder_insights JSONB,
  partnership_quality_score NUMERIC,
  synergistic_value_index NUMERIC,
  skill_gap_analysis JSONB,
  salary_projections JSONB,
  discovery_quality JSONB,
  algorithm_transparency JSONB,
  verification_checks JSONB,
  enhanced_market_intel JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(project_id)
);

ALTER TABLE public.project_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view project metadata"
  ON public.project_metadata FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access to project_metadata"
  ON public.project_metadata FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Instructors can manage metadata for their projects"
  ON public.project_metadata FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.capstone_projects cp
      JOIN public.instructor_courses ic ON cp.instructor_course_id = ic.id
      WHERE cp.id = project_metadata.project_id
        AND ic.instructor_id = auth.uid()
    )
  );

CREATE INDEX idx_project_metadata_project ON public.project_metadata(project_id);

-- Now add columns to capstone_projects
ALTER TABLE public.capstone_projects
  ADD COLUMN IF NOT EXISTS pricing_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS mutual_benefit_score NUMERIC,
  ADD COLUMN IF NOT EXISTS algorithm_version TEXT,
  ADD COLUMN IF NOT EXISTS generation_metadata JSONB;

-- Add signal_data to company_profiles
ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS signal_data JSONB;