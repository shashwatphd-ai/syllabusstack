-- ============================================
-- SKILLS ASSESSMENT → CAREER → CURRICULUM PIPELINE
-- Phase 1: Database Schema Migration
-- ============================================

-- 1. SKILL PROFILES TABLE
-- Stores computed assessment results for users
CREATE TABLE public.skill_profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    holland_code VARCHAR(3),
    holland_scores JSONB DEFAULT '{}',
    technical_skills JSONB DEFAULT '{}',
    work_values JSONB DEFAULT '{}',
    assessment_version VARCHAR(20) DEFAULT '1.0',
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_skill_profile UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.skill_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own skill profile"
ON public.skill_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own skill profile"
ON public.skill_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own skill profile"
ON public.skill_profiles FOR UPDATE
USING (auth.uid() = user_id);

-- 2. ASSESSMENT ITEM BANK TABLE
-- Repository of all assessment questions (public domain instruments)
CREATE TABLE public.assessment_item_bank (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    framework VARCHAR(50) NOT NULL CHECK (framework IN ('holland_riasec', 'onet_skills', 'work_values')),
    measures_dimension VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL DEFAULT 'likert_5' CHECK (question_type IN ('likert_5', 'likert_7', 'slider_100', 'forced_choice')),
    response_options JSONB,
    is_reverse_scored BOOLEAN DEFAULT false,
    difficulty_level VARCHAR(20) DEFAULT 'standard',
    sequence_order INTEGER,
    is_quick_assessment BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (read-only for authenticated users)
ALTER TABLE public.assessment_item_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read assessment items"
ON public.assessment_item_bank FOR SELECT
TO authenticated
USING (true);

-- Create index for efficient querying by framework
CREATE INDEX idx_assessment_items_framework ON public.assessment_item_bank(framework);
CREATE INDEX idx_assessment_items_quick ON public.assessment_item_bank(is_quick_assessment) WHERE is_quick_assessment = true;

-- 3. SKILLS ASSESSMENT SESSIONS TABLE
-- Tracks user assessment progress
CREATE TABLE public.skills_assessment_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    session_type VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (session_type IN ('standard', 'quick')),
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned', 'expired')),
    total_questions INTEGER NOT NULL,
    questions_answered INTEGER DEFAULT 0,
    current_section VARCHAR(50),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.skills_assessment_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assessment sessions"
ON public.skills_assessment_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assessment sessions"
ON public.skills_assessment_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assessment sessions"
ON public.skills_assessment_sessions FOR UPDATE
USING (auth.uid() = user_id);

-- Index for finding active sessions
CREATE INDEX idx_assessment_sessions_user_status ON public.skills_assessment_sessions(user_id, status);

-- 4. SKILLS ASSESSMENT RESPONSES TABLE
-- Individual question responses
CREATE TABLE public.skills_assessment_responses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.skills_assessment_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.assessment_item_bank(id),
    response_value INTEGER NOT NULL,
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT unique_session_question UNIQUE (session_id, question_id)
);

-- Enable RLS
ALTER TABLE public.skills_assessment_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own responses"
ON public.skills_assessment_responses FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.skills_assessment_sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    )
);

CREATE POLICY "Users can create their own responses"
ON public.skills_assessment_responses FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.skills_assessment_sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    )
);

-- Index for session lookups
CREATE INDEX idx_assessment_responses_session ON public.skills_assessment_responses(session_id);

-- 5. O*NET OCCUPATIONS TABLE
-- Cached occupation data from O*NET database
CREATE TABLE public.onet_occupations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    soc_code VARCHAR(10) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    riasec_code VARCHAR(3),
    riasec_scores JSONB DEFAULT '{}',
    required_skills JSONB DEFAULT '[]',
    required_knowledge JSONB DEFAULT '[]',
    required_abilities JSONB DEFAULT '[]',
    work_values JSONB DEFAULT '{}',
    education_level VARCHAR(50),
    experience_level VARCHAR(50),
    median_wage INTEGER,
    job_outlook VARCHAR(50),
    job_outlook_percent DECIMAL(5,2),
    employment_count INTEGER,
    bright_outlook BOOLEAN DEFAULT false,
    green_occupation BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (read-only for authenticated users)
ALTER TABLE public.onet_occupations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read occupations"
ON public.onet_occupations FOR SELECT
TO authenticated
USING (true);

-- Indexes for matching
CREATE INDEX idx_onet_riasec ON public.onet_occupations(riasec_code);
CREATE INDEX idx_onet_title ON public.onet_occupations USING gin(to_tsvector('english', title));

-- 6. CAREER MATCHES TABLE
-- User-specific career matching results
CREATE TABLE public.career_matches (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    skill_profile_id UUID REFERENCES public.skill_profiles(id) ON DELETE SET NULL,
    onet_soc_code VARCHAR(10) NOT NULL,
    occupation_title VARCHAR(200) NOT NULL,
    overall_match_score DECIMAL(5,2) NOT NULL,
    interest_match_score DECIMAL(5,2),
    skill_match_score DECIMAL(5,2),
    values_match_score DECIMAL(5,2),
    skill_gaps JSONB DEFAULT '[]',
    match_breakdown JSONB DEFAULT '{}',
    dream_job_id UUID REFERENCES public.dream_jobs(id) ON DELETE SET NULL,
    is_saved BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_occupation UNIQUE (user_id, onet_soc_code)
);

