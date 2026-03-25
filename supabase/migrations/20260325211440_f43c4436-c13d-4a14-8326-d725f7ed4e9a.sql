-- TABLE: partnership_proposals
CREATE TABLE IF NOT EXISTS public.partnership_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instructor_course_id UUID NOT NULL REFERENCES public.instructor_courses(id) ON DELETE CASCADE,
  capstone_project_id UUID NOT NULL REFERENCES public.capstone_projects(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES public.company_profiles(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin', 'saved')),
  subject TEXT,
  message_body TEXT NOT NULL,
  recipient_email TEXT,
  recipient_name TEXT,
  recipient_title TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'responded', 'accepted', 'declined')),
  sent_at TIMESTAMPTZ,
  response_received_at TIMESTAMPTZ,
  response_notes TEXT,
  template_used TEXT
);

ALTER TABLE public.partnership_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can view own proposals"
  ON public.partnership_proposals FOR SELECT TO authenticated
  USING (instructor_id = auth.uid());

CREATE POLICY "Instructors can insert own proposals"
  ON public.partnership_proposals FOR INSERT TO authenticated
  WITH CHECK (instructor_id = auth.uid());

CREATE POLICY "Instructors can update own proposals"
  ON public.partnership_proposals FOR UPDATE TO authenticated
  USING (instructor_id = auth.uid());

CREATE POLICY "Admins can manage all proposals"
  ON public.partnership_proposals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access to proposals"
  ON public.partnership_proposals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_proposals_instructor ON public.partnership_proposals(instructor_id);
CREATE INDEX idx_proposals_project ON public.partnership_proposals(capstone_project_id);
CREATE INDEX idx_proposals_company ON public.partnership_proposals(company_profile_id);
CREATE INDEX idx_proposals_status ON public.partnership_proposals(status);

-- TABLE: evaluations
CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  capstone_project_id UUID NOT NULL REFERENCES public.capstone_projects(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evaluator_role TEXT NOT NULL CHECK (evaluator_role IN ('instructor', 'employer', 'peer', 'self')),
  overall_score NUMERIC CHECK (overall_score >= 0 AND overall_score <= 100),
  rubric_scores JSONB,
  strengths TEXT[],
  areas_for_improvement TEXT[],
  comments TEXT,
  verified_skills TEXT[],
  recommendation TEXT CHECK (recommendation IN ('strong_yes', 'yes', 'neutral', 'no', 'strong_no')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'published'))
);

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Evaluators can manage own evaluations"
  ON public.evaluations FOR ALL TO authenticated
  USING (evaluator_id = auth.uid());

CREATE POLICY "Students can view published evaluations"
  ON public.evaluations FOR SELECT TO authenticated
  USING (student_id = auth.uid() AND status = 'published');

CREATE POLICY "Admins can manage all evaluations"
  ON public.evaluations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access to evaluations"
  ON public.evaluations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_evaluations_project ON public.evaluations(capstone_project_id);
CREATE INDEX idx_evaluations_student ON public.evaluations(student_id);
CREATE INDEX idx_evaluations_evaluator ON public.evaluations(evaluator_id);