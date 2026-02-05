ALTER TABLE batch_jobs 
ADD COLUMN IF NOT EXISTS research_data JSONB;

COMMENT ON COLUMN batch_jobs.research_data IS 
  'Research context data keyed by teaching_unit_id for v3 parity';