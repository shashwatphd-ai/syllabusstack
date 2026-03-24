
-- Phase 2: Student capstone applications
CREATE TABLE public.capstone_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capstone_project_id UUID REFERENCES public.capstone_projects(id) ON DELETE CASCADE NOT NULL,
  student_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  cover_letter TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(capstone_project_id, student_id)
);

ALTER TABLE public.capstone_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own applications"
  ON public.capstone_applications FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can apply to projects"
  ON public.capstone_applications FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Instructors can view project applications"
  ON public.capstone_applications FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.capstone_projects cp
      JOIN public.instructor_courses ic ON cp.instructor_course_id = ic.id
      WHERE cp.id = capstone_project_id AND ic.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can update application status"
  ON public.capstone_applications FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.capstone_projects cp
      JOIN public.instructor_courses ic ON cp.instructor_course_id = ic.id
      WHERE cp.id = capstone_project_id AND ic.instructor_id = auth.uid()
    )
  );

-- Phase 3: Employer interest submissions
CREATE TABLE public.employer_interest_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  project_description TEXT,
  target_skills TEXT[],
  preferred_timeline TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  submitted_by UUID,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employer_interest_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit employer interest"
  ON public.employer_interest_submissions FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Users can view own submissions"
  ON public.employer_interest_submissions FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

CREATE POLICY "Admins can view all submissions"
  ON public.employer_interest_submissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update submissions"
  ON public.employer_interest_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Phase 3: Student ratings
CREATE TABLE public.student_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  employer_account_id UUID REFERENCES public.employer_accounts(id) ON DELETE CASCADE,
  capstone_project_id UUID REFERENCES public.capstone_projects(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  skills_demonstrated TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.student_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers can insert ratings"
  ON public.student_ratings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employer_accounts ea
      WHERE ea.id = employer_account_id AND ea.primary_contact_user_id = auth.uid()
    )
  );

CREATE POLICY "Students can view own ratings"
  ON public.student_ratings FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Admins can view all ratings"
  ON public.student_ratings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Faculty project feedback
CREATE TABLE public.project_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capstone_project_id UUID REFERENCES public.capstone_projects(id) ON DELETE CASCADE NOT NULL,
  instructor_id UUID NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(capstone_project_id, instructor_id)
);

ALTER TABLE public.project_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can manage own feedback"
  ON public.project_feedback FOR ALL TO authenticated
  USING (instructor_id = auth.uid())
  WITH CHECK (instructor_id = auth.uid());

-- Enable realtime for applications
ALTER PUBLICATION supabase_realtime ADD TABLE public.capstone_applications;
