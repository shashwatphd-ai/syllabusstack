-- Add server-side progress calculation for course enrollments
-- This ensures overall_progress is always accurate

-- Function to calculate and update enrollment progress
CREATE OR REPLACE FUNCTION update_enrollment_progress(
  p_student_id UUID,
  p_instructor_course_id UUID
)
RETURNS void AS $$
DECLARE
  total_los INTEGER;
  completed_los INTEGER;
  new_progress NUMERIC;
BEGIN
  -- Count total LOs for this course
  SELECT COUNT(*) INTO total_los
  FROM learning_objectives
  WHERE instructor_course_id = p_instructor_course_id;

  -- Count completed LOs (passed or verified state)
  -- We check consumption_records to see what the student has completed
  SELECT COUNT(DISTINCT lo.id) INTO completed_los
  FROM learning_objectives lo
  JOIN consumption_records cr ON cr.learning_objective_id = lo.id
  WHERE lo.instructor_course_id = p_instructor_course_id
    AND cr.user_id = p_student_id
    AND cr.is_verified = true;

  -- Calculate progress percentage
  IF total_los > 0 THEN
    new_progress := (completed_los::NUMERIC / total_los::NUMERIC) * 100;
  ELSE
    new_progress := 0;
  END IF;

  -- Update the enrollment record
  UPDATE course_enrollments
  SET
    overall_progress = new_progress,
    completed_at = CASE
      WHEN new_progress >= 100 AND completed_at IS NULL THEN now()
      WHEN new_progress < 100 THEN NULL
      ELSE completed_at
    END
  WHERE student_id = p_student_id
    AND instructor_course_id = p_instructor_course_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for consumption_records changes
CREATE OR REPLACE FUNCTION trigger_update_progress_on_consumption()
RETURNS TRIGGER AS $$
DECLARE
  v_instructor_course_id UUID;
BEGIN
  -- Get the instructor_course_id from the learning objective
  SELECT instructor_course_id INTO v_instructor_course_id
  FROM learning_objectives
  WHERE id = COALESCE(NEW.learning_objective_id, OLD.learning_objective_id);

  IF v_instructor_course_id IS NOT NULL THEN
    PERFORM update_enrollment_progress(
      COALESCE(NEW.user_id, OLD.user_id),
      v_instructor_course_id
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on consumption_records
DROP TRIGGER IF EXISTS update_progress_on_consumption ON consumption_records;
CREATE TRIGGER update_progress_on_consumption
AFTER INSERT OR UPDATE OF is_verified ON consumption_records
FOR EACH ROW
EXECUTE FUNCTION trigger_update_progress_on_consumption();

-- Function to recalculate all enrollment progress (for migration/fix)
CREATE OR REPLACE FUNCTION recalculate_all_enrollment_progress()
RETURNS INTEGER AS $$
DECLARE
  enrollment_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  FOR enrollment_record IN
    SELECT student_id, instructor_course_id
    FROM course_enrollments
  LOOP
    PERFORM update_enrollment_progress(
      enrollment_record.student_id,
      enrollment_record.instructor_course_id
    );
    updated_count := updated_count + 1;
  END LOOP;

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run initial recalculation for existing enrollments
SELECT recalculate_all_enrollment_progress();

-- Comments
COMMENT ON FUNCTION update_enrollment_progress IS 'Updates course_enrollments.overall_progress based on verified consumption records';
COMMENT ON FUNCTION trigger_update_progress_on_consumption IS 'Trigger to auto-update progress when consumption records change';
COMMENT ON FUNCTION recalculate_all_enrollment_progress IS 'Batch recalculates progress for all enrollments (for maintenance)';
