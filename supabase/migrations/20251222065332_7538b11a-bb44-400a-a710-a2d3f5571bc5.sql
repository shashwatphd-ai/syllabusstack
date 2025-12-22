
-- =============================================
-- EDUTHREE VERIFIED LEARNING PLATFORM SCHEMA
-- Part 1: Core Foundation Tables
-- =============================================

-- Create role enum and user_roles table (security best practice)
CREATE TYPE public.app_role AS ENUM ('student', 'instructor', 'admin');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'instructor' THEN 2 
      WHEN 'student' THEN 3 
    END
  LIMIT 1
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to auto-assign student role on new user
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- =============================================
-- INSTRUCTOR COURSES
-- =============================================
CREATE TABLE public.instructor_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL,
  title TEXT NOT NULL,
  code TEXT,
  description TEXT,
  curation_mode TEXT DEFAULT 'guided_auto' CHECK (curation_mode IN ('full_control', 'guided_auto', 'hands_off')),
  verification_threshold INTEGER DEFAULT 70 CHECK (verification_threshold BETWEEN 0 AND 100),
  is_published BOOLEAN DEFAULT FALSE,
  access_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.instructor_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can view their own courses"
ON public.instructor_courses FOR SELECT
USING (auth.uid() = instructor_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can create courses"
ON public.instructor_courses FOR INSERT
WITH CHECK (auth.uid() = instructor_id AND public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Instructors can update their own courses"
ON public.instructor_courses FOR UPDATE
USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors can delete their own courses"
ON public.instructor_courses FOR DELETE
USING (auth.uid() = instructor_id);

-- =============================================
-- COURSE ENROLLMENTS (create before modules so RLS can reference it)
-- =============================================
CREATE TABLE public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  instructor_course_id UUID REFERENCES public.instructor_courses(id) ON DELETE CASCADE NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  overall_progress DECIMAL DEFAULT 0 CHECK (overall_progress BETWEEN 0 AND 100),
  UNIQUE(student_id, instructor_course_id)
);

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their enrollments"
ON public.course_enrollments FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students can enroll themselves"
ON public.course_enrollments FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Instructors can view enrollments for their courses"
ON public.course_enrollments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.instructor_courses ic
    WHERE ic.id = course_enrollments.instructor_course_id
    AND ic.instructor_id = auth.uid()
  )
);

-- =============================================
-- MODULES
-- =============================================
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_course_id UUID REFERENCES public.instructor_courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can manage their modules"
ON public.modules FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.instructor_courses ic
    WHERE ic.id = modules.instructor_course_id
    AND ic.instructor_id = auth.uid()
  )
);

CREATE POLICY "Students can view modules of enrolled courses"
ON public.modules FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    WHERE ce.instructor_course_id = modules.instructor_course_id
    AND ce.student_id = auth.uid()
  )
);

-- =============================================
-- CONTENT LIBRARY
-- =============================================
CREATE TABLE public.content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('youtube', 'instructor_upload', 'article', 'textbook')),
  source_url TEXT,
  source_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  duration_seconds INTEGER,
  thumbnail_url TEXT,
  channel_name TEXT,
  channel_id TEXT,
  view_count BIGINT,
  like_count BIGINT,
  like_ratio DECIMAL,
  published_at TIMESTAMPTZ,
  quality_score DECIMAL,
  is_available BOOLEAN DEFAULT TRUE,
  last_availability_check TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available content"
ON public.content FOR SELECT
USING (is_available = TRUE);

