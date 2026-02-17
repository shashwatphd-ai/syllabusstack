CREATE OR REPLACE FUNCTION public.update_enrollment_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_id UUID;
  v_course_id UUID;
  v_total_los INTEGER;
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
  
  -- Calculate weighted progress based on verification_state
  IF v_total_los > 0 THEN
    SELECT ROUND(
      SUM(
        CASE lo.verification_state
          WHEN 'passed' THEN 1.0
          WHEN 'verified' THEN 0.5
          WHEN 'assessment_unlocked' THEN 0.5
          WHEN 'in_progress' THEN 0.25
          WHEN 'remediation_required' THEN 0.25
          ELSE 0
        END
      ) / v_total_los::NUMERIC * 100, 1
    ) INTO v_progress
    FROM learning_objectives lo
    WHERE lo.instructor_course_id = v_course_id;
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
$function$;