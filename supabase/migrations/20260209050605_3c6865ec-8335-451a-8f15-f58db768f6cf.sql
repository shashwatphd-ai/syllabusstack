-- Create slide_completions table to track student progress through lecture slides
CREATE TABLE IF NOT EXISTS public.slide_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lecture_slides_id UUID NOT NULL REFERENCES public.lecture_slides(id) ON DELETE CASCADE,
  learning_objective_id UUID REFERENCES public.learning_objectives(id) ON DELETE SET NULL,
  watch_percentage INTEGER NOT NULL DEFAULT 0 CHECK (watch_percentage >= 0 AND watch_percentage <= 100),
  highest_slide_viewed INTEGER NOT NULL DEFAULT 0,
  total_slides INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lecture_slides_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_slide_completions_user_id ON public.slide_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_slide_completions_lecture_slides_id ON public.slide_completions(lecture_slides_id);
CREATE INDEX IF NOT EXISTS idx_slide_completions_learning_objective_id ON public.slide_completions(learning_objective_id);

-- Enable RLS
ALTER TABLE public.slide_completions ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own completions
CREATE POLICY "Users can view their own slide completions"
  ON public.slide_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own slide completions"
  ON public.slide_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own slide completions"
  ON public.slide_completions FOR UPDATE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_slide_completions_updated_at
  BEFORE UPDATE ON public.slide_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();