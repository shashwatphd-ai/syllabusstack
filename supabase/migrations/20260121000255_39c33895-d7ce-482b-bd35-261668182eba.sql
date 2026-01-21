-- Add generation_cost_usd column to batch_jobs table for cost tracking
ALTER TABLE batch_jobs ADD COLUMN IF NOT EXISTS generation_cost_usd DECIMAL(10,6);