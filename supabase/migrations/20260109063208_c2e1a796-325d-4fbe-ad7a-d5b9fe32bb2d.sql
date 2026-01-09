-- Add unique constraint on (user_id, dream_job_id) after cleaning up duplicates

-- First, delete duplicate gap analyses, keeping only the most recent one per user/dream_job
DELETE FROM gap_analyses g1
WHERE EXISTS (
  SELECT 1 FROM gap_analyses g2 
  WHERE g2.user_id = g1.user_id 
  AND g2.dream_job_id = g1.dream_job_id 
  AND g2.created_at > g1.created_at
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE gap_analyses 
ADD CONSTRAINT gap_analyses_user_dream_job_unique 
UNIQUE (user_id, dream_job_id);