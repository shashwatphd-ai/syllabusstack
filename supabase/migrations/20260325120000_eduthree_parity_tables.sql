-- ============================================================================
-- Migration: EduThree Full Parity — Additional Tables & Schema Alignment
--
-- Adds tables for:
-- 1. project_generation_queue — Async FIFO queue for project generation
-- 2. employer_interest_submissions — Structured employer submissions linked to demand signals
-- 3. dashboard_analytics — Event tracking for demand signal dashboard
-- 4. project_applications — Student project applications (for student-project-matcher)
-- 5. project_metadata — Extended project data (ROI, value analysis, skill gaps)
-- 6. verified_competencies — Student skills verified by capstone project work
--
-- Also adds:
-- - Apollo job fields to job_matches
-- - Webhook signal fields to company_signals
-- - Faculty feedback fields to capstone_projects
-- ============================================================================

-- ============================================================================
-- TABLE 1: project_generation_queue
-- Async FIFO queue with retry logic for project generation
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_generation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  course_id UUID NOT NULL,
  generation_run_id UUID,

  -- Queue status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Retry logic
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,

  -- Error handling
  error_message TEXT,
  last_error_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Prevent duplicate queue entries
  UNIQUE(project_id)
);

COMMENT ON TABLE public.project_generation_queue IS 'Async FIFO queue for capstone project generation with retry logic';

-- Index for efficient queue processing (oldest pending first)
CREATE INDEX IF NOT EXISTS idx_queue_status_created
  ON public.project_generation_queue(status, created_at)
  WHERE status IN ('pending', 'processing');

-- Index for monitoring by generation run
CREATE INDEX IF NOT EXISTS idx_queue_generation_run
  ON public.project_generation_queue(generation_run_id);

ALTER TABLE public.project_generation_queue ENABLE ROW LEVEL SECURITY;

-- Faculty can view queue for their courses
CREATE POLICY "Faculty can view queue for their courses"
  ON public.project_generation_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instructor_courses
      WHERE id = project_generation_queue.course_id
        AND instructor_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to queue"
  ON public.project_generation_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE 2: employer_interest_submissions
-- Structured employer interest linked to demand signals
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.employer_interest_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Employer Information
  company_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  company_domain VARCHAR(255),

  -- Interest Details
  demand_signal_id UUID REFERENCES public.demand_signals(id),
  project_category VARCHAR(100),
  proposed_project_title VARCHAR(255),
  project_description TEXT,
  preferred_timeline VARCHAR(100),

  -- Status Tracking (approval gate)
  status VARCHAR(50) DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  matched_project_id UUID,

  -- Attribution Tracking
  referral_source VARCHAR(100),

  UNIQUE(contact_email, demand_signal_id)
);

COMMENT ON TABLE public.employer_interest_submissions IS 'Employer interest submissions linked to demand signals for project matching';

ALTER TABLE public.employer_interest_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can submit employer interest (public form)
CREATE POLICY "Anyone can submit employer interest"
  ON public.employer_interest_submissions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can manage employer submissions"
  ON public.employer_interest_submissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_employer_submissions_status ON public.employer_interest_submissions(status);
CREATE INDEX idx_employer_submissions_signal ON public.employer_interest_submissions(demand_signal_id);

-- ============================================================================
-- TABLE 3: dashboard_analytics
-- Event tracking for demand signal dashboard
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dashboard_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,

  event_type VARCHAR(50) NOT NULL,
  demand_signal_id UUID REFERENCES public.demand_signals(id),
  session_id VARCHAR(100),

  -- Engagement Metrics
  time_on_page INTEGER,
  filters_applied JSONB,

  -- Conversion Funnel
  resulted_in_submission BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE public.dashboard_analytics IS 'Analytics events for demand signal dashboard engagement';

ALTER TABLE public.dashboard_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to analytics"
  ON public.dashboard_analytics FOR ALL
  TO service_role
  USING (true);

CREATE INDEX idx_analytics_timestamp ON public.dashboard_analytics(event_timestamp);

-- ============================================================================
-- TABLE 4: project_applications
-- Student applications to curated projects (for student-project-matcher)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  applied_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, project_id)
);

