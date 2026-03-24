-- Phase D: capstone_generation_runs audit table
CREATE TABLE public.capstone_generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_course_id uuid REFERENCES public.instructor_courses(id) ON DELETE CASCADE NOT NULL,
  started_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'running',
  phases_completed text[] DEFAULT '{}',
  current_phase text,
  companies_discovered integer DEFAULT 0,
  companies_validated integer DEFAULT 0,
  companies_saved integer DEFAULT 0,
  projects_generated integer DEFAULT 0,
  total_processing_time_ms integer,
  phase_timings jsonb DEFAULT '{}',
  error_details jsonb,
  onet_data jsonb,
  signal_summary jsonb,
  credits_used numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.capstone_generation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can view own generation runs"
  ON public.capstone_generation_runs
  FOR SELECT
  TO authenticated
  USING (public.is_course_instructor(auth.uid(), instructor_course_id));

CREATE POLICY "Instructors can insert generation runs"
  ON public.capstone_generation_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_course_instructor(auth.uid(), instructor_course_id));

-- Add signal scoring columns to company_profiles
ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS skill_match_score numeric,
  ADD COLUMN IF NOT EXISTS market_signal_score numeric,
  ADD COLUMN IF NOT EXISTS department_fit_score numeric,
  ADD COLUMN IF NOT EXISTS contact_quality_score numeric,
  ADD COLUMN IF NOT EXISTS composite_signal_score numeric,
  ADD COLUMN IF NOT EXISTS signal_confidence text,
  ADD COLUMN IF NOT EXISTS signal_data jsonb,
  ADD COLUMN IF NOT EXISTS generation_run_id uuid REFERENCES public.capstone_generation_runs(id),
  ADD COLUMN IF NOT EXISTS inferred_needs text[];