-- ============================================================================
-- MIGRATION: Create batch_jobs table for Google Batch API integration
-- ============================================================================

-- Create batch_jobs table
CREATE TABLE IF NOT EXISTS public.batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_batch_id TEXT NOT NULL,
  instructor_course_id UUID NOT NULL REFERENCES public.instructor_courses(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'slides' CHECK (job_type IN ('slides', 'audio', 'assessment')),
  total_requests INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted',
    'processing',
    'completed',
    'failed',
    'partial'
  )),
  succeeded_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  output_uri TEXT,
  error_message TEXT,
  failed_request_keys JSONB DEFAULT '[]'::jsonb,
  request_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_batch_jobs_course ON public.batch_jobs(instructor_course_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON public.batch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_google_id ON public.batch_jobs(google_batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_course_status ON public.batch_jobs(instructor_course_id, status);

-- ROW LEVEL SECURITY
ALTER TABLE public.batch_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can manage their batch jobs" ON public.batch_jobs
  FOR ALL USING (
    instructor_course_id IN (
      SELECT id FROM instructor_courses WHERE instructor_id = auth.uid()
    )
  );

-- UPDATE TRIGGER
CREATE TRIGGER batch_jobs_updated_at
  BEFORE UPDATE ON public.batch_jobs
  FOR EACH ROW EXECUTE FUNCTION update_lecture_slides_updated_at();

-- MODIFY lecture_slides TABLE
ALTER TABLE public.lecture_slides
  ADD COLUMN IF NOT EXISTS batch_job_id UUID REFERENCES public.batch_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lecture_slides_batch_job ON public.lecture_slides(batch_job_id);

-- Add 'batch_pending' status
ALTER TABLE public.lecture_slides
  DROP CONSTRAINT IF EXISTS lecture_slides_status_check;

ALTER TABLE public.lecture_slides
  ADD CONSTRAINT lecture_slides_status_check
  CHECK (status IN ('pending', 'batch_pending', 'generating', 'ready', 'published', 'failed'));

-- Comments
COMMENT ON TABLE public.batch_jobs IS 'Tracks Google Batch API jobs for bulk slide generation.';
COMMENT ON COLUMN public.batch_jobs.google_batch_id IS 'Batch ID from Google API for polling.';
COMMENT ON COLUMN public.batch_jobs.request_mapping IS 'Maps batch request keys to teaching_unit_ids.';
COMMENT ON COLUMN public.lecture_slides.batch_job_id IS 'Links to parent batch job if generated via batch API.';