-- Migration: Algorithm Data Collection Infrastructure
-- Purpose: Enable data collection for patentable algorithm upgrades
-- Date: 2026-01-31

-- ============================================================================
-- 1. ENHANCED SKILL VERIFICATION TRACKING
-- ============================================================================

-- Add columns for richer skill tracking
ALTER TABLE verified_skills ADD COLUMN IF NOT EXISTS
  verification_method TEXT DEFAULT 'assessment';

ALTER TABLE verified_skills ADD COLUMN IF NOT EXISTS
  initial_proficiency_score DECIMAL(5,4);

ALTER TABLE verified_skills ADD COLUMN IF NOT EXISTS
  last_retest_at TIMESTAMPTZ;

ALTER TABLE verified_skills ADD COLUMN IF NOT EXISTS
  retest_count INTEGER DEFAULT 0;

COMMENT ON COLUMN verified_skills.verification_method IS 'How skill was verified: assessment, certification, third_party, self_reported';
COMMENT ON COLUMN verified_skills.initial_proficiency_score IS 'Original 0-1 score before any decay';
COMMENT ON COLUMN verified_skills.last_retest_at IS 'Last time this skill was retested';
COMMENT ON COLUMN verified_skills.retest_count IS 'Number of times skill has been retested';

-- ============================================================================
-- 2. ASSESSMENT RESPONSE LOGGING (for IRT calibration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  question_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,

  -- Response data
  is_correct BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  confidence_level INTEGER CHECK (confidence_level IS NULL OR (confidence_level BETWEEN 1 AND 5)),

  -- Question parameters (for IRT)
  bloom_level TEXT,
  estimated_difficulty DECIMAL(4,3),

  -- Timestamps
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_responses_question ON assessment_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_skill ON assessment_responses(skill_name);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_user ON assessment_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_session ON assessment_responses(session_id);

COMMENT ON TABLE assessment_responses IS 'Logs individual question responses for IRT parameter calibration';

-- ============================================================================
-- 3. PLACEMENT OUTCOME TRACKING (for embedding training)
-- ============================================================================

CREATE TABLE IF NOT EXISTS placement_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dream_job_id UUID REFERENCES dream_jobs(id) ON DELETE SET NULL,

  -- Outcome data
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('hired', 'interview', 'rejected', 'withdrew', 'offer_declined')),
  job_title TEXT,
  company_name TEXT,

  -- Skills snapshot at time of outcome
  skills_snapshot JSONB NOT NULL DEFAULT '[]',
  verified_skills_count INTEGER DEFAULT 0,

  -- Timing
  application_date DATE,
  outcome_date DATE,

  -- Success metrics
  is_successful BOOLEAN,
  salary_band TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_placement_outcomes_user ON placement_outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_placement_outcomes_job ON placement_outcomes(dream_job_id);
CREATE INDEX IF NOT EXISTS idx_placement_outcomes_success ON placement_outcomes(is_successful);
CREATE INDEX IF NOT EXISTS idx_placement_outcomes_type ON placement_outcomes(outcome_type);

COMMENT ON TABLE placement_outcomes IS 'Tracks job application outcomes for embedding training';

-- ============================================================================
-- 4. SKILL RELATIONSHIP GRAPH (for GNN)
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_skill TEXT NOT NULL,
  target_skill TEXT NOT NULL,

  -- Relationship data
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'prerequisite', 'corequisite', 'transfers_to', 'specialization_of', 'related_to'
  )),
  transfer_coefficient DECIMAL(4,3) CHECK (transfer_coefficient BETWEEN 0 AND 1),

  -- Evidence tracking
  evidence_source TEXT CHECK (evidence_source IN (
    'course_catalog', 'job_postings', 'student_sequences', 'manual', 'ai_inferred'
  )),
  evidence_count INTEGER DEFAULT 1,
  confidence DECIMAL(4,3),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_skill, target_skill, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_skill_relationships_source ON skill_relationships(source_skill);
CREATE INDEX IF NOT EXISTS idx_skill_relationships_target ON skill_relationships(target_skill);
CREATE INDEX IF NOT EXISTS idx_skill_relationships_type ON skill_relationships(relationship_type);

COMMENT ON TABLE skill_relationships IS 'Directed graph of skill relationships with transfer coefficients';

