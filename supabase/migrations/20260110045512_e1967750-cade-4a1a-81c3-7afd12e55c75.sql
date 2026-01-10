-- Migration: Fix recommendations type constraint + cleanup old types
-- This allows the AI-generated types that were being rejected

-- First, update any existing records with invalid types
UPDATE recommendations SET type = 'course' WHERE type IS NULL;
UPDATE recommendations SET type = 'project' WHERE type NOT IN ('project', 'course', 'certification', 'action', 'reading', 'skill', 'experience');

-- Add a check constraint to validate future inserts (loose constraint)
-- Only add if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recommendations_type_check'
  ) THEN
    ALTER TABLE recommendations ADD CONSTRAINT recommendations_type_check 
    CHECK (type IN ('project', 'course', 'certification', 'action', 'reading', 'skill', 'experience'));
  END IF;
END $$;

-- Update the gap_addressed column to have reasonable defaults
ALTER TABLE recommendations ALTER COLUMN gap_addressed DROP NOT NULL;