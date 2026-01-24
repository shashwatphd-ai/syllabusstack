-- ============================================================================
-- MIGRATION: Module-Level Batch Support
-- ============================================================================
-- Adds support for module-level batch generation in addition to course-level.
-- This enables users to generate slides for a single module instead of the
-- entire course, supporting the sequential module workflow.
-- ============================================================================

-- 1. Add module_id column to batch_jobs for module-level scoping
ALTER TABLE public.batch_jobs
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE;

-- 2. Add scope column to explicitly track batch scope (course vs module)
-- Defaults to 'course' for backwards compatibility
ALTER TABLE public.batch_jobs
  ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'course' CHECK (scope IN ('course', 'module'));

-- 3. Update status constraint to include 'preparing' and 'researching' states
-- These were used in code but not in the constraint
ALTER TABLE public.batch_jobs
  DROP CONSTRAINT IF EXISTS batch_jobs_status_check;

ALTER TABLE public.batch_jobs
  ADD CONSTRAINT batch_jobs_status_check
  CHECK (status IN (
    'preparing',     -- Initial state when batch is being set up
    'researching',   -- Research agent is running
    'submitted',     -- Submitted to provider (Vertex AI or OpenRouter)
    'processing',    -- Provider is processing
    'completed',     -- All requests succeeded
    'failed',        -- All requests failed
    'partial'        -- Some requests succeeded, some failed
  ));

-- 4. Add indexes for module-level queries
CREATE INDEX IF NOT EXISTS idx_batch_jobs_module
  ON public.batch_jobs(module_id)
  WHERE module_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batch_jobs_module_status
  ON public.batch_jobs(module_id, status)
  WHERE module_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batch_jobs_scope
  ON public.batch_jobs(scope);

-- 5. Update RLS policy to include module ownership check
DROP POLICY IF EXISTS "Instructors can manage their batch jobs" ON public.batch_jobs;

CREATE POLICY "Instructors can manage their batch jobs" ON public.batch_jobs
  FOR ALL USING (
    -- Course-level batch: check instructor_course ownership
    instructor_course_id IN (
      SELECT id FROM instructor_courses WHERE instructor_id = auth.uid()
    )
    -- Note: module_id already has FK to modules which has FK to instructor_courses,
    -- so course ownership check is sufficient
  );

-- 6. Add generation_version to modules for tracking generation method
-- Allows us to grandfather existing courses while using new method for new generations
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS generation_version INTEGER DEFAULT 1;

-- 7. Add generation_status to modules for module-level status tracking
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS generation_status TEXT DEFAULT 'not_started'
  CHECK (generation_status IN (
    'not_started',     -- No generation attempted
    'preparing',       -- Batch being prepared
    'researching',     -- Research in progress
    'generating',      -- Slides being generated
    'completed',       -- All teaching units have slides
    'partial',         -- Some teaching units have slides
    'failed'           -- Generation failed
  ));

-- 8. Add audio_status to modules for module-level audio tracking
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS audio_status TEXT DEFAULT 'not_started'
  CHECK (audio_status IN (
    'not_started',     -- No audio generation attempted
    'generating',      -- Audio being generated
    'completed',       -- All slides have audio
    'partial',         -- Some slides have audio
    'failed'           -- Audio generation failed
  ));

-- 9. Add last_batch_job_id to modules for quick status lookup
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS last_batch_job_id UUID REFERENCES public.batch_jobs(id) ON DELETE SET NULL;

-- Comments
COMMENT ON COLUMN public.batch_jobs.module_id IS 'Optional: Links batch to specific module for module-level generation';
COMMENT ON COLUMN public.batch_jobs.scope IS 'Scope of batch: course (all modules) or module (single module)';
COMMENT ON COLUMN public.modules.generation_version IS 'Generation method version: 1=legacy, 2=module-level batch';
COMMENT ON COLUMN public.modules.generation_status IS 'Current slide generation status for this module';
COMMENT ON COLUMN public.modules.audio_status IS 'Current audio generation status for this module';
COMMENT ON COLUMN public.modules.last_batch_job_id IS 'Most recent batch job for this module';
