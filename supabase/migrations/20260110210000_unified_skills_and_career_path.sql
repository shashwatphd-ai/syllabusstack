-- Migration: Unified Skills System and Career Path Integration
-- This migration creates the foundation for linking learning progress to career recommendations

-- ================================================================
-- TABLE 1: Verified Skills
-- Skills earned from completing course assessments or verifications
-- ================================================================

CREATE TABLE IF NOT EXISTS verified_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  proficiency_level TEXT CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  source_type TEXT NOT NULL CHECK (source_type IN ('course_assessment', 'micro_check', 'project', 'certification', 'manual')),
  source_id UUID, -- Reference to the assessment/course/project that verified this
  source_name TEXT, -- Human-readable source name
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  evidence_url TEXT, -- Link to proof (certificate, project, etc.)
  metadata JSONB DEFAULT '{}', -- Additional context
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, skill_name, source_type, source_id)
);

-- Enable RLS
ALTER TABLE verified_skills ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own verified skills"
  ON verified_skills FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own verified skills"
  ON verified_skills FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own verified skills"
  ON verified_skills FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own verified skills"
  ON verified_skills FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_verified_skills_user ON verified_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_verified_skills_source ON verified_skills(source_type, source_id);

-- ================================================================
-- TABLE 2: Recommendation-Course Links
-- Links recommendations to enrolled instructor courses for tracking
-- ================================================================

CREATE TABLE IF NOT EXISTS recommendation_course_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  instructor_course_id UUID REFERENCES instructor_courses(id) ON DELETE SET NULL,
  learning_objective_id UUID REFERENCES learning_objectives(id) ON DELETE SET NULL,
  external_course_url TEXT,
  link_type TEXT NOT NULL CHECK (link_type IN ('enrolled', 'suggested', 'external', 'manual')),
  link_status TEXT DEFAULT 'active' CHECK (link_status IN ('active', 'completed', 'abandoned')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(recommendation_id)
);

-- Enable RLS
ALTER TABLE recommendation_course_links ENABLE ROW LEVEL SECURITY;

