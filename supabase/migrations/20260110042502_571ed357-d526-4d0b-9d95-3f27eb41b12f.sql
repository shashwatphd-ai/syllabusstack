-- Migration 5: Increase Micro-Check Timer to 30 seconds

-- Update default for new micro-checks
ALTER TABLE public.micro_checks 
ALTER COLUMN time_limit_seconds SET DEFAULT 30;

-- Update existing micro-checks that have the old 10-second limit
UPDATE public.micro_checks
SET time_limit_seconds = 30
WHERE time_limit_seconds = 10;