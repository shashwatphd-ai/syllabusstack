-- Add preferences column to profiles table for storing user settings
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"darkMode": false, "theme": "blue", "language": "en", "dataCollection": true}'::jsonb;