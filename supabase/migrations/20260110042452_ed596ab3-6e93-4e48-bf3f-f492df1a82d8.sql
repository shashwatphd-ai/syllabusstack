-- Migration 4 (Complete): Progress Calculation Function and Trigger

-- Function to calculate and update enrollment progress
CREATE OR REPLACE FUNCTION public.update_enrollment_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_course_id UUID;
  v_total_los INTEGER;
  v_verified_los INTEGER;
  v_progress NUMERIC;
BEGIN
  -- Get the student_id from the consumption record
  v_student_id := COALESCE(NEW.user_id, OLD.user_id);
  
  -- Get the course ID from the learning objective
  SELECT lo.instructor_course_id INTO v_course_id
  FROM learning_objectives lo
  WHERE lo.id = COALESCE(NEW.learning_objective_id, OLD.learning_objective_id);
  
  IF v_course_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Count total LOs in the course
  SELECT COUNT(*) INTO v_total_los
  FROM learning_objectives
  WHERE instructor_course_id = v_course_id;
  
  -- Count verified LOs for this student
  SELECT COUNT(DISTINCT cr.learning_objective_id) INTO v_verified_los
  FROM consumption_records cr
  JOIN learning_objectives lo ON lo.id = cr.learning_objective_id
  WHERE cr.user_id = v_student_id
    AND lo.instructor_course_id = v_course_id
    AND cr.is_verified = true;
  
  -- Calculate progress percentage
  IF v_total_los > 0 THEN
    v_progress := ROUND((v_verified_los::NUMERIC / v_total_los::NUMERIC) * 100, 1);
  ELSE
    v_progress := 0;
  END IF;
  
  -- Update the enrollment
  UPDATE course_enrollments
  SET overall_progress = v_progress,
      completed_at = CASE WHEN v_progress = 100 THEN now() ELSE NULL END
  WHERE student_id = v_student_id
    AND instructor_course_id = v_course_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for consumption record changes
DROP TRIGGER IF EXISTS trigger_update_enrollment_progress ON consumption_records;
CREATE TRIGGER trigger_update_enrollment_progress
  AFTER INSERT OR UPDATE OF is_verified ON consumption_records
  FOR EACH ROW
  EXECUTE FUNCTION update_enrollment_progress();