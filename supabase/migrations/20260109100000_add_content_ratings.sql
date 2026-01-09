-- Content Rating System
-- Phase 2 Task 2.1: Allow users to rate content helpfulness

-- Content ratings table
CREATE TABLE IF NOT EXISTS content_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  difficulty TEXT CHECK (difficulty IN ('too_easy', 'just_right', 'too_hard')),
  helpful BOOLEAN,
  comment TEXT,
  watch_percentage INTEGER CHECK (watch_percentage >= 0 AND watch_percentage <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- One rating per user per content
  CONSTRAINT content_ratings_unique UNIQUE (user_id, content_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_content_ratings_content ON content_ratings(content_id);
CREATE INDEX IF NOT EXISTS idx_content_ratings_user ON content_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_content_ratings_rating ON content_ratings(rating);

-- Add average rating columns to content table for fast access
ALTER TABLE content
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS difficulty_distribution JSONB DEFAULT '{"too_easy": 0, "just_right": 0, "too_hard": 0}';

-- Function to update content average rating
CREATE OR REPLACE FUNCTION update_content_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the content's rating statistics
  UPDATE content SET
    average_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM content_ratings
      WHERE content_id = COALESCE(NEW.content_id, OLD.content_id)
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM content_ratings
      WHERE content_id = COALESCE(NEW.content_id, OLD.content_id)
    ),
    difficulty_distribution = (
      SELECT jsonb_build_object(
        'too_easy', COUNT(*) FILTER (WHERE difficulty = 'too_easy'),
        'just_right', COUNT(*) FILTER (WHERE difficulty = 'just_right'),
        'too_hard', COUNT(*) FILTER (WHERE difficulty = 'too_hard')
      )
      FROM content_ratings
      WHERE content_id = COALESCE(NEW.content_id, OLD.content_id)
    )
  WHERE id = COALESCE(NEW.content_id, OLD.content_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update stats on rating changes
DROP TRIGGER IF EXISTS content_rating_stats_trigger ON content_ratings;
CREATE TRIGGER content_rating_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON content_ratings
FOR EACH ROW
EXECUTE FUNCTION update_content_rating_stats();

-- Enable RLS
ALTER TABLE content_ratings ENABLE ROW LEVEL SECURITY;

-- Users can view all ratings
CREATE POLICY "Anyone can view content ratings"
  ON content_ratings
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can only insert their own ratings
CREATE POLICY "Users can insert own ratings"
  ON content_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own ratings
CREATE POLICY "Users can update own ratings"
  ON content_ratings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own ratings
CREATE POLICY "Users can delete own ratings"
  ON content_ratings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Comment for documentation
COMMENT ON TABLE content_ratings IS 'User ratings and feedback for learning content. Part of Phase 2 engagement features.';
