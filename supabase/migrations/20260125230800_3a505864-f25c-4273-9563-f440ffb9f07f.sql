-- Phase 5: Progressive Generation Engine
-- Track demand-based generation triggers

CREATE TABLE public.generation_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_course_id UUID NOT NULL REFERENCES instructor_courses(id) ON DELETE CASCADE,
  learning_objective_id UUID REFERENCES learning_objectives(id) ON DELETE CASCADE,
  teaching_unit_id UUID REFERENCES teaching_units(id) ON DELETE CASCADE,
  trigger_type VARCHAR(20) NOT NULL DEFAULT 'slides' CHECK (trigger_type IN ('slides', 'audio', 'questions')),
  enrollment_count INTEGER DEFAULT 0,
  enrollment_threshold INTEGER DEFAULT 10,
  is_triggered BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMP WITH TIME ZONE,
  batch_job_id UUID REFERENCES batch_jobs(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(teaching_unit_id, trigger_type)
);

-- Enable RLS
ALTER TABLE public.generation_triggers ENABLE ROW LEVEL SECURITY;

-- RLS policy - instructors can view their triggers
CREATE POLICY "Instructors can view their generation triggers"
  ON generation_triggers FOR SELECT
  USING (
    instructor_course_id IN (
      SELECT id FROM instructor_courses WHERE instructor_id = auth.uid()
    )
  );

CREATE POLICY "System can manage generation triggers"
  ON generation_triggers FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Update trigger
CREATE TRIGGER update_generation_triggers_updated_at
  BEFORE UPDATE ON generation_triggers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check and trigger generation based on enrollment
CREATE OR REPLACE FUNCTION public.check_generation_trigger(
  p_instructor_course_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_count INTEGER;
  v_triggered_count INTEGER := 0;
BEGIN
  -- Get enrollment count
  SELECT COUNT(*) INTO v_enrollment_count
  FROM course_enrollments
  WHERE instructor_course_id = p_instructor_course_id;
  
  -- Update all triggers for this course with new enrollment count
  UPDATE generation_triggers
  SET 
    enrollment_count = v_enrollment_count,
    is_triggered = CASE 
      WHEN NOT is_triggered AND v_enrollment_count >= enrollment_threshold THEN TRUE
      ELSE is_triggered
    END,
    triggered_at = CASE
      WHEN NOT is_triggered AND v_enrollment_count >= enrollment_threshold THEN NOW()
      ELSE triggered_at
    END
  WHERE instructor_course_id = p_instructor_course_id
    AND NOT is_triggered;
  
  GET DIAGNOSTICS v_triggered_count = ROW_COUNT;
  
  RETURN v_triggered_count;
END;
$$;

-- Function to initialize generation triggers for a course
CREATE OR REPLACE FUNCTION public.initialize_generation_triggers(
  p_instructor_course_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Create triggers for each teaching unit that doesn't have slides yet
  INSERT INTO generation_triggers (instructor_course_id, learning_objective_id, teaching_unit_id, trigger_type)
  SELECT 
    lo.instructor_course_id,
    lo.id,
    tu.id,
    'slides'
  FROM teaching_units tu
  JOIN learning_objectives lo ON lo.id = tu.learning_objective_id
  LEFT JOIN lecture_slides ls ON ls.teaching_unit_id = tu.id
  WHERE lo.instructor_course_id = p_instructor_course_id
    AND ls.id IS NULL
  ON CONFLICT (teaching_unit_id, trigger_type) DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;