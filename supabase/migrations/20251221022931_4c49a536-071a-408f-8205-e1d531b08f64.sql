-- Add email preferences and activity tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_preferences JSONB DEFAULT '{"weekly_digest": true, "progress_updates": true, "new_recommendations": true}'::jsonb,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create index for efficient querying of inactive users
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at ON public.profiles(last_active_at);