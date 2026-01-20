-- ============================================================================
-- IMAGE GENERATION QUEUE
-- ============================================================================
-- Queue-based tracking for slide image generation.
-- Enables reliable, resumable processing with self-continuation.
-- ============================================================================

CREATE TABLE public.image_generation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_slides_id UUID NOT NULL REFERENCES public.lecture_slides(id) ON DELETE CASCADE,
  slide_index INTEGER NOT NULL,
  slide_title TEXT,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  
  -- Ensure unique slide per lecture
  UNIQUE(lecture_slides_id, slide_index)
);

-- Index for efficient queue polling (fetch pending items oldest first)
CREATE INDEX idx_image_queue_pending 
  ON public.image_generation_queue(status, created_at) 
  WHERE status = 'pending';

-- Index for checking completion status by lecture
CREATE INDEX idx_image_queue_by_lecture 
  ON public.image_generation_queue(lecture_slides_id, status);

-- Index for cleanup of old completed items
CREATE INDEX idx_image_queue_completed 
  ON public.image_generation_queue(processed_at) 
  WHERE status IN ('completed', 'failed', 'skipped');

-- Comments
COMMENT ON TABLE public.image_generation_queue IS 'Queue for tracking slide image generation progress. Enables reliable, resumable batch processing.';
COMMENT ON COLUMN public.image_generation_queue.status IS 'pending: waiting, processing: in progress, completed: done, failed: max retries exceeded, skipped: not needed';
COMMENT ON COLUMN public.image_generation_queue.attempts IS 'Number of generation attempts made';
COMMENT ON COLUMN public.image_generation_queue.max_attempts IS 'Maximum attempts before marking as failed';

-- Enable RLS (service role only - edge functions use service role key)
ALTER TABLE public.image_generation_queue ENABLE ROW LEVEL SECURITY;

-- Service role has full access (edge functions)
-- No user-facing policies needed as this is internal infrastructure