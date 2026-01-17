-- ============================================================================
-- MIGRATION: Create batch_jobs table for Google Batch API integration
-- ============================================================================
--
-- PURPOSE: Track batch slide generation jobs submitted to Google Batch API
--
-- WHY THIS CHANGE:
--   - Replaces complex queue-based system (process-lecture-queue)
--   - Enables 50% cost savings via Google Batch API
--   - Provides clearer progress visibility to users
--   - Eliminates "stuck" queue issues
--
-- RELATED CHANGES:
--   - New edge function: submit-batch-slides
--   - New edge function: poll-batch-status
--   - Frontend: useBatchSlides hooks
--
-- ROLLBACK: DROP TABLE public.batch_jobs CASCADE;
-- ============================================================================

-- Create batch_jobs table
CREATE TABLE IF NOT EXISTS public.batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Google Batch API identification
  -- Stores the batch ID returned by Google (e.g., "batches/abc123xyz")
  google_batch_id TEXT NOT NULL,

  -- Course association - all slides in batch belong to this course
  instructor_course_id UUID NOT NULL REFERENCES public.instructor_courses(id) ON DELETE CASCADE,

  -- Job type for future extensibility (audio batches, assessment batches, etc.)
  job_type TEXT NOT NULL DEFAULT 'slides' CHECK (job_type IN ('slides', 'audio', 'assessment')),

  -- Request counts
  total_requests INTEGER NOT NULL,           -- Total teaching units in batch

  -- Status tracking (mirrors Google Batch API states)
  -- submitted: Just sent to Google
  -- processing: Google is working on it (PENDING/RUNNING)
  -- completed: All done successfully
  -- failed: Job failed completely
  -- partial: Some succeeded, some failed
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted',
    'processing',
    'completed',
    'failed',
    'partial'
  )),

  -- Progress counters (updated during polling)
  succeeded_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  -- For file-based batches (>1000 requests), stores GCS output URI
  -- NULL for inline batches (<1000 requests)
  output_uri TEXT,

  -- Error tracking
  error_message TEXT,
  -- Array of request keys that failed, for retry capability
  failed_request_keys JSONB DEFAULT '[]'::jsonb,

  -- Maps request keys to teaching_unit_ids
  -- Format: {"slide_0": "tu-uuid-1", "slide_1": "tu-uuid-2", ...}
  -- Used to correlate batch responses back to lecture_slides records
  request_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,                  -- Set when status becomes completed/failed/partial

  -- Audit
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Find batch jobs by course (for instructor dashboard)
CREATE INDEX idx_batch_jobs_course ON public.batch_jobs(instructor_course_id);

-- Filter by status (for cleanup, monitoring)
CREATE INDEX idx_batch_jobs_status ON public.batch_jobs(status);

-- Lookup by Google's batch ID (for polling responses)
CREATE INDEX idx_batch_jobs_google_id ON public.batch_jobs(google_batch_id);

-- Find active jobs (processing) for a course
CREATE INDEX idx_batch_jobs_course_status ON public.batch_jobs(instructor_course_id, status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.batch_jobs ENABLE ROW LEVEL SECURITY;

-- Instructors can only see/manage batch jobs for their own courses
CREATE POLICY "Instructors can manage their batch jobs" ON public.batch_jobs
  FOR ALL USING (
    instructor_course_id IN (
      SELECT id FROM instructor_courses WHERE instructor_id = auth.uid()
    )
  );

-- ============================================================================
-- UPDATE TRIGGER (reuse existing function)
-- ============================================================================

CREATE TRIGGER batch_jobs_updated_at
  BEFORE UPDATE ON public.batch_jobs
  FOR EACH ROW EXECUTE FUNCTION update_lecture_slides_updated_at();

-- ============================================================================
-- MODIFY lecture_slides TABLE
-- ============================================================================

-- Add batch_job_id to link slides to their parent batch
-- This enables:
--   1. Finding all slides in a batch
--   2. Tracking which batch generated a slide
--   3. Cleanup if batch is cancelled
ALTER TABLE public.lecture_slides
  ADD COLUMN IF NOT EXISTS batch_job_id UUID REFERENCES public.batch_jobs(id) ON DELETE SET NULL;

-- Index for efficient lookups (find all slides in a batch)
CREATE INDEX IF NOT EXISTS idx_lecture_slides_batch_job ON public.lecture_slides(batch_job_id);

-- Add 'batch_pending' status to distinguish from old queue system
-- Update the check constraint to include new status
ALTER TABLE public.lecture_slides
  DROP CONSTRAINT IF EXISTS lecture_slides_status_check;

ALTER TABLE public.lecture_slides
  ADD CONSTRAINT lecture_slides_status_check
  CHECK (status IN ('pending', 'batch_pending', 'generating', 'ready', 'published', 'failed'));

-- ============================================================================
-- HELPFUL COMMENTS
-- ============================================================================

COMMENT ON TABLE public.batch_jobs IS 'Tracks Google Batch API jobs for bulk slide generation. Replaces queue-based system for 50% cost savings.';
COMMENT ON COLUMN public.batch_jobs.google_batch_id IS 'Batch ID from Google API (e.g., batches/abc123). Used for polling status.';
COMMENT ON COLUMN public.batch_jobs.request_mapping IS 'Maps batch request keys to teaching_unit_ids for correlating responses.';
COMMENT ON COLUMN public.batch_jobs.status IS 'Job status: submitted→processing→completed/failed/partial';
COMMENT ON COLUMN public.lecture_slides.batch_job_id IS 'Links to parent batch job if slide was generated via batch API.';
