-- ============================================================================
-- Migration: Partnership Proposals & Evaluations
--
-- Phase 1: partnership_proposals — Instructor outreach to companies
-- Phase 2: evaluations — Student evaluation forms for capstone projects
-- Also: missing columns on capstone_projects, company_profiles, project_metadata
-- ============================================================================

-- ============================================================================
-- TABLE 1: partnership_proposals
-- Instructor-initiated outreach to companies from the project Contact tab
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.partnership_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Who is proposing
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instructor_course_id UUID NOT NULL,

  -- What project / company
  capstone_project_id UUID NOT NULL,
  company_profile_id UUID,

  -- Outreach details
  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin', 'saved')),
  subject TEXT,
  message_body TEXT NOT NULL,
  recipient_email TEXT,
  recipient_name TEXT,
  recipient_title TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'responded', 'accepted', 'declined')),
  sent_at TIMESTAMPTZ,
  response_received_at TIMESTAMPTZ,
  response_notes TEXT,

  -- Template tracking
  template_used TEXT
);

COMMENT ON TABLE public.partnership_proposals IS 'Instructor-initiated partnership outreach proposals to companies for capstone projects';

ALTER TABLE public.partnership_proposals ENABLE ROW LEVEL SECURITY;

-- Instructors can manage their own proposals
CREATE POLICY "Instructors can view own proposals"
  ON public.partnership_proposals FOR SELECT
  TO authenticated
  USING (instructor_id = auth.uid());

CREATE POLICY "Instructors can insert own proposals"
  ON public.partnership_proposals FOR INSERT
  TO authenticated
  WITH CHECK (instructor_id = auth.uid());

CREATE POLICY "Instructors can update own proposals"
  ON public.partnership_proposals FOR UPDATE
  TO authenticated
  USING (instructor_id = auth.uid());

-- Admins can view all proposals
CREATE POLICY "Admins can manage all proposals"
  ON public.partnership_proposals FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role full access
CREATE POLICY "Service role full access to proposals"
  ON public.partnership_proposals FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_proposals_instructor ON public.partnership_proposals(instructor_id);
CREATE INDEX idx_proposals_project ON public.partnership_proposals(capstone_project_id);
CREATE INDEX idx_proposals_company ON public.partnership_proposals(company_profile_id);
CREATE INDEX idx_proposals_status ON public.partnership_proposals(status);

-- ============================================================================
-- TABLE 2: evaluations
-- Student evaluation forms submitted by faculty or employers
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- What is being evaluated
  capstone_project_id UUID NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Who is evaluating
  evaluator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evaluator_role TEXT NOT NULL CHECK (evaluator_role IN ('instructor', 'employer', 'peer', 'self')),

  -- Evaluation data
  overall_score NUMERIC CHECK (overall_score >= 0 AND overall_score <= 100),
  rubric_scores JSONB,           -- { "technical": 85, "communication": 90, ... }
  strengths TEXT[],
  areas_for_improvement TEXT[],
  comments TEXT,

  -- Competency verification
  verified_skills TEXT[],        -- Skills confirmed through this evaluation
  recommendation TEXT CHECK (recommendation IN ('strong_yes', 'yes', 'neutral', 'no', 'strong_no')),

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'published'))
);

COMMENT ON TABLE public.evaluations IS 'Evaluation forms for capstone project work — submitted by faculty, employers, or peers';

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Evaluators can manage own evaluations"
  ON public.evaluations FOR ALL
  TO authenticated
  USING (evaluator_id = auth.uid());

CREATE POLICY "Students can view evaluations of their work"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() AND status = 'published');

CREATE POLICY "Admins can manage all evaluations"
  ON public.evaluations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access to evaluations"
  ON public.evaluations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_evaluations_project ON public.evaluations(capstone_project_id);
CREATE INDEX idx_evaluations_student ON public.evaluations(student_id);
CREATE INDEX idx_evaluations_evaluator ON public.evaluations(evaluator_id);

-- ============================================================================
-- SCHEMA ALIGNMENTS: Add missing columns to capstone_projects
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'capstone_projects' AND table_schema = 'public') THEN
    ALTER TABLE public.capstone_projects
      ADD COLUMN IF NOT EXISTS pricing_usd NUMERIC,
      ADD COLUMN IF NOT EXISTS mutual_benefit_score NUMERIC,
      ADD COLUMN IF NOT EXISTS algorithm_version TEXT,
      ADD COLUMN IF NOT EXISTS generation_metadata JSONB;
  END IF;
END $$;

-- ============================================================================
-- SCHEMA ALIGNMENTS: Add missing columns to project_metadata
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'project_metadata' AND table_schema = 'public') THEN
    ALTER TABLE public.project_metadata
      ADD COLUMN IF NOT EXISTS skill_gap_analysis JSONB,
      ADD COLUMN IF NOT EXISTS salary_projections JSONB,
      ADD COLUMN IF NOT EXISTS discovery_quality JSONB,
      ADD COLUMN IF NOT EXISTS algorithm_transparency JSONB,
      ADD COLUMN IF NOT EXISTS verification_checks JSONB,
      ADD COLUMN IF NOT EXISTS enhanced_market_intel JSONB;
  END IF;
END $$;

-- ============================================================================
-- SCHEMA ALIGNMENTS: Add signal_data to company_profiles if missing
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'company_profiles' AND table_schema = 'public') THEN
    ALTER TABLE public.company_profiles
      ADD COLUMN IF NOT EXISTS signal_data JSONB;
  END IF;
END $$;
