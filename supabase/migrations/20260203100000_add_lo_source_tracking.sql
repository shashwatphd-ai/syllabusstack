-- Add source tracking columns to learning_objectives for transparency
-- This enables distinguishing between explicit and inferred LOs

-- Add source_type column
ALTER TABLE learning_objectives
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'explicit'
CHECK (source_type IN ('explicit', 'inferred_from_topics', 'inferred_from_assignments', 'inferred_from_readings'));

COMMENT ON COLUMN learning_objectives.source_type IS 'How this LO was extracted: explicit (stated in syllabus) or inferred from course content';

-- Add source_text column to show what syllabus text the LO was derived from
ALTER TABLE learning_objectives
ADD COLUMN IF NOT EXISTS source_text TEXT;

COMMENT ON COLUMN learning_objectives.source_text IS 'The exact syllabus text this learning objective was extracted or inferred from';

-- Add confidence column
ALTER TABLE learning_objectives
ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'high'
CHECK (confidence IN ('high', 'medium', 'low'));

COMMENT ON COLUMN learning_objectives.confidence IS 'Confidence level of extraction: high for explicit, medium for topic/assignment inference, low for reading inference';

-- Add approval_status for instructor review workflow
ALTER TABLE learning_objectives
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved'
CHECK (approval_status IN ('approved', 'pending_review', 'rejected'));

COMMENT ON COLUMN learning_objectives.approval_status IS 'Instructor approval status: explicit LOs are auto-approved, inferred need review';

-- Create index for filtering by approval status (instructors reviewing inferred LOs)
CREATE INDEX IF NOT EXISTS idx_learning_objectives_approval_status
ON learning_objectives(instructor_course_id, approval_status)
WHERE approval_status = 'pending_review';

-- Create index for filtering by source type
CREATE INDEX IF NOT EXISTS idx_learning_objectives_source_type
ON learning_objectives(instructor_course_id, source_type);
