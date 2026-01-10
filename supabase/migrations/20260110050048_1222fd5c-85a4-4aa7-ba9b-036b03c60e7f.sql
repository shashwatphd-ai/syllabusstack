-- Drop the old constraint and add a new one with all valid types
ALTER TABLE public.recommendations DROP CONSTRAINT IF EXISTS recommendations_type_check;

-- Add new constraint that includes all types the AI might return
ALTER TABLE public.recommendations ADD CONSTRAINT recommendations_type_check 
CHECK (type IN ('course', 'certification', 'project', 'experience', 'skill', 'action', 'reading', 'networking', 'portfolio'));