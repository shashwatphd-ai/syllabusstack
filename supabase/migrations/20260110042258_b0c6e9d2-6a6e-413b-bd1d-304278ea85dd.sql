-- Add analysis_status and analysis_error columns to courses table
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS analysis_error TEXT;