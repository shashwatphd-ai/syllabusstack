-- Migration: Add last_accessed_at to course_enrollments
-- Purpose: Track when students last accessed course content for analytics
-- Required by: useInstructorAnalytics, useGradebook, useCourseProgress
-- Source: MASTER_IMPLEMENTATION_PLAN.md Task 1.2.1

-- Step 1: Add the column
ALTER TABLE public.course_enrollments
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;

-- Step 2: Create index for "active in last 7 days" queries
-- This query pattern is used in instructor analytics dashboards
CREATE INDEX IF NOT EXISTS idx_enrollments_last_accessed
ON course_enrollments(last_accessed_at)
WHERE last_accessed_at IS NOT NULL;

-- Step 3: Create function to auto-update last_accessed_at when content is consumed
-- This function finds the enrollment through learning_objective → course_modules → instructor_courses
CREATE OR REPLACE FUNCTION update_enrollment_last_accessed()
RETURNS TRIGGER AS $$
DECLARE
  v_instructor_course_id UUID;
BEGIN
  -- Find the instructor_course_id through the learning objective chain
  SELECT cm.instructor_course_id INTO v_instructor_course_id
  FROM learning_objectives lo
  JOIN course_modules cm ON cm.id = lo.module_id
  WHERE lo.id = NEW.learning_objective_id;

  -- Update the enrollment if found
  IF v_instructor_course_id IS NOT NULL THEN
    UPDATE course_enrollments
    SET last_accessed_at = NOW()
    WHERE student_id = NEW.user_id
      AND instructor_course_id = v_instructor_course_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger on consumption_records
DROP TRIGGER IF EXISTS trg_update_enrollment_activity ON consumption_records;
CREATE TRIGGER trg_update_enrollment_activity
AFTER INSERT OR UPDATE ON consumption_records
FOR EACH ROW
WHEN (NEW.learning_objective_id IS NOT NULL)
EXECUTE FUNCTION update_enrollment_last_accessed();

-- Step 5: Backfill existing records with their most recent consumption date
-- This ensures existing data has proper last_accessed_at values
UPDATE course_enrollments ce
SET last_accessed_at = subq.max_activity
FROM (
  SELECT
    ce2.id as enrollment_id,
    MAX(COALESCE(cr.updated_at, cr.created_at)) as max_activity
  FROM course_enrollments ce2
  JOIN course_modules cm ON cm.instructor_course_id = ce2.instructor_course_id
  JOIN learning_objectives lo ON lo.module_id = cm.id
  JOIN consumption_records cr ON cr.learning_objective_id = lo.id AND cr.user_id = ce2.student_id
  GROUP BY ce2.id
) subq
WHERE ce.id = subq.enrollment_id
  AND ce.last_accessed_at IS NULL;

COMMENT ON COLUMN course_enrollments.last_accessed_at IS
'Timestamp of last content consumption activity. Auto-updated via trigger on consumption_records.';
