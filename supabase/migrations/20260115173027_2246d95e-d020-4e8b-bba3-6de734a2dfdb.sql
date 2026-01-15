-- Create atomic RPC function to set primary dream job
-- This prevents race conditions when rapidly clicking between jobs
CREATE OR REPLACE FUNCTION public.set_primary_dream_job(p_user_id UUID, p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Verify the job belongs to this user
  IF NOT EXISTS (
    SELECT 1 FROM dream_jobs WHERE id = p_job_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Dream job not found or not owned by user';
  END IF;

  -- Atomic operation: set all to false, then set one to true
  UPDATE dream_jobs SET is_primary = false WHERE user_id = p_user_id;
  UPDATE dream_jobs SET is_primary = true WHERE id = p_job_id AND user_id = p_user_id
  RETURNING to_jsonb(dream_jobs.*) INTO result;
  
  RETURN result;
END;
$$;