
CREATE TABLE public.university_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  name TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  formatted_location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.university_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read university domains"
  ON public.university_domains
  FOR SELECT TO authenticated USING (true);