-- RLS policies (join through recommendations table for user_id)
CREATE POLICY "Users can view their own recommendation links"
  ON recommendation_course_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recommendations r
      WHERE r.id = recommendation_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own recommendation links"
  ON recommendation_course_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recommendations r
      WHERE r.id = recommendation_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own recommendation links"
  ON recommendation_course_links FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM recommendations r
      WHERE r.id = recommendation_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own recommendation links"
  ON recommendation_course_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM recommendations r
      WHERE r.id = recommendation_id AND r.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rec_links_recommendation ON recommendation_course_links(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_rec_links_course ON recommendation_course_links(instructor_course_id);

-- ================================================================
-- FUNCTION: Get Unified Skill Profile
-- Aggregates skills from all sources: verified, capabilities, recommendations
-- ================================================================

CREATE OR REPLACE FUNCTION get_user_skill_profile(p_user_id UUID)
RETURNS TABLE (
  skill_name TEXT,
  proficiency_level TEXT,
  source_type TEXT,
  source_name TEXT,
  verified BOOLEAN,
  acquired_at TIMESTAMPTZ,
  evidence_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- Verified skills from course assessments (highest priority)
  SELECT
    vs.skill_name,
    vs.proficiency_level,
    vs.source_type,
    COALESCE(vs.source_name, 'Course Assessment') as source_name,
    true as verified,
    vs.verified_at as acquired_at,
    vs.evidence_url
  FROM verified_skills vs
  WHERE vs.user_id = p_user_id

  UNION ALL

  -- Self-reported skills from transcript/capabilities (lower priority)
  SELECT
    c.name as skill_name,
    c.proficiency_level,
    'self_reported'::TEXT as source_type,
    COALESCE(co.title, 'Personal Course') as source_name,
    false as verified,
    c.created_at as acquired_at,
    NULL as evidence_url
  FROM capabilities c
  LEFT JOIN courses co ON c.course_id = co.id
  WHERE c.user_id = p_user_id
  -- Exclude skills that already have verified versions
  AND NOT EXISTS (
    SELECT 1 FROM verified_skills vs
    WHERE vs.user_id = p_user_id
    AND LOWER(vs.skill_name) = LOWER(c.name)
  )

  ORDER BY verified DESC, acquired_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- FUNCTION: Link Recommendation to Course
-- Creates a link between a recommendation and an enrolled course
-- ================================================================

CREATE OR REPLACE FUNCTION link_recommendation_to_course(
  p_recommendation_id UUID,
  p_instructor_course_id UUID DEFAULT NULL,
  p_learning_objective_id UUID DEFAULT NULL,
  p_external_url TEXT DEFAULT NULL
) RETURNS recommendation_course_links AS $$
DECLARE
  v_result recommendation_course_links;
  v_link_type TEXT;
BEGIN
  -- Determine link type
  IF p_instructor_course_id IS NOT NULL THEN
    v_link_type := 'enrolled';
  ELSIF p_external_url IS NOT NULL THEN
    v_link_type := 'external';
  ELSE
    v_link_type := 'manual';
  END IF;

  INSERT INTO recommendation_course_links (
    recommendation_id,
    instructor_course_id,
    learning_objective_id,
    external_course_url,
    link_type
  ) VALUES (
    p_recommendation_id,
    p_instructor_course_id,
    p_learning_objective_id,
    p_external_url,
    v_link_type
  )
  ON CONFLICT (recommendation_id) DO UPDATE SET
    instructor_course_id = EXCLUDED.instructor_course_id,
    learning_objective_id = EXCLUDED.learning_objective_id,
    external_course_url = EXCLUDED.external_course_url,
    link_type = EXCLUDED.link_type,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- FUNCTION: Auto-complete Recommendation When Course Completed
-- Triggered when a course enrollment is marked complete
-- ================================================================

CREATE OR REPLACE FUNCTION auto_complete_linked_recommendations()
RETURNS TRIGGER AS $$
BEGIN
  -- When an enrollment is marked complete, update linked recommendations
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    -- Update the link status
    UPDATE recommendation_course_links
    SET
      link_status = 'completed',
      completed_at = NOW(),
      progress_percentage = 100,
      updated_at = NOW()
    WHERE instructor_course_id = NEW.instructor_course_id;

    -- Auto-complete the recommendation
    UPDATE recommendations r
    SET
      status = 'completed',
      updated_at = NOW()
    FROM recommendation_course_links rcl
    WHERE rcl.recommendation_id = r.id
      AND rcl.instructor_course_id = NEW.instructor_course_id
      AND rcl.link_status = 'completed'
      AND r.status != 'completed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on course_enrollments (if not exists)
DROP TRIGGER IF EXISTS trigger_auto_complete_recommendations ON course_enrollments;
CREATE TRIGGER trigger_auto_complete_recommendations
  AFTER UPDATE OF completed_at ON course_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION auto_complete_linked_recommendations();

-- ================================================================
-- FUNCTION: Add Verified Skill from Course Completion
-- Called when a learning objective is verified
-- ================================================================

CREATE OR REPLACE FUNCTION add_verified_skill_from_course(
  p_user_id UUID,
  p_skill_name TEXT,
  p_proficiency_level TEXT,
  p_course_id UUID,
  p_course_name TEXT,
  p_evidence_url TEXT DEFAULT NULL
) RETURNS verified_skills AS $$
DECLARE
  v_result verified_skills;
BEGIN
  INSERT INTO verified_skills (
    user_id,
    skill_name,
    proficiency_level,
    source_type,
    source_id,
    source_name,
    evidence_url
  ) VALUES (
    p_user_id,
    p_skill_name,
    COALESCE(p_proficiency_level, 'intermediate'),
    'course_assessment',
    p_course_id,
    p_course_name,
    p_evidence_url
  )
  ON CONFLICT (user_id, skill_name, source_type, source_id) DO UPDATE SET
    proficiency_level = EXCLUDED.proficiency_level,
    verified_at = NOW(),
    evidence_url = COALESCE(EXCLUDED.evidence_url, verified_skills.evidence_url),
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- VIEW: Unified Recommendations with Course Links
-- Provides a complete view of recommendations with their linked courses
-- ================================================================

CREATE OR REPLACE VIEW recommendations_with_links AS
SELECT
  r.*,
  rcl.instructor_course_id,
  rcl.learning_objective_id,
  rcl.external_course_url as linked_external_url,
  rcl.link_type,
  rcl.link_status,
  rcl.progress_percentage as link_progress,
  ic.title as linked_course_title,
  ic.code as linked_course_code,
  ce.overall_progress as enrollment_progress,
  ce.completed_at as enrollment_completed_at
FROM recommendations r
LEFT JOIN recommendation_course_links rcl ON r.id = rcl.recommendation_id
LEFT JOIN instructor_courses ic ON rcl.instructor_course_id = ic.id
LEFT JOIN course_enrollments ce ON (
  rcl.instructor_course_id = ce.instructor_course_id
  AND r.user_id = ce.student_id
)
WHERE r.deleted_at IS NULL;

-- ================================================================
-- INDEXES for Performance
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON recommendations(priority) WHERE deleted_at IS NULL;

-- ================================================================
-- COMMENTS
-- ================================================================

COMMENT ON TABLE verified_skills IS
  'Skills verified through course assessments, micro-checks, or certifications. These are trustworthy indicators of ability.';

COMMENT ON TABLE recommendation_course_links IS
  'Links career recommendations to actual courses the student is taking. Enables auto-completion tracking.';

COMMENT ON FUNCTION get_user_skill_profile(UUID) IS
  'Returns a unified view of all user skills from verified and self-reported sources, with verified skills taking precedence.';

COMMENT ON FUNCTION link_recommendation_to_course(UUID, UUID, UUID, TEXT) IS
  'Creates or updates a link between a recommendation and an enrolled course or external URL.';

COMMENT ON FUNCTION auto_complete_linked_recommendations() IS
  'Trigger function that automatically marks recommendations as complete when their linked course is completed.';

COMMENT ON VIEW recommendations_with_links IS
  'Combines recommendations with their linked courses and enrollment progress for a complete view.';
