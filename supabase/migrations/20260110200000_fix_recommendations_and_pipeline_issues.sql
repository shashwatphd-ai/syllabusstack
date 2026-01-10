-- Migration: Fix recommendations type constraint and other pipeline issues
-- Fixes multiple issues discovered during comprehensive student pipeline review

-- ================================================================
-- ISSUE #1: Recommendations type constraint mismatch
-- AI schema allows: project, course, certification, action, reading
-- Database allowed: course, certification, project, experience, skill
-- ================================================================

-- Drop the old constraint and add a new one with all valid types
ALTER TABLE recommendations
DROP CONSTRAINT IF EXISTS recommendations_type_check;

ALTER TABLE recommendations
ADD CONSTRAINT recommendations_type_check
CHECK (type IN ('course', 'certification', 'project', 'experience', 'skill', 'action', 'reading', 'networking', 'portfolio'));

-- ================================================================
-- ISSUE #5: Data loss risk in generate-recommendations
-- Add a backup mechanism - soft delete with restore capability
-- ================================================================

-- Add a soft delete column to recommendations if it doesn't exist
ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create an index for efficient soft delete queries
CREATE INDEX IF NOT EXISTS idx_recommendations_deleted_at
ON recommendations(user_id, dream_job_id, deleted_at)
WHERE deleted_at IS NULL;

-- ================================================================
-- ISSUE #8: Hard-coded passing threshold
-- Add configurable threshold per learning objective
-- ================================================================

-- Add passing_threshold column to learning_objectives if it doesn't exist
ALTER TABLE learning_objectives
ADD COLUMN IF NOT EXISTS passing_threshold INTEGER DEFAULT 70
CHECK (passing_threshold >= 0 AND passing_threshold <= 100);

-- Add passing_threshold to instructor_courses for course-wide defaults
ALTER TABLE instructor_courses
ADD COLUMN IF NOT EXISTS default_passing_threshold INTEGER DEFAULT 70
CHECK (default_passing_threshold >= 0 AND default_passing_threshold <= 100);

-- ================================================================
-- ISSUE #2: Discovered jobs should be saved
-- Create a table to store discovered career suggestions
-- ================================================================

CREATE TABLE IF NOT EXISTS discovered_careers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  why_it_fits TEXT,
  salary_range TEXT,
  growth_outlook TEXT,
  key_skills JSONB DEFAULT '[]'::jsonb,
  day_in_life TEXT,
  company_types JSONB DEFAULT '[]'::jsonb,
  discovery_input JSONB DEFAULT '{}'::jsonb, -- Store the input that led to this discovery
  is_added_to_dream_jobs BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE discovered_careers ENABLE ROW LEVEL SECURITY;

-- RLS policies for discovered_careers
CREATE POLICY "Users can view their own discovered careers"
  ON discovered_careers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own discovered careers"
  ON discovered_careers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own discovered careers"
  ON discovered_careers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own discovered careers"
  ON discovered_careers FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_discovered_careers_user
ON discovered_careers(user_id, created_at DESC);

-- ================================================================
-- Add helpful comments
-- ================================================================

COMMENT ON COLUMN recommendations.type IS
  'Type of recommendation: course, certification, project, experience, skill, action, or reading';

COMMENT ON COLUMN learning_objectives.passing_threshold IS
  'Minimum score (0-100) required to pass assessment. Defaults to 70.';

COMMENT ON COLUMN instructor_courses.default_passing_threshold IS
  'Default passing threshold for all learning objectives in this course. Can be overridden per LO.';

COMMENT ON TABLE discovered_careers IS
  'Stores AI-discovered career suggestions so users can review them later without re-running discovery.';
