-- Create gap_analyses table to store AI-generated gap analysis results
CREATE TABLE public.gap_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  dream_job_id UUID REFERENCES public.dream_jobs(id) ON DELETE CASCADE NOT NULL,
  analysis_text TEXT,
  strong_overlaps JSONB DEFAULT '[]'::jsonb,
  critical_gaps JSONB DEFAULT '[]'::jsonb,
  partial_overlaps JSONB DEFAULT '[]'::jsonb,
  honest_assessment TEXT,
  readiness_level TEXT,
  interview_readiness TEXT,
  job_success_prediction TEXT,
  priority_gaps JSONB DEFAULT '[]'::jsonb,
  match_score INTEGER DEFAULT 0,
  ai_model_used TEXT,
  ai_cost_usd NUMERIC(10,6),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create capability_profiles table for aggregated user capabilities
CREATE TABLE public.capability_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  combined_capability_text TEXT,
  capabilities_by_theme JSONB DEFAULT '{}'::jsonb,
  course_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ai_cache table for caching AI responses
CREATE TABLE public.ai_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  cache_type TEXT NOT NULL,
  response_data JSONB NOT NULL,
  model_used TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ai_usage table for tracking AI costs
CREATE TABLE public.ai_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  model_used TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd NUMERIC(10,6),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create anti_recommendations table
CREATE TABLE public.anti_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  dream_job_id UUID REFERENCES public.dream_jobs(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add missing columns to dream_jobs table
ALTER TABLE public.dream_jobs 
ADD COLUMN IF NOT EXISTS day_one_capabilities JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS differentiators JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS common_misconceptions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS realistic_bar TEXT;

-- Add missing columns to recommendations table
ALTER TABLE public.recommendations 
ADD COLUMN IF NOT EXISTS gap_analysis_id UUID REFERENCES public.gap_analyses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS why_this_matters TEXT,
ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS evidence_created TEXT,
ADD COLUMN IF NOT EXISTS how_to_demonstrate TEXT,
ADD COLUMN IF NOT EXISTS effort_hours INTEGER,
ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10,2) DEFAULT 0;

-- Enable RLS on new tables
ALTER TABLE public.gap_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anti_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS policies for gap_analyses
CREATE POLICY "Users can view their own gap analyses" ON public.gap_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own gap analyses" ON public.gap_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own gap analyses" ON public.gap_analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own gap analyses" ON public.gap_analyses FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for capability_profiles
CREATE POLICY "Users can view their own capability profile" ON public.capability_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own capability profile" ON public.capability_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own capability profile" ON public.capability_profiles FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for ai_cache (service role only - no user access)
CREATE POLICY "Service role can manage cache" ON public.ai_cache FOR ALL USING (true);

-- RLS policies for ai_usage
CREATE POLICY "Users can view their own AI usage" ON public.ai_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own AI usage" ON public.ai_usage FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS policies for anti_recommendations
CREATE POLICY "Users can view their own anti-recommendations" ON public.anti_recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own anti-recommendations" ON public.anti_recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own anti-recommendations" ON public.anti_recommendations FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for gap_analyses updated_at
CREATE TRIGGER update_gap_analyses_updated_at
BEFORE UPDATE ON public.gap_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster cache lookups
CREATE INDEX idx_ai_cache_key ON public.ai_cache(cache_key);
CREATE INDEX idx_ai_cache_expires ON public.ai_cache(expires_at);
CREATE INDEX idx_gap_analyses_dream_job ON public.gap_analyses(dream_job_id);
CREATE INDEX idx_gap_analyses_user ON public.gap_analyses(user_id);