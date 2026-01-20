-- Add provider tracking to lecture_slides
ALTER TABLE lecture_slides ADD COLUMN IF NOT EXISTS generation_provider TEXT;
ALTER TABLE lecture_slides ADD COLUMN IF NOT EXISTS generation_cost_usd DECIMAL(10,6);

-- Add provider to batch_jobs  
ALTER TABLE batch_jobs ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'vertex_ai';

-- Create index for efficient provider queries
CREATE INDEX IF NOT EXISTS idx_lecture_slides_provider ON lecture_slides(generation_provider);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_provider ON batch_jobs(provider);