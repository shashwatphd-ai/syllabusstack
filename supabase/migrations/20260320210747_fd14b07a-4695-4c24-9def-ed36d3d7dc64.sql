
-- Step 1: Add new columns to instructor_courses
ALTER TABLE public.instructor_courses
  ADD COLUMN IF NOT EXISTS location_city TEXT,
  ADD COLUMN IF NOT EXISTS location_state TEXT,
  ADD COLUMN IF NOT EXISTS location_zip TEXT,
  ADD COLUMN IF NOT EXISTS search_location TEXT,
  ADD COLUMN IF NOT EXISTS academic_level VARCHAR(20),
  ADD COLUMN IF NOT EXISTS expected_artifacts TEXT[];

-- Step 2: Create company_profiles table
CREATE TABLE public.company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sector TEXT,
  size TEXT,
  description TEXT,
  website TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_person TEXT,
  contact_title TEXT,
  full_address TEXT,
  linkedin_profile TEXT,
  apollo_organization_id TEXT UNIQUE,
  technologies_used TEXT[],
  job_postings JSONB,
  funding_stage TEXT,
  total_funding_usd BIGINT,
  employee_count TEXT,
  revenue_range TEXT,
  industries TEXT[],
  keywords TEXT[],
  data_completeness_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view companies"
  ON public.company_profiles FOR SELECT TO authenticated
  USING (true);

-- Step 3: Create capstone_projects table
CREATE TABLE public.capstone_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_course_id UUID NOT NULL REFERENCES public.instructor_courses(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES public.company_profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  tasks JSONB,
  deliverables JSONB,
  skills TEXT[],
  tier TEXT,
  lo_alignment TEXT,
  lo_alignment_score NUMERIC,
  feasibility_score NUMERIC,
  final_score NUMERIC,
  contact JSONB,
  equipment TEXT,
  majors TEXT[],
  status TEXT NOT NULL DEFAULT 'generated',
  assigned_student_id UUID,
  generation_batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.capstone_projects ENABLE ROW LEVEL SECURITY;

-- Instructor full CRUD
CREATE POLICY "Instructors can manage capstone projects"
  ON public.capstone_projects FOR ALL TO authenticated
  USING (public.is_course_instructor(auth.uid(), instructor_course_id))
  WITH CHECK (public.is_course_instructor(auth.uid(), instructor_course_id));

-- Enrolled students can view
CREATE POLICY "Enrolled students can view capstone projects"
  ON public.capstone_projects FOR SELECT TO authenticated
  USING (public.is_enrolled_student(auth.uid(), instructor_course_id));

-- Assigned student can update status
CREATE POLICY "Assigned students can update their project status"
  ON public.capstone_projects FOR UPDATE TO authenticated
  USING (assigned_student_id = auth.uid())
  WITH CHECK (assigned_student_id = auth.uid());

-- Step 4: Create project_forms table (1:1 with capstone_projects)
CREATE TABLE public.project_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capstone_project_id UUID NOT NULL UNIQUE REFERENCES public.capstone_projects(id) ON DELETE CASCADE,
  form1_project_details JSONB,
  form2_contact_info JSONB,
  form3_requirements JSONB,
  form4_timeline JSONB,
  form5_logistics JSONB,
  form6_academic JSONB,
  milestones JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_forms ENABLE ROW LEVEL SECURITY;

-- Same RLS as capstone_projects
CREATE POLICY "Instructors can manage project forms"
  ON public.project_forms FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.capstone_projects cp
    WHERE cp.id = project_forms.capstone_project_id
    AND public.is_course_instructor(auth.uid(), cp.instructor_course_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.capstone_projects cp
    WHERE cp.id = project_forms.capstone_project_id
    AND public.is_course_instructor(auth.uid(), cp.instructor_course_id)
  ));

CREATE POLICY "Enrolled students can view project forms"
  ON public.project_forms FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.capstone_projects cp
    WHERE cp.id = project_forms.capstone_project_id
    AND public.is_enrolled_student(auth.uid(), cp.instructor_course_id)
  ));

-- updated_at triggers
CREATE TRIGGER update_company_profiles_updated_at
  BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_capstone_projects_updated_at
  BEFORE UPDATE ON public.capstone_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_forms_updated_at
  BEFORE UPDATE ON public.project_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