CREATE POLICY "Instructors can create content"
ON public.content FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'instructor') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Content creators can update their content"
ON public.content FOR UPDATE
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =============================================
-- LEARNING OBJECTIVES
-- =============================================
CREATE TABLE public.learning_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  text TEXT NOT NULL,
  core_concept TEXT,
  action_verb TEXT,
  bloom_level TEXT CHECK (bloom_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')),
  domain TEXT CHECK (domain IN ('business', 'science', 'humanities', 'technical', 'arts', 'other')),
  specificity TEXT CHECK (specificity IN ('introductory', 'intermediate', 'advanced')),
  search_keywords TEXT[],
  expected_duration_minutes INTEGER,
  verification_state TEXT DEFAULT 'unstarted' CHECK (verification_state IN ('unstarted', 'in_progress', 'verified', 'assessment_unlocked', 'passed', 'remediation_required')),
  sequence_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.learning_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own learning objectives"
ON public.learning_objectives FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own learning objectives"
ON public.learning_objectives FOR ALL
USING (auth.uid() = user_id);

-- =============================================
-- CONTENT MATCHES
-- =============================================
CREATE TABLE public.content_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_objective_id UUID REFERENCES public.learning_objectives(id) ON DELETE CASCADE NOT NULL,
  content_id UUID REFERENCES public.content(id) ON DELETE CASCADE NOT NULL,
  match_score DECIMAL NOT NULL CHECK (match_score BETWEEN 0 AND 1),
  duration_fit_score DECIMAL CHECK (duration_fit_score BETWEEN 0 AND 1),
  semantic_similarity_score DECIMAL CHECK (semantic_similarity_score BETWEEN 0 AND 1),
  engagement_quality_score DECIMAL CHECK (engagement_quality_score BETWEEN 0 AND 1),
  channel_authority_score DECIMAL CHECK (channel_authority_score BETWEEN 0 AND 1),
  recency_score DECIMAL CHECK (recency_score BETWEEN 0 AND 1),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(learning_objective_id, content_id)
);

ALTER TABLE public.content_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view content matches for their LOs"
ON public.content_matches FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.learning_objectives lo
    WHERE lo.id = content_matches.learning_objective_id
    AND lo.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage content matches for their LOs"
ON public.content_matches FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.learning_objectives lo
    WHERE lo.id = content_matches.learning_objective_id
    AND lo.user_id = auth.uid()
  )
);

-- =============================================
-- CONSUMPTION RECORDS
-- =============================================
CREATE TABLE public.consumption_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content_id UUID REFERENCES public.content(id) ON DELETE CASCADE NOT NULL,
  learning_objective_id UUID REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
  watched_segments JSONB DEFAULT '[]',
  watch_percentage DECIMAL DEFAULT 0 CHECK (watch_percentage BETWEEN 0 AND 100),
  total_watch_time_seconds INTEGER DEFAULT 0,
  tab_focus_losses JSONB DEFAULT '[]',
  rewind_events JSONB DEFAULT '[]',
  playback_speed_violations INTEGER DEFAULT 0,
  time_on_content_score DECIMAL CHECK (time_on_content_score BETWEEN 0 AND 1),
  micro_check_accuracy_score DECIMAL CHECK (micro_check_accuracy_score BETWEEN 0 AND 1),
  interaction_signals_score DECIMAL CHECK (interaction_signals_score BETWEEN 0 AND 1),
  engagement_score DECIMAL CHECK (engagement_score BETWEEN 0 AND 100),
  is_verified BOOLEAN DEFAULT FALSE,
  current_position_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_id, learning_objective_id)
);

ALTER TABLE public.consumption_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own consumption records"
ON public.consumption_records FOR ALL
USING (auth.uid() = user_id);

-- =============================================
-- MICRO-CHECKS
-- =============================================
CREATE TABLE public.micro_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES public.content(id) ON DELETE CASCADE NOT NULL,
  trigger_time_seconds INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('recall', 'mcq')),
  options JSONB,
  correct_answer TEXT NOT NULL,
  rewind_target_seconds INTEGER,
  time_limit_seconds INTEGER DEFAULT 10,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.micro_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view micro-checks"
ON public.micro_checks FOR SELECT
USING (TRUE);

CREATE POLICY "Instructors can manage micro-checks"
ON public.micro_checks FOR ALL
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =============================================
-- MICRO-CHECK RESULTS
-- =============================================
CREATE TABLE public.micro_check_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumption_record_id UUID REFERENCES public.consumption_records(id) ON DELETE CASCADE NOT NULL,
  micro_check_id UUID REFERENCES public.micro_checks(id) ON DELETE CASCADE NOT NULL,
  user_answer TEXT,
  is_correct BOOLEAN NOT NULL,
  time_taken_seconds INTEGER,
  attempt_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.micro_check_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own micro-check results"
