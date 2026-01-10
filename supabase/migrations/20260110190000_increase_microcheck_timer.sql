-- Migration: Increase micro-check timer from 10 to 30 seconds
-- The 10-second default was too short for students to read and answer questions thoughtfully

-- Update the default for new micro_checks
ALTER TABLE micro_checks
ALTER COLUMN time_limit_seconds SET DEFAULT 30;

-- Update existing micro_checks that still have the 10-second default
-- Only update those that haven't been customized (still at 10 seconds)
UPDATE micro_checks
SET time_limit_seconds = 30
WHERE time_limit_seconds = 10;

-- Add a comment explaining the column
COMMENT ON COLUMN micro_checks.time_limit_seconds IS
  'Time limit in seconds for answering the micro-check question. Default is 30 seconds to allow thoughtful responses.';
