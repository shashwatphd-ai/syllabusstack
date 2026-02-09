-- Slide completion tracking: persists student progress for lecture slides
-- This is the slide-equivalent of consumption_records (which is video-specific)

CREATE TABLE IF NOT EXISTS slide_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lecture_slides_id UUID NOT NULL REFERENCES lecture_slides(id) ON DELETE CASCADE,
  learning_objective_id UUID REFERENCES learning_objectives(id) ON DELETE SET NULL,
  watch_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  highest_slide_viewed INTEGER NOT NULL DEFAULT 0,
  total_slides INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lecture_slides_id)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_slide_completions_user_id ON slide_completions(user_id);
-- Index for lookups by lecture
CREATE INDEX IF NOT EXISTS idx_slide_completions_lecture ON slide_completions(lecture_slides_id);
-- Index for learning objective progress aggregation
CREATE INDEX IF NOT EXISTS idx_slide_completions_lo ON slide_completions(learning_objective_id, user_id);

-- RLS: users can only see/modify their own records
ALTER TABLE slide_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own slide completions"
  ON slide_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own slide completions"
  ON slide_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own slide completions"
  ON slide_completions FOR UPDATE
  USING (auth.uid() = user_id);