ON public.micro_check_results FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.consumption_records cr
    WHERE cr.id = micro_check_results.consumption_record_id
    AND cr.user_id = auth.uid()
  )
);

-- =============================================
-- ASSESSMENT QUESTIONS
-- =============================================
CREATE TABLE public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_objective_id UUID REFERENCES public.learning_objectives(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'short_answer')),
  options JSONB,
  correct_answer TEXT,
  accepted_answers TEXT[],
  required_keywords TEXT[],
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  bloom_level TEXT CHECK (bloom_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')),
  time_limit_seconds INTEGER DEFAULT 45,
  scenario_context TEXT,
  has_image BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  created_by UUID,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  ai_reviewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view questions for their LOs"
ON public.assessment_questions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.learning_objectives lo
    WHERE lo.id = assessment_questions.learning_objective_id
    AND lo.user_id = auth.uid()
  )
);

CREATE POLICY "Instructors can manage questions"
ON public.assessment_questions FOR ALL
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =============================================
-- ASSESSMENT SESSIONS
-- =============================================
CREATE TABLE public.assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  learning_objective_id UUID REFERENCES public.learning_objectives(id) ON DELETE CASCADE NOT NULL,
  attempt_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'timed_out', 'abandoned')),
  question_ids UUID[] NOT NULL,
  current_question_index INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  timeout_at TIMESTAMPTZ,
  total_score DECIMAL CHECK (total_score BETWEEN 0 AND 100),
  questions_answered INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  passed BOOLEAN
);

ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own assessment sessions"
ON public.assessment_sessions FOR ALL
USING (auth.uid() = user_id);

-- =============================================
-- ASSESSMENT ANSWERS
-- =============================================
CREATE TABLE public.assessment_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.assessment_sessions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.assessment_questions(id) ON DELETE CASCADE NOT NULL,
  user_answer TEXT,
  is_correct BOOLEAN,
  time_taken_seconds INTEGER,
  question_served_at TIMESTAMPTZ,
  answer_submitted_at TIMESTAMPTZ,
  server_received_at TIMESTAMPTZ DEFAULT NOW(),
  evaluation_method TEXT,
  evaluation_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.assessment_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own assessment answers"
ON public.assessment_answers FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.assessment_sessions s
    WHERE s.id = assessment_answers.session_id
    AND s.user_id = auth.uid()
  )
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_learning_objectives_user_id ON public.learning_objectives(user_id);
CREATE INDEX idx_learning_objectives_module_id ON public.learning_objectives(module_id);
CREATE INDEX idx_learning_objectives_course_id ON public.learning_objectives(course_id);
CREATE INDEX idx_content_source_type ON public.content(source_type);
CREATE INDEX idx_content_source_id ON public.content(source_id);
CREATE INDEX idx_content_matches_lo_id ON public.content_matches(learning_objective_id);
CREATE INDEX idx_content_matches_status ON public.content_matches(status);
CREATE INDEX idx_consumption_records_user_id ON public.consumption_records(user_id);
CREATE INDEX idx_consumption_records_content_id ON public.consumption_records(content_id);
CREATE INDEX idx_assessment_sessions_user_id ON public.assessment_sessions(user_id);
CREATE INDEX idx_assessment_sessions_lo_id ON public.assessment_sessions(learning_objective_id);
CREATE INDEX idx_course_enrollments_student_id ON public.course_enrollments(student_id);
CREATE INDEX idx_instructor_courses_instructor_id ON public.instructor_courses(instructor_id);

-- =============================================
-- UPDATE TRIGGERS
-- =============================================
CREATE TRIGGER update_instructor_courses_updated_at
  BEFORE UPDATE ON public.instructor_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_learning_objectives_updated_at
  BEFORE UPDATE ON public.learning_objectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON public.content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_consumption_records_updated_at
  BEFORE UPDATE ON public.consumption_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessment_questions_updated_at
  BEFORE UPDATE ON public.assessment_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