-- Enable RLS
ALTER TABLE public.career_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own career matches"
ON public.career_matches FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own career matches"
ON public.career_matches FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own career matches"
ON public.career_matches FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own career matches"
ON public.career_matches FOR DELETE
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_career_matches_user ON public.career_matches(user_id);
CREATE INDEX idx_career_matches_score ON public.career_matches(user_id, overall_match_score DESC);

-- 7. GENERATED CURRICULA TABLE
-- AI-generated learning paths
CREATE TABLE public.generated_curricula (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    career_match_id UUID REFERENCES public.career_matches(id) ON DELETE SET NULL,
    target_occupation VARCHAR(200) NOT NULL,
    curriculum_structure JSONB NOT NULL DEFAULT '{"subjects": []}',
    total_subjects INTEGER DEFAULT 0,
    total_modules INTEGER DEFAULT 0,
    total_learning_objectives INTEGER DEFAULT 0,
    estimated_weeks INTEGER,
    generation_model VARCHAR(100),
    generation_prompt_hash VARCHAR(64),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generated_curricula ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own curricula"
ON public.generated_curricula FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own curricula"
ON public.generated_curricula FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own curricula"
ON public.generated_curricula FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own curricula"
ON public.generated_curricula FOR DELETE
USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_curricula_user ON public.generated_curricula(user_id);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply to new tables
CREATE TRIGGER update_skill_profiles_updated_at
BEFORE UPDATE ON public.skill_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessment_sessions_updated_at
BEFORE UPDATE ON public.skills_assessment_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_onet_occupations_updated_at
BEFORE UPDATE ON public.onet_occupations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_career_matches_updated_at
BEFORE UPDATE ON public.career_matches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_curricula_updated_at
BEFORE UPDATE ON public.generated_curricula
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SEED: ASSESSMENT ITEM BANK (103 items)
-- ============================================

-- HOLLAND RIASEC ITEMS (48 items - 8 per dimension)
-- Based on public domain Holland assessment instruments

-- REALISTIC (R) - 8 items
INSERT INTO public.assessment_item_bank (framework, measures_dimension, question_text, question_type, sequence_order, is_quick_assessment) VALUES
('holland_riasec', 'realistic', 'I enjoy working with tools, machines, or my hands', 'likert_5', 1, true),
('holland_riasec', 'realistic', 'I like to repair things around the house', 'likert_5', 2, false),
('holland_riasec', 'realistic', 'I enjoy outdoor activities like hiking, camping, or gardening', 'likert_5', 3, true),
('holland_riasec', 'realistic', 'I prefer jobs where I can see tangible results of my work', 'likert_5', 4, false),
('holland_riasec', 'realistic', 'I am good at reading blueprints or technical diagrams', 'likert_5', 5, false),
('holland_riasec', 'realistic', 'I like building or assembling things', 'likert_5', 6, true),
('holland_riasec', 'realistic', 'I enjoy operating machinery or equipment', 'likert_5', 7, false),
('holland_riasec', 'realistic', 'I prefer practical, hands-on learning over theoretical study', 'likert_5', 8, true);

-- INVESTIGATIVE (I) - 8 items
INSERT INTO public.assessment_item_bank (framework, measures_dimension, question_text, question_type, sequence_order, is_quick_assessment) VALUES
('holland_riasec', 'investigative', 'I enjoy solving complex puzzles or problems', 'likert_5', 9, true),
('holland_riasec', 'investigative', 'I like to analyze data and look for patterns', 'likert_5', 10, true),
('holland_riasec', 'investigative', 'I am curious about how things work scientifically', 'likert_5', 11, false),
('holland_riasec', 'investigative', 'I enjoy conducting research or experiments', 'likert_5', 12, true),
('holland_riasec', 'investigative', 'I prefer to thoroughly understand a topic before acting', 'likert_5', 13, false),
('holland_riasec', 'investigative', 'I like learning about new scientific discoveries', 'likert_5', 14, false),
('holland_riasec', 'investigative', 'I enjoy working with abstract ideas and theories', 'likert_5', 15, true),
('holland_riasec', 'investigative', 'I am comfortable using logic and mathematics', 'likert_5', 16, false);

-- ARTISTIC (A) - 8 items
INSERT INTO public.assessment_item_bank (framework, measures_dimension, question_text, question_type, sequence_order, is_quick_assessment) VALUES
('holland_riasec', 'artistic', 'I enjoy creating art, music, or writing', 'likert_5', 17, true),
('holland_riasec', 'artistic', 'I like expressing myself through creative activities', 'likert_5', 18, true),
('holland_riasec', 'artistic', 'I appreciate aesthetic beauty in my environment', 'likert_5', 19, false),
('holland_riasec', 'artistic', 'I prefer work that allows for creative freedom', 'likert_5', 20, true),
('holland_riasec', 'artistic', 'I am imaginative and often come up with original ideas', 'likert_5', 21, false),
('holland_riasec', 'artistic', 'I enjoy performing or presenting to others', 'likert_5', 22, false),
('holland_riasec', 'artistic', 'I like designing or decorating spaces', 'likert_5', 23, true),
('holland_riasec', 'artistic', 'I am drawn to unconventional or innovative approaches', 'likert_5', 24, false);

-- SOCIAL (S) - 8 items
INSERT INTO public.assessment_item_bank (framework, measures_dimension, question_text, question_type, sequence_order, is_quick_assessment) VALUES
('holland_riasec', 'social', 'I enjoy helping others solve their problems', 'likert_5', 25, true),
('holland_riasec', 'social', 'I like teaching or training people', 'likert_5', 26, true),
('holland_riasec', 'social', 'I am good at understanding how others feel', 'likert_5', 27, false),
('holland_riasec', 'social', 'I prefer working with people rather than things or data', 'likert_5', 28, true),
('holland_riasec', 'social', 'I enjoy volunteering or community service', 'likert_5', 29, false),
('holland_riasec', 'social', 'I am patient when working with people who need help', 'likert_5', 30, false),
('holland_riasec', 'social', 'I like counseling or advising others', 'likert_5', 31, true),
('holland_riasec', 'social', 'I find satisfaction in making a positive difference in peoples lives', 'likert_5', 32, false);

-- ENTERPRISING (E) - 8 items
INSERT INTO public.assessment_item_bank (framework, measures_dimension, question_text, question_type, sequence_order, is_quick_assessment) VALUES
('holland_riasec', 'enterprising', 'I enjoy leading or managing projects', 'likert_5', 33, true),
('holland_riasec', 'enterprising', 'I like persuading others to see my point of view', 'likert_5', 34, true),
('holland_riasec', 'enterprising', 'I am comfortable taking risks for potential rewards', 'likert_5', 35, false),
('holland_riasec', 'enterprising', 'I enjoy selling products, services, or ideas', 'likert_5', 36, true),
('holland_riasec', 'enterprising', 'I like being in charge and making decisions', 'likert_5', 37, false),
('holland_riasec', 'enterprising', 'I am competitive and like to win', 'likert_5', 38, false),
('holland_riasec', 'enterprising', 'I enjoy networking and building professional relationships', 'likert_5', 39, true),
('holland_riasec', 'enterprising', 'I am motivated by financial success and status', 'likert_5', 40, false);

-- CONVENTIONAL (C) - 8 items
INSERT INTO public.assessment_item_bank (framework, measures_dimension, question_text, question_type, sequence_order, is_quick_assessment) VALUES
('holland_riasec', 'conventional', 'I like organizing information and keeping records', 'likert_5', 41, true),
('holland_riasec', 'conventional', 'I prefer work with clear rules and procedures', 'likert_5', 42, true),
('holland_riasec', 'conventional', 'I am detail-oriented and accurate in my work', 'likert_5', 43, false),
('holland_riasec', 'conventional', 'I enjoy working with numbers and data', 'likert_5', 44, true),
('holland_riasec', 'conventional', 'I like following established methods and routines', 'likert_5', 45, false),
('holland_riasec', 'conventional', 'I am good at managing files, schedules, or databases', 'likert_5', 46, false),
('holland_riasec', 'conventional', 'I prefer structured work environments', 'likert_5', 47, true),
('holland_riasec', 'conventional', 'I take pride in doing things correctly and efficiently', 'likert_5', 48, false);

-- O*NET SKILLS ITEMS (35 items)
-- Based on O*NET skill categories with self-assessment

INSERT INTO public.assessment_item_bank (framework, measures_dimension, question_text, question_type, sequence_order, is_quick_assessment) VALUES
-- Basic Skills
('onet_skills', 'reading_comprehension', 'I can understand and interpret complex written documents', 'likert_5', 49, true),
('onet_skills', 'active_listening', 'I am good at paying attention and understanding what others say', 'likert_5', 50, true),
('onet_skills', 'writing', 'I can write clearly and effectively for different audiences', 'likert_5', 51, true),
('onet_skills', 'speaking', 'I am comfortable speaking to individuals or groups', 'likert_5', 52, true),
('onet_skills', 'mathematics', 'I am proficient in mathematical calculations and concepts', 'likert_5', 53, true),
('onet_skills', 'science', 'I understand and can apply scientific principles', 'likert_5', 54, false),

-- Social Skills
('onet_skills', 'social_perceptiveness', 'I can read social situations and understand others reactions', 'likert_5', 55, true),
('onet_skills', 'coordination', 'I can coordinate my work effectively with others', 'likert_5', 56, false),
('onet_skills', 'persuasion', 'I can convince others to change their minds or behavior', 'likert_5', 57, true),
('onet_skills', 'negotiation', 'I am skilled at reaching agreements and reconciling differences', 'likert_5', 58, false),
('onet_skills', 'instructing', 'I can teach others how to do something effectively', 'likert_5', 59, true),
('onet_skills', 'service_orientation', 'I actively look for ways to help people', 'likert_5', 60, false),

-- Complex Problem Solving
('onet_skills', 'complex_problem_solving', 'I can analyze complex problems and develop solutions', 'likert_5', 61, true),

-- Technical Skills
('onet_skills', 'operations_analysis', 'I can analyze needs and requirements to create designs', 'likert_5', 62, false),
('onet_skills', 'technology_design', 'I can design or adapt equipment and technology', 'likert_5', 63, false),
('onet_skills', 'equipment_selection', 'I know how to select the right tools for a job', 'likert_5', 64, false),
('onet_skills', 'installation', 'I can install equipment, machines, or software', 'likert_5', 65, false),
('onet_skills', 'programming', 'I can write computer programs for various purposes', 'likert_5', 66, true),
('onet_skills', 'operations_monitoring', 'I can monitor gauges and indicators to ensure proper operation', 'likert_5', 67, false),
('onet_skills', 'operation_control', 'I can control equipment or systems operations', 'likert_5', 68, false),
('onet_skills', 'equipment_maintenance', 'I can perform routine maintenance on equipment', 'likert_5', 69, false),
('onet_skills', 'troubleshooting', 'I can identify causes of operating errors and fix them', 'likert_5', 70, true),
('onet_skills', 'repairing', 'I can repair machines or systems using needed tools', 'likert_5', 71, false),
('onet_skills', 'quality_control', 'I can evaluate quality of products, services, or processes', 'likert_5', 72, false),

-- Systems Skills
('onet_skills', 'judgment_decision_making', 'I can weigh costs and benefits to make good decisions', 'likert_5', 73, true),
('onet_skills', 'systems_analysis', 'I can determine how a system should work', 'likert_5', 74, false),
('onet_skills', 'systems_evaluation', 'I can identify measures of system performance', 'likert_5', 75, false),

-- Resource Management Skills
('onet_skills', 'time_management', 'I manage my time effectively to meet deadlines', 'likert_5', 76, true),
('onet_skills', 'financial_resources', 'I can manage money and prepare budgets', 'likert_5', 77, false),
('onet_skills', 'material_resources', 'I can obtain and manage physical resources', 'likert_5', 78, false),
('onet_skills', 'personnel_resources', 'I can motivate, develop, and direct people', 'likert_5', 79, true),

-- Desktop Computer Skills
('onet_skills', 'computer_skills', 'I am proficient with common computer applications', 'likert_5', 80, true),
('onet_skills', 'data_analysis', 'I can analyze and interpret data using software tools', 'likert_5', 81, true),
('onet_skills', 'digital_literacy', 'I can evaluate and use digital information effectively', 'likert_5', 82, true),
('onet_skills', 'learning_strategies', 'I select and use appropriate training methods', 'likert_5', 83, false);

-- WORK VALUES ITEMS (20 items)
-- Based on O*NET Work Importance Locator

INSERT INTO public.assessment_item_bank (framework, measures_dimension, question_text, question_type, sequence_order, is_quick_assessment) VALUES
-- Achievement
('work_values', 'achievement', 'It is important that my work lets me use my abilities', 'likert_5', 84, true),
('work_values', 'achievement', 'I want a job where I can see the results of my efforts', 'likert_5', 85, false),
('work_values', 'achievement', 'I need work that gives me a sense of accomplishment', 'likert_5', 86, true),

-- Working Conditions
('work_values', 'working_conditions', 'Job security is very important to me', 'likert_5', 87, true),
('work_values', 'working_conditions', 'I want a job with good working conditions', 'likert_5', 88, false),
('work_values', 'working_conditions', 'Regular hours and predictable schedule matter to me', 'likert_5', 89, true),
('work_values', 'working_conditions', 'Work-life balance is a priority for me', 'likert_5', 90, false),

-- Recognition
('work_values', 'recognition', 'I want advancement opportunities in my career', 'likert_5', 91, true),
('work_values', 'recognition', 'Getting recognition for my work is important', 'likert_5', 92, false),
('work_values', 'recognition', 'I want to be respected for my expertise', 'likert_5', 93, true),

-- Relationships
('work_values', 'relationships', 'I want to work with friendly, supportive coworkers', 'likert_5', 94, true),
('work_values', 'relationships', 'Having a good relationship with supervisors matters', 'likert_5', 95, false),
('work_values', 'relationships', 'I prefer collaborative team environments', 'likert_5', 96, true),

-- Support
('work_values', 'support', 'Good management and company policies are important', 'likert_5', 97, false),
('work_values', 'support', 'I want a company that supports employee development', 'likert_5', 98, true),
('work_values', 'support', 'Fair treatment from supervisors matters to me', 'likert_5', 99, false),

-- Independence
('work_values', 'independence', 'I want to make my own decisions at work', 'likert_5', 100, true),
('work_values', 'independence', 'Working independently is important to me', 'likert_5', 101, true),
('work_values', 'independence', 'I prefer jobs with creative freedom', 'likert_5', 102, false),
('work_values', 'independence', 'I want control over how I complete my tasks', 'likert_5', 103, true);

-- ============================================
-- SEED: O*NET OCCUPATIONS (Top 50 for initial release)
-- More will be loaded via API
-- ============================================

INSERT INTO public.onet_occupations (soc_code, title, description, riasec_code, riasec_scores, required_skills, education_level, median_wage, job_outlook, job_outlook_percent, bright_outlook) VALUES
('15-1252.00', 'Software Developers', 'Research, design, and develop computer and network software or specialized utility programs.', 'ICR', '{"I": 85, "C": 70, "R": 60, "A": 45, "S": 35, "E": 30}', '["Programming", "Complex Problem Solving", "Critical Thinking", "Systems Analysis", "Quality Control Analysis"]', 'Bachelors degree', 127260, 'Much faster than average', 25.0, true),
('15-1211.00', 'Computer Systems Analysts', 'Analyze science, engineering, business, and other data processing problems to develop and implement solutions.', 'ICE', '{"I": 80, "C": 75, "E": 55, "R": 40, "S": 45, "A": 35}', '["Systems Analysis", "Complex Problem Solving", "Critical Thinking", "Judgment and Decision Making"]', 'Bachelors degree', 102240, 'Faster than average', 10.0, true),
('11-1021.00', 'General and Operations Managers', 'Plan, direct, or coordinate the operations of public or private sector organizations.', 'ECS', '{"E": 85, "C": 70, "S": 65, "I": 50, "R": 35, "A": 30}', '["Management of Personnel Resources", "Coordination", "Judgment and Decision Making", "Negotiation"]', 'Bachelors degree', 98100, 'Average', 6.0, false),
('13-2011.00', 'Accountants and Auditors', 'Examine, analyze, and interpret accounting records to prepare financial statements.', 'CEI', '{"C": 90, "E": 55, "I": 60, "S": 45, "R": 25, "A": 20}', '["Mathematics", "Critical Thinking", "Active Listening", "Reading Comprehension"]', 'Bachelors degree', 78000, 'Faster than average', 6.0, false),
('29-1141.00', 'Registered Nurses', 'Assess patient health problems and needs, develop and implement nursing care plans.', 'SIC', '{"S": 90, "I": 75, "C": 60, "R": 55, "A": 35, "E": 40}', '["Active Listening", "Social Perceptiveness", "Critical Thinking", "Service Orientation"]', 'Bachelors degree', 81220, 'Faster than average', 6.0, true),
('25-2021.00', 'Elementary School Teachers', 'Teach academic and social skills to students at the elementary school level.', 'SAE', '{"S": 95, "A": 65, "E": 55, "C": 50, "I": 45, "R": 25}', '["Instructing", "Speaking", "Active Listening", "Learning Strategies", "Social Perceptiveness"]', 'Bachelors degree', 61690, 'Average', 4.0, false),
('17-2051.00', 'Civil Engineers', 'Plan, design, and oversee construction and maintenance of building structures and infrastructure.', 'RIC', '{"R": 80, "I": 85, "C": 70, "E": 50, "S": 40, "A": 45}', '["Complex Problem Solving", "Critical Thinking", "Mathematics", "Judgment and Decision Making"]', 'Bachelors degree', 88050, 'Average', 5.0, false),
('13-1161.00', 'Market Research Analysts', 'Research conditions in local, regional, national, or online markets.', 'IEC', '{"I": 80, "E": 70, "C": 65, "A": 50, "S": 55, "R": 25}', '["Critical Thinking", "Writing", "Active Listening", "Complex Problem Solving"]', 'Bachelors degree', 68230, 'Much faster than average', 19.0, true),
('27-1024.00', 'Graphic Designers', 'Design or create graphics to meet specific commercial or promotional needs.', 'AER', '{"A": 95, "E": 55, "R": 50, "I": 45, "C": 40, "S": 35}', '["Active Listening", "Complex Problem Solving", "Judgment and Decision Making", "Time Management"]', 'Bachelors degree', 57990, 'Average', 3.0, false),
('15-1299.08', 'Computer Systems Engineers/Architects', 'Design and develop solutions to complex applications problems or system issues.', 'IRC', '{"I": 90, "R": 65, "C": 75, "E": 50, "A": 40, "S": 35}', '["Complex Problem Solving", "Systems Analysis", "Critical Thinking", "Technology Design"]', 'Bachelors degree', 120520, 'Much faster than average', 25.0, true),
('19-1042.00', 'Medical Scientists', 'Conduct research dealing with the understanding of human diseases and improvement of human health.', 'IRS', '{"I": 95, "R": 55, "S": 50, "C": 60, "A": 40, "E": 35}', '["Science", "Critical Thinking", "Reading Comprehension", "Complex Problem Solving"]', 'Doctoral degree', 95310, 'Faster than average', 10.0, true),
('11-2021.00', 'Marketing Managers', 'Plan, direct, or coordinate marketing policies and programs.', 'ECA', '{"E": 90, "C": 60, "A": 65, "S": 55, "I": 50, "R": 25}', '["Judgment and Decision Making", "Management of Personnel Resources", "Coordination", "Persuasion"]', 'Bachelors degree', 140040, 'Faster than average', 10.0, true),
('21-1014.00', 'Mental Health Counselors', 'Counsel individuals and groups for mental and emotional disorders.', 'SAI', '{"S": 95, "A": 60, "I": 65, "E": 45, "C": 50, "R": 25}', '["Active Listening", "Social Perceptiveness", "Speaking", "Service Orientation"]', 'Masters degree', 49710, 'Much faster than average', 22.0, true),
('29-1171.00', 'Nurse Practitioners', 'Diagnose and treat acute, episodic, or chronic illness, independently or as part of a healthcare team.', 'SIR', '{"S": 92, "I": 80, "R": 55, "C": 60, "A": 35, "E": 45}', '["Critical Thinking", "Active Listening", "Reading Comprehension", "Judgment and Decision Making"]', 'Masters degree', 121610, 'Much faster than average', 40.0, true),
('15-1212.00', 'Information Security Analysts', 'Plan, implement, upgrade, or monitor security measures for the protection of computer networks.', 'ICR', '{"I": 85, "C": 80, "R": 60, "E": 50, "S": 40, "A": 30}', '["Critical Thinking", "Complex Problem Solving", "Reading Comprehension", "Active Listening"]', 'Bachelors degree', 112000, 'Much faster than average', 32.0, true),
('13-1111.00', 'Management Analysts', 'Conduct organizational studies and evaluations to improve operational efficiency.', 'ECI', '{"E": 80, "C": 70, "I": 75, "S": 55, "A": 40, "R": 25}', '["Critical Thinking", "Complex Problem Solving", "Active Listening", "Speaking"]', 'Bachelors degree', 93000, 'Faster than average', 10.0, true),
('11-3031.00', 'Financial Managers', 'Plan, direct, or coordinate accounting, investing, banking, insurance activities.', 'ECI', '{"E": 85, "C": 80, "I": 60, "S": 50, "A": 30, "R": 20}', '["Critical Thinking", "Active Listening", "Judgment and Decision Making", "Mathematics"]', 'Bachelors degree', 139790, 'Faster than average', 16.0, true),
('15-2031.00', 'Operations Research Analysts', 'Formulate and apply mathematical modeling to develop solutions to problems.', 'ICE', '{"I": 92, "C": 75, "E": 55, "R": 45, "S": 40, "A": 35}', '["Complex Problem Solving", "Critical Thinking", "Mathematics", "Systems Analysis"]', 'Bachelors degree', 82360, 'Much faster than average', 23.0, true),
('17-2199.00', 'Engineers, All Other', 'All engineers not listed separately.', 'RIC', '{"R": 75, "I": 85, "C": 70, "E": 50, "S": 40, "A": 40}', '["Complex Problem Solving", "Critical Thinking", "Active Listening", "Reading Comprehension"]', 'Bachelors degree', 101720, 'Faster than average', 7.0, false),
('29-1228.00', 'Physicians, All Other', 'All physicians and surgeons not listed separately.', 'ISR', '{"I": 90, "S": 85, "R": 60, "C": 65, "E": 50, "A": 35}', '["Critical Thinking", "Active Listening", "Complex Problem Solving", "Judgment and Decision Making"]', 'Doctoral degree', 229300, 'Average', 3.0, false),
('15-1232.00', 'Computer User Support Specialists', 'Provide technical assistance to computer users.', 'CRS', '{"C": 70, "R": 65, "S": 75, "I": 60, "E": 45, "A": 30}', '["Active Listening", "Speaking", "Reading Comprehension", "Complex Problem Solving"]', 'Some college', 57910, 'Faster than average', 6.0, false),
('13-2051.00', 'Financial Analysts', 'Conduct quantitative analyses of information involving investment programs.', 'CIE', '{"C": 80, "I": 85, "E": 65, "S": 45, "R": 30, "A": 30}', '["Critical Thinking", "Mathematics", "Active Listening", "Judgment and Decision Making"]', 'Bachelors degree', 96220, 'Faster than average', 9.0, true),
('11-3121.00', 'Human Resources Managers', 'Plan, direct, and coordinate human resource management activities.', 'ESC', '{"E": 85, "S": 80, "C": 70, "I": 50, "A": 35, "R": 25}', '["Management of Personnel Resources", "Speaking", "Active Listening", "Social Perceptiveness"]', 'Bachelors degree', 130000, 'Average', 5.0, false),
('27-1021.00', 'Commercial and Industrial Designers', 'Design and develop manufactured products.', 'ARI', '{"A": 90, "R": 70, "I": 65, "E": 50, "C": 45, "S": 35}', '["Complex Problem Solving", "Critical Thinking", "Operations Analysis", "Technology Design"]', 'Bachelors degree', 77030, 'Average', 3.0, false),
('41-3031.00', 'Securities and Financial Services Sales Agents', 'Buy and sell securities or commodities in investment and trading firms.', 'ECS', '{"E": 90, "C": 70, "S": 65, "I": 55, "A": 35, "R": 20}', '["Active Listening", "Speaking", "Persuasion", "Critical Thinking"]', 'Bachelors degree', 62910, 'Faster than average', 7.0, false),
('29-1123.00', 'Physical Therapists', 'Assess, plan, organize, and participate in rehabilitative programs.', 'SIR', '{"S": 90, "I": 75, "R": 65, "C": 55, "A": 40, "E": 45}', '["Active Listening", "Speaking", "Critical Thinking", "Social Perceptiveness"]', 'Doctoral degree', 97720, 'Faster than average', 15.0, true),
('25-1099.00', 'Postsecondary Teachers', 'Teach courses at the postsecondary level.', 'SIA', '{"S": 85, "I": 90, "A": 70, "E": 55, "C": 50, "R": 35}', '["Speaking", "Instructing", "Active Listening", "Reading Comprehension"]', 'Doctoral degree', 80840, 'Faster than average', 8.0, false),
('21-1012.00', 'Educational, Guidance, and Career Counselors', 'Advise and assist students and provide vocational guidance.', 'SAE', '{"S": 95, "A": 55, "E": 60, "I": 55, "C": 50, "R": 25}', '["Active Listening", "Speaking", "Social Perceptiveness", "Writing"]', 'Masters degree', 60510, 'Average', 5.0, false),
('15-1244.00', 'Network and Computer Systems Administrators', 'Install, configure, and maintain an organizations local area network and wide area network.', 'CRI', '{"C": 80, "R": 75, "I": 70, "E": 45, "S": 50, "A": 30}', '["Critical Thinking", "Complex Problem Solving", "Active Listening", "Systems Analysis"]', 'Bachelors degree', 90520, 'Average', 3.0, false),
('11-9111.00', 'Medical and Health Services Managers', 'Plan, direct, or coordinate medical and health services in hospitals or healthcare facilities.', 'ESC', '{"E": 85, "S": 75, "C": 70, "I": 55, "A": 35, "R": 30}', '["Critical Thinking", "Speaking", "Active Listening", "Coordination"]', 'Bachelors degree', 104830, 'Much faster than average', 28.0, true),
('17-2071.00', 'Electrical Engineers', 'Research, design, develop, test, or supervise the manufacturing of electrical equipment.', 'IRC', '{"I": 88, "R": 80, "C": 70, "E": 50, "S": 35, "A": 40}', '["Complex Problem Solving", "Critical Thinking", "Active Listening", "Mathematics"]', 'Bachelors degree', 103320, 'Average', 5.0, false),
('19-3031.00', 'Clinical and Counseling Psychologists', 'Diagnose and treat mental, emotional, and behavioral disorders.', 'ISA', '{"I": 85, "S": 90, "A": 60, "C": 55, "E": 45, "R": 25}', '["Active Listening", "Speaking", "Social Perceptiveness", "Reading Comprehension"]', 'Doctoral degree', 82510, 'Faster than average', 10.0, false),
('27-3031.00', 'Public Relations Specialists', 'Promote or create an intended public image for individuals, groups, or organizations.', 'EAS', '{"E": 80, "A": 75, "S": 70, "I": 50, "C": 55, "R": 25}', '["Writing", "Speaking", "Active Listening", "Social Perceptiveness"]', 'Bachelors degree', 67440, 'Faster than average', 8.0, false),
('15-1221.00', 'Computer and Information Research Scientists', 'Conduct research into fundamental computer and information science.', 'IRC', '{"I": 95, "R": 60, "C": 70, "E": 45, "A": 50, "S": 35}', '["Critical Thinking", "Complex Problem Solving", "Mathematics", "Programming"]', 'Masters degree', 136620, 'Much faster than average', 23.0, true),
('29-1051.00', 'Pharmacists', 'Dispense drugs prescribed by physicians and other health practitioners.', 'ICS', '{"I": 80, "C": 85, "S": 70, "R": 50, "E": 45, "A": 30}', '["Active Listening", "Reading Comprehension", "Critical Thinking", "Speaking"]', 'Doctoral degree', 132750, 'Slower than average', -2.0, false),
('11-2022.00', 'Sales Managers', 'Plan, direct, or coordinate the actual distribution or movement of products or services.', 'ECS', '{"E": 92, "C": 65, "S": 70, "I": 50, "A": 40, "R": 30}', '["Speaking", "Persuasion", "Active Listening", "Coordination"]', 'Bachelors degree', 130600, 'Average', 4.0, false),
('13-1199.00', 'Business Operations Specialists, All Other', 'All business operations specialists not listed separately.', 'CE', '{"C": 75, "E": 70, "I": 55, "S": 60, "A": 40, "R": 35}', '["Critical Thinking", "Active Listening", "Speaking", "Reading Comprehension"]', 'Bachelors degree', 79590, 'Faster than average', 8.0, false),
('15-1254.00', 'Web Developers', 'Develop and design web applications and sites.', 'ICR', '{"I": 75, "C": 70, "R": 65, "A": 60, "E": 45, "S": 40}', '["Programming", "Critical Thinking", "Complex Problem Solving", "Active Listening"]', 'Associates degree', 80730, 'Much faster than average', 16.0, true),
('19-2041.00', 'Environmental Scientists and Specialists', 'Conduct research to identify, control, or eliminate sources of pollutants.', 'IRC', '{"I": 90, "R": 70, "C": 65, "E": 50, "S": 55, "A": 40}', '["Critical Thinking", "Reading Comprehension", "Writing", "Complex Problem Solving"]', 'Bachelors degree', 76530, 'Faster than average', 6.0, false),
('17-2112.00', 'Industrial Engineers', 'Design, develop, test, and evaluate integrated systems for managing industrial production.', 'EIC', '{"E": 65, "I": 85, "C": 75, "R": 70, "S": 45, "A": 40}', '["Complex Problem Solving", "Critical Thinking", "Active Listening", "Systems Analysis"]', 'Bachelors degree', 96350, 'Faster than average', 10.0, false),
('19-4099.00', 'Life, Physical, and Social Science Technicians, All Other', 'All technicians in scientific fields not listed separately.', 'RIC', '{"R": 75, "I": 80, "C": 70, "E": 40, "S": 45, "A": 35}', '["Active Listening", "Critical Thinking", "Reading Comprehension", "Speaking"]', 'Associates degree', 48620, 'Faster than average', 7.0, false),
('29-1127.00', 'Speech-Language Pathologists', 'Assess and treat persons with speech, language, voice, and fluency disorders.', 'SIA', '{"S": 92, "I": 75, "A": 55, "C": 60, "E": 45, "R": 35}', '["Active Listening", "Speaking", "Reading Comprehension", "Social Perceptiveness"]', 'Masters degree', 84140, 'Much faster than average', 19.0, true),
('11-1011.00', 'Chief Executives', 'Determine and formulate policies and provide overall direction of companies.', 'ECS', '{"E": 95, "C": 70, "S": 65, "I": 55, "A": 45, "R": 30}', '["Judgment and Decision Making", "Management of Personnel Resources", "Speaking", "Critical Thinking"]', 'Bachelors degree', 189520, 'Slower than average', -3.0, false),
('13-2061.00', 'Financial Examiners', 'Enforce or ensure compliance with laws and regulations governing financial institutions.', 'CEI', '{"C": 85, "E": 70, "I": 75, "S": 50, "A": 30, "R": 25}', '["Critical Thinking", "Reading Comprehension", "Active Listening", "Speaking"]', 'Bachelors degree', 82210, 'Much faster than average', 20.0, true),
('43-6014.00', 'Secretaries and Administrative Assistants', 'Provide high-level administrative support by conducting research and preparing reports.', 'CE', '{"C": 85, "E": 50, "S": 55, "I": 40, "A": 35, "R": 30}', '["Active Listening", "Speaking", "Reading Comprehension", "Writing"]', 'High school diploma', 44080, 'Slower than average', -10.0, false),
('29-1215.00', 'Family Medicine Physicians', 'Diagnose, treat, and help prevent diseases and injuries that commonly occur.', 'ISR', '{"I": 88, "S": 90, "R": 55, "C": 60, "E": 50, "A": 35}', '["Critical Thinking", "Active Listening", "Social Perceptiveness", "Reading Comprehension"]', 'Doctoral degree', 214370, 'Average', 3.0, false),
('17-2141.00', 'Mechanical Engineers', 'Perform engineering duties in planning and designing tools, engines, machines.', 'RIC', '{"R": 82, "I": 88, "C": 70, "E": 50, "S": 40, "A": 45}', '["Complex Problem Solving", "Critical Thinking", "Active Listening", "Mathematics"]', 'Bachelors degree', 95300, 'Average', 4.0, false),
('21-1021.00', 'Child, Family, and School Social Workers', 'Provide social services and assistance to children, families, and schools.', 'SCA', '{"S": 95, "C": 55, "A": 50, "E": 50, "I": 45, "R": 25}', '["Active Listening", "Social Perceptiveness", "Speaking", "Service Orientation"]', 'Bachelors degree', 50820, 'Faster than average', 7.0, false),
('27-2012.00', 'Producers and Directors', 'Produce or direct stage, television, radio, video, or film productions.', 'EAR', '{"E": 85, "A": 90, "R": 55, "S": 60, "I": 50, "C": 45}', '["Coordination", "Speaking", "Time Management", "Active Listening"]', 'Bachelors degree', 79000, 'Faster than average', 7.0, false),
('15-2051.00', 'Data Scientists', 'Develop and implement methods to analyze and interpret complex data.', 'ICE', '{"I": 92, "C": 75, "E": 55, "R": 50, "A": 45, "S": 40}', '["Mathematics", "Programming", "Critical Thinking", "Complex Problem Solving"]', 'Bachelors degree', 108020, 'Much faster than average', 35.0, true);