-- ============================================================================
-- 5. IRT QUESTION PARAMETERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS question_irt_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL,
  skill_name TEXT NOT NULL,

  -- IRT 2PL parameters
  difficulty_b DECIMAL(5,3) DEFAULT 0 CHECK (difficulty_b BETWEEN -4 AND 4),
  discrimination_a DECIMAL(5,3) DEFAULT 1 CHECK (discrimination_a BETWEEN 0.1 AND 3),

  -- Calibration metadata
  response_count INTEGER DEFAULT 0,
  last_calibrated_at TIMESTAMPTZ,
  calibration_se DECIMAL(5,4),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(question_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_question_irt_skill ON question_irt_parameters(skill_name);
CREATE INDEX IF NOT EXISTS idx_question_irt_difficulty ON question_irt_parameters(difficulty_b);

COMMENT ON TABLE question_irt_parameters IS 'IRT 2PL parameters for adaptive assessment';
COMMENT ON COLUMN question_irt_parameters.difficulty_b IS 'Difficulty parameter on theta scale (-4 to +4)';
COMMENT ON COLUMN question_irt_parameters.discrimination_a IS 'Discrimination parameter (0.1 to 3.0)';

-- ============================================================================
-- 6. SKILL DECAY PARAMETERS BY CATEGORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_decay_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_category TEXT UNIQUE NOT NULL,

  -- Weibull parameters
  lambda_scale DECIMAL(8,2) NOT NULL CHECK (lambda_scale > 0),
  k_shape DECIMAL(4,3) NOT NULL CHECK (k_shape > 0),

  -- Verification method adjustments
  certification_bonus DECIMAL(4,3) DEFAULT 1.4 CHECK (certification_bonus >= 1),
  self_reported_penalty DECIMAL(4,3) DEFAULT 0.7 CHECK (self_reported_penalty <= 1),

  -- Calibration metadata
  sample_size INTEGER DEFAULT 0,
  last_calibrated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE skill_decay_parameters IS 'Weibull decay parameters by skill category';
COMMENT ON COLUMN skill_decay_parameters.lambda_scale IS 'Characteristic lifetime in days';
COMMENT ON COLUMN skill_decay_parameters.k_shape IS 'Shape parameter: <1=decelerating, 1=constant, >1=accelerating';

-- Insert default decay parameters based on skill decay research
INSERT INTO skill_decay_parameters (skill_category, lambda_scale, k_shape, certification_bonus, self_reported_penalty) VALUES
  ('programming_frameworks', 365, 1.5, 1.4, 0.7),
  ('programming_languages', 730, 1.2, 1.4, 0.7),
  ('cloud_platforms', 548, 1.5, 1.4, 0.7),
  ('data_science', 548, 1.3, 1.4, 0.7),
  ('core_cs_concepts', 1825, 0.8, 1.4, 0.7),
  ('mathematics', 2190, 0.8, 1.4, 0.7),
  ('soft_skills', 3650, 0.6, 1.2, 0.8),
  ('certifications', 1095, 2.0, 1.0, 1.0),
  ('default', 730, 1.0, 1.4, 0.7)
ON CONFLICT (skill_category) DO NOTHING;

-- ============================================================================
-- 7. COURSE PREREQUISITES (for GNN training)
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  prerequisite_course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  -- Relationship strength
  requirement_type TEXT NOT NULL DEFAULT 'recommended' CHECK (
    requirement_type IN ('required', 'recommended', 'helpful')
  ),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(course_id, prerequisite_course_id),
  CHECK (course_id != prerequisite_course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_prereqs_course ON course_prerequisites(course_id);
CREATE INDEX IF NOT EXISTS idx_course_prereqs_prereq ON course_prerequisites(prerequisite_course_id);

COMMENT ON TABLE course_prerequisites IS 'Course prerequisite relationships for GNN training';

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_irt_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_decay_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_prerequisites ENABLE ROW LEVEL SECURITY;

-- Assessment responses: users can see and insert their own
DROP POLICY IF EXISTS "Users can view own assessment responses" ON assessment_responses;
CREATE POLICY "Users can view own assessment responses" ON assessment_responses
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own assessment responses" ON assessment_responses;
CREATE POLICY "Users can insert own assessment responses" ON assessment_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Placement outcomes: users can manage their own
DROP POLICY IF EXISTS "Users can view own placement outcomes" ON placement_outcomes;
CREATE POLICY "Users can view own placement outcomes" ON placement_outcomes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own placement outcomes" ON placement_outcomes;
CREATE POLICY "Users can manage own placement outcomes" ON placement_outcomes
  FOR ALL USING (auth.uid() = user_id);

-- Skill relationships: public read
DROP POLICY IF EXISTS "Anyone can read skill relationships" ON skill_relationships;
CREATE POLICY "Anyone can read skill relationships" ON skill_relationships
  FOR SELECT USING (true);

-- Question IRT parameters: public read
DROP POLICY IF EXISTS "Anyone can read question parameters" ON question_irt_parameters;
CREATE POLICY "Anyone can read question parameters" ON question_irt_parameters
  FOR SELECT USING (true);

-- Decay parameters: public read
DROP POLICY IF EXISTS "Anyone can read decay parameters" ON skill_decay_parameters;
CREATE POLICY "Anyone can read decay parameters" ON skill_decay_parameters
  FOR SELECT USING (true);

-- Course prerequisites: public read
DROP POLICY IF EXISTS "Anyone can read course prerequisites" ON course_prerequisites;
CREATE POLICY "Anyone can read course prerequisites" ON course_prerequisites
  FOR SELECT USING (true);

-- ============================================================================
-- 9. FUNCTIONS FOR DATA COLLECTION
-- ============================================================================

-- Function to record assessment response
CREATE OR REPLACE FUNCTION record_assessment_response(
  p_session_id UUID,
  p_question_id UUID,
  p_skill_name TEXT,
  p_is_correct BOOLEAN,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_bloom_level TEXT DEFAULT NULL,
  p_estimated_difficulty DECIMAL DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_response_id UUID;
BEGIN
  INSERT INTO assessment_responses (
    session_id,
    question_id,
    user_id,
    skill_name,
    is_correct,
    response_time_ms,
    bloom_level,
    estimated_difficulty
  ) VALUES (
    p_session_id,
    p_question_id,
    auth.uid(),
    p_skill_name,
    p_is_correct,
    p_response_time_ms,
    p_bloom_level,
    p_estimated_difficulty
  ) RETURNING id INTO v_response_id;

  RETURN v_response_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get skill decay parameters
CREATE OR REPLACE FUNCTION get_skill_decay_params(p_skill_name TEXT)
RETURNS TABLE (
  lambda_scale DECIMAL,
  k_shape DECIMAL,
  certification_bonus DECIMAL,
  self_reported_penalty DECIMAL
) AS $$
DECLARE
  v_category TEXT;
BEGIN
  -- Classify skill into category
  v_category := CASE
    WHEN p_skill_name ~* 'react|angular|vue|next|express|django|flask|spring|rails|laravel|tensorflow|pytorch|keras' THEN 'programming_frameworks'
    WHEN p_skill_name ~* 'python|javascript|typescript|java|c\+\+|c#|go|rust|ruby|php|swift|kotlin' THEN 'programming_languages'
    WHEN p_skill_name ~* 'aws|azure|gcp|docker|kubernetes|terraform|ansible|jenkins' THEN 'cloud_platforms'
    WHEN p_skill_name ~* 'machine learning|data analysis|statistics|data visualization|pandas|numpy|scikit|sql|tableau|power bi' THEN 'data_science'
    WHEN p_skill_name ~* 'algorithm|data structure|system design|object-oriented|functional programming|design pattern|database' THEN 'core_cs_concepts'
    WHEN p_skill_name ~* 'linear algebra|calculus|probability|discrete math|optimization' THEN 'mathematics'
    WHEN p_skill_name ~* 'leadership|communication|project management|teamwork|problem solving|critical thinking' THEN 'soft_skills'
    WHEN p_skill_name ~* 'certified|certification|pmp|scrum master|cissp' THEN 'certifications'
    ELSE 'default'
  END;

  RETURN QUERY
  SELECT
    sdp.lambda_scale,
    sdp.k_shape,
    sdp.certification_bonus,
    sdp.self_reported_penalty
  FROM skill_decay_parameters sdp
  WHERE sdp.skill_category = v_category;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to calculate decayed proficiency
CREATE OR REPLACE FUNCTION calculate_decayed_proficiency(
  p_base_proficiency DECIMAL,
  p_verified_at TIMESTAMPTZ,
  p_source_type TEXT,
  p_skill_name TEXT,
  p_reference_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS DECIMAL AS $$
DECLARE
  v_days_since INTEGER;
  v_lambda DECIMAL;
  v_k DECIMAL;
  v_cert_bonus DECIMAL;
  v_self_penalty DECIMAL;
  v_adjusted_lambda DECIMAL;
  v_survival DECIMAL;
BEGIN
  -- Get days since verification
  v_days_since := EXTRACT(DAY FROM (p_reference_date - p_verified_at));

  IF v_days_since <= 0 THEN
    RETURN p_base_proficiency;
  END IF;

  -- Get decay parameters
  SELECT lambda_scale, k_shape, certification_bonus, self_reported_penalty
  INTO v_lambda, v_k, v_cert_bonus, v_self_penalty
  FROM get_skill_decay_params(p_skill_name);

  -- Adjust lambda based on source type
  v_adjusted_lambda := v_lambda;
  IF p_source_type IN ('certification', 'third_party_verification') THEN
    v_adjusted_lambda := v_lambda * v_cert_bonus;
  ELSIF p_source_type = 'self_reported' THEN
    v_adjusted_lambda := v_lambda * v_self_penalty;
  END IF;

  -- Weibull survival: S(t) = exp(-(t/λ)^k)
  v_survival := EXP(-POWER(v_days_since::DECIMAL / v_adjusted_lambda, v_k));

  RETURN p_base_proficiency * v_survival;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 10. TRIGGER TO UPDATE TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to new tables
DROP TRIGGER IF EXISTS update_placement_outcomes_updated_at ON placement_outcomes;
CREATE TRIGGER update_placement_outcomes_updated_at
  BEFORE UPDATE ON placement_outcomes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_skill_relationships_updated_at ON skill_relationships;
CREATE TRIGGER update_skill_relationships_updated_at
  BEFORE UPDATE ON skill_relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_question_irt_parameters_updated_at ON question_irt_parameters;
CREATE TRIGGER update_question_irt_parameters_updated_at
  BEFORE UPDATE ON question_irt_parameters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_skill_decay_parameters_updated_at ON skill_decay_parameters;
CREATE TRIGGER update_skill_decay_parameters_updated_at
  BEFORE UPDATE ON skill_decay_parameters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