COMMENT ON TABLE public.project_applications IS 'Student applications to curated capstone projects';

ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own applications"
  ON public.project_applications FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert own applications"
  ON public.project_applications FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Admins can manage all applications"
  ON public.project_applications FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_project_applications_student ON public.project_applications(student_id);
CREATE INDEX idx_project_applications_project ON public.project_applications(project_id);

-- ============================================================================
-- TABLE 5: project_metadata
-- Extended project data: ROI, value analysis, skill gaps, LO alignment detail
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE,
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
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.project_metadata IS 'Extended metadata for capstone projects: ROI, value analysis, skill gap analysis, LO mapping';

ALTER TABLE public.project_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view project metadata"
  ON public.project_metadata FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage project metadata"
  ON public.project_metadata FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_project_metadata_project ON public.project_metadata(project_id);

-- ============================================================================
-- TABLE 6: verified_competencies
-- Student skills verified by capstone project work (EduThree core table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.verified_competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Link to the student and the project that proved the skill
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID,

  -- The skill itself
  skill_name VARCHAR(255) NOT NULL,

  -- How the skill was verified
  verification_source VARCHAR(100),  -- e.g., 'ai_deliverable_scan', 'employer_rating'

  -- Employer-given rating (if applicable)
  employer_rating INTEGER CHECK (employer_rating >= 1 AND employer_rating <= 5),

  -- A link to the specific evidence
  portfolio_evidence_url TEXT,

  UNIQUE(student_id, project_id, skill_name)
);

COMMENT ON TABLE public.verified_competencies IS 'Student skills verified by capstone project work — bridges competency-extractor to job-matcher';

CREATE INDEX idx_competencies_student_id ON public.verified_competencies(student_id);
CREATE INDEX idx_competencies_skill_name ON public.verified_competencies(skill_name);

ALTER TABLE public.verified_competencies ENABLE ROW LEVEL SECURITY;

-- Students can view their own competencies
CREATE POLICY "Students can view own competencies"
  ON public.verified_competencies
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- Service role (AI functions) can insert competencies
CREATE POLICY "Service role can insert competencies"
  ON public.verified_competencies
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Admins can view all competencies
CREATE POLICY "Admins can view all competencies"
  ON public.verified_competencies
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update competencies (e.g., add employer ratings)
CREATE POLICY "Admins can update competencies"
  ON public.verified_competencies
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- SCHEMA ALIGNMENTS: Add Apollo fields to job_matches
-- ============================================================================

ALTER TABLE public.job_matches
  ADD COLUMN IF NOT EXISTS apollo_job_id TEXT,
  ADD COLUMN IF NOT EXISTS apollo_job_url TEXT,
  ADD COLUMN IF NOT EXISTS apollo_job_payload JSONB,
  ADD COLUMN IF NOT EXISTS competency_id UUID;

CREATE INDEX IF NOT EXISTS idx_job_matches_apollo ON public.job_matches(apollo_job_id) WHERE apollo_job_id IS NOT NULL;

-- ============================================================================
-- SCHEMA ALIGNMENTS: Add webhook fields to company_signals
-- ============================================================================

-- company_id as UUID to properly reference Apollo webhook payloads
-- (separate from company_profile_id which is the FK to company_profiles)
ALTER TABLE public.company_signals
  ADD COLUMN IF NOT EXISTS company_id UUID,
  ADD COLUMN IF NOT EXISTS apollo_webhook_payload JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_scoring',
  ADD COLUMN IF NOT EXISTS project_score INTEGER;

-- ============================================================================
-- SCHEMA ALIGNMENTS: Add faculty feedback fields to capstone_projects
-- ============================================================================

DO $$
BEGIN
  -- Only add if capstone_projects table exists (it should from prior migrations)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'capstone_projects' AND table_schema = 'public') THEN
    ALTER TABLE public.capstone_projects
      ADD COLUMN IF NOT EXISTS faculty_rating INTEGER CHECK (faculty_rating >= 1 AND faculty_rating <= 5),
      ADD COLUMN IF NOT EXISTS faculty_feedback TEXT,
      ADD COLUMN IF NOT EXISTS rating_tags TEXT[],
      ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_capstone_projects_rating
      ON public.capstone_projects(faculty_rating, rated_at)
      WHERE faculty_rating IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- Add job_postings_last_fetched and status to company_profiles
-- ============================================================================

ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS job_postings_last_fetched TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS job_postings_status TEXT;
