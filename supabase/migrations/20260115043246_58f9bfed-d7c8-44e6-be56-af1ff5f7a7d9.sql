-- Add domain_config JSONB to instructor_courses for AI-generated research rules
ALTER TABLE public.instructor_courses ADD COLUMN IF NOT EXISTS 
  domain_config JSONB DEFAULT NULL;

COMMENT ON COLUMN public.instructor_courses.domain_config IS 
  'AI-generated research rules: trusted_sites, citation_style, avoid_sources, visual_templates';