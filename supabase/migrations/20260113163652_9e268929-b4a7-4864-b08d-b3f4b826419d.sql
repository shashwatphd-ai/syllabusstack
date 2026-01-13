-- Create lecture_slides table for storing generated lecture slides
CREATE TABLE IF NOT EXISTS public.lecture_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teaching_unit_id UUID NOT NULL REFERENCES public.teaching_units(id) ON DELETE CASCADE,
  learning_objective_id UUID NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
  instructor_course_id UUID NOT NULL REFERENCES public.instructor_courses(id) ON DELETE CASCADE,
  
  -- Slide content
  title TEXT NOT NULL,
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Each slide: { order, type, title, content[], speaker_notes, visual_suggestion, audio_url? }
  
  -- Metadata
  total_slides INTEGER NOT NULL DEFAULT 0,
  estimated_duration_minutes INTEGER,
  slide_style TEXT DEFAULT 'standard' CHECK (slide_style IN ('standard', 'minimal', 'detailed', 'interactive')),
  
  -- Generation tracking
  generation_context JSONB,
  generation_model TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'published', 'failed')),
  error_message TEXT,
  
  -- Audio fields for future TTS
  has_audio BOOLEAN DEFAULT false,
  audio_status TEXT CHECK (audio_status IS NULL OR audio_status IN ('pending', 'generating', 'ready', 'failed')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_lecture_slides_teaching_unit ON public.lecture_slides(teaching_unit_id);
CREATE INDEX idx_lecture_slides_course ON public.lecture_slides(instructor_course_id);
CREATE INDEX idx_lecture_slides_status ON public.lecture_slides(status);
CREATE INDEX idx_lecture_slides_lo ON public.lecture_slides(learning_objective_id);

-- Enable RLS
ALTER TABLE public.lecture_slides ENABLE ROW LEVEL SECURITY;

-- Instructors can manage their own slides
CREATE POLICY "Instructors can manage their slides" ON public.lecture_slides
  FOR ALL USING (
    instructor_course_id IN (
      SELECT id FROM instructor_courses WHERE instructor_id = auth.uid()
    )
  );

-- Students can view published slides from enrolled courses
CREATE POLICY "Students can view published slides" ON public.lecture_slides
  FOR SELECT USING (
    status = 'published'
    AND instructor_course_id IN (
      SELECT ce.instructor_course_id 
      FROM course_enrollments ce 
      WHERE ce.student_id = auth.uid()
    )
  );

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_lecture_slides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lecture_slides_updated_at
  BEFORE UPDATE ON public.lecture_slides
  FOR EACH ROW EXECUTE FUNCTION update_lecture_slides_updated_at();