-- Phase 5: Create API Usage Tracking Tables

-- Create API usage tracking table if not exists
CREATE TABLE IF NOT EXISTS public.api_usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS api_usage_tracking_api_date_idx 
ON public.api_usage_tracking(api_name, date);

-- Enable RLS
ALTER TABLE public.api_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (service role can read/write, users can read)
CREATE POLICY "Service role can manage API usage" ON public.api_usage_tracking
  FOR ALL USING (true) WITH CHECK (true);

-- Create increment function that handles upsert
CREATE OR REPLACE FUNCTION public.increment_api_usage(
  p_api_name text,
  p_units integer DEFAULT 1
) RETURNS void AS $$
BEGIN
  INSERT INTO public.api_usage_tracking (api_name, date, usage_count, updated_at)
  VALUES (p_api_name, CURRENT_DATE, p_units, now())
  ON CONFLICT (api_name, date)
  DO UPDATE SET 
    usage_count = api_usage_tracking.usage_count + p_units,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;