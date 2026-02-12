ALTER TABLE public.lecture_slides
ADD COLUMN IF NOT EXISTS audio_audit_log JSONB DEFAULT NULL;

COMMENT ON COLUMN public.lecture_slides.audio_audit_log IS
  'TTS audit log: per-slide narration input vs transcript output, duration accuracy, deviations';