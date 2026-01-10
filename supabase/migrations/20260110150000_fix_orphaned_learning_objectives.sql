-- Migration to fix existing orphaned learning objectives
-- LOs with module_id = NULL are invisible to students through the standard query path
-- This creates default modules and assigns orphaned LOs to them

DO $$
DECLARE
  course_record RECORD;
  new_module_id UUID;
BEGIN
  -- Find all instructor_courses that have orphaned LOs (with instructor_course_id but no module_id)
  FOR course_record IN
    SELECT DISTINCT instructor_course_id
    FROM learning_objectives
    WHERE module_id IS NULL
      AND instructor_course_id IS NOT NULL
  LOOP
    -- Check if a "Syllabus Objectives" module already exists for this course
    SELECT id INTO new_module_id
    FROM modules
    WHERE instructor_course_id = course_record.instructor_course_id
      AND title = 'Syllabus Objectives'
    LIMIT 1;

    -- If no default module exists, create one
    IF new_module_id IS NULL THEN
      INSERT INTO modules (instructor_course_id, title, description, sequence_order)
      VALUES (
        course_record.instructor_course_id,
        'Syllabus Objectives',
        'Learning objectives extracted from the course syllabus',
        0
      )
      RETURNING id INTO new_module_id;

      RAISE NOTICE 'Created default module % for course %', new_module_id, course_record.instructor_course_id;
    END IF;

    -- Update all orphaned LOs for this course to use the default module
    UPDATE learning_objectives
    SET module_id = new_module_id
    WHERE instructor_course_id = course_record.instructor_course_id
      AND module_id IS NULL;

    RAISE NOTICE 'Assigned orphaned LOs to module % for course %', new_module_id, course_record.instructor_course_id;
  END LOOP;
END $$;

-- Add a comment explaining the purpose
COMMENT ON TABLE learning_objectives IS 'Learning objectives should always have a module_id to be visible to students. The extract-learning-objectives function now auto-creates a default module.';
