-- Add analysis_status field to courses table for tracking AI analysis state
-- This replaces the indirect method of checking capabilities table for analysis status

-- Add the analysis_status column with enum-like constraint
ALTER TABLE courses
ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT 'pending'
CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed'));

-- Add analysis_error column to store error messages when analysis fails
ALTER TABLE courses
ADD COLUMN IF NOT EXISTS analysis_error TEXT;

-- Create index for efficient filtering by status
CREATE INDEX IF NOT EXISTS idx_courses_analysis_status ON courses(analysis_status);

-- Update existing courses: set to 'completed' if they have capability_text (meaning they were analyzed)
UPDATE courses
SET analysis_status = 'completed'
WHERE capability_text IS NOT NULL AND capability_text != '';

-- Comment for documentation
COMMENT ON COLUMN courses.analysis_status IS 'Status of AI syllabus analysis: pending, analyzing, completed, or failed';
COMMENT ON COLUMN courses.analysis_error IS 'Error message if analysis_status is failed';
