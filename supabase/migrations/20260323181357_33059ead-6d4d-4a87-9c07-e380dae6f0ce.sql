
-- Phase 1: Add 14 missing columns to company_profiles for enrichment, linkage, and ranking
ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS instructor_course_id uuid REFERENCES public.instructor_courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_score numeric,
  ADD COLUMN IF NOT EXISTS match_reason text,
  ADD COLUMN IF NOT EXISTS similarity_score numeric,
  ADD COLUMN IF NOT EXISTS match_confidence text,
  ADD COLUMN IF NOT EXISTS discovery_source text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS buying_intent_signals jsonb,
  ADD COLUMN IF NOT EXISTS contact_first_name text,
  ADD COLUMN IF NOT EXISTS contact_last_name text,
  ADD COLUMN IF NOT EXISTS departmental_head_count jsonb,
  ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS organization_revenue_range text;

-- Index for fast course-based lookups
CREATE INDEX IF NOT EXISTS idx_company_profiles_course_id ON public.company_profiles(instructor_course_id);
