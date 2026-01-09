-- Resource Suggestion System
-- Phase 2 Task 2.2: Allow users to suggest new content for learning objectives

-- Content suggestions table
CREATE TABLE IF NOT EXISTS content_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learning_objective_id UUID NOT NULL REFERENCES learning_objectives(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  source_type TEXT DEFAULT 'youtube' CHECK (source_type IN ('youtube', 'khan_academy', 'article', 'course', 'other')),
  votes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id UUID REFERENCES auth.users(id),
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Suggestion votes table (upvote/downvote)
CREATE TABLE IF NOT EXISTS suggestion_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES content_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- One vote per user per suggestion
  CONSTRAINT suggestion_votes_unique UNIQUE (suggestion_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_suggestions_lo ON content_suggestions(learning_objective_id);
CREATE INDEX IF NOT EXISTS idx_content_suggestions_user ON content_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_suggestions_status ON content_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_content_suggestions_votes ON content_suggestions(votes DESC);
CREATE INDEX IF NOT EXISTS idx_suggestion_votes_suggestion ON suggestion_votes(suggestion_id);

-- Function to update vote count
CREATE OR REPLACE FUNCTION update_suggestion_votes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE content_suggestions
    SET votes = votes + NEW.vote,
        updated_at = now()
    WHERE id = NEW.suggestion_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE content_suggestions
    SET votes = votes - OLD.vote + NEW.vote,
        updated_at = now()
    WHERE id = NEW.suggestion_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE content_suggestions
    SET votes = votes - OLD.vote,
        updated_at = now()
    WHERE id = OLD.suggestion_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for vote count
DROP TRIGGER IF EXISTS suggestion_votes_trigger ON suggestion_votes;
CREATE TRIGGER suggestion_votes_trigger
AFTER INSERT OR UPDATE OR DELETE ON suggestion_votes
FOR EACH ROW
EXECUTE FUNCTION update_suggestion_votes();

-- Enable RLS
ALTER TABLE content_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_votes ENABLE ROW LEVEL SECURITY;

-- Policies for content_suggestions
CREATE POLICY "Anyone can view approved suggestions"
  ON content_suggestions
  FOR SELECT
  TO authenticated
  USING (status = 'approved' OR user_id = auth.uid());

CREATE POLICY "Users can view their own suggestions"
  ON content_suggestions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert suggestions"
  ON content_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending suggestions"
  ON content_suggestions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own pending suggestions"
  ON content_suggestions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

-- Policies for suggestion_votes
CREATE POLICY "Anyone can view votes"
  ON suggestion_votes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own votes"
  ON suggestion_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes"
  ON suggestion_votes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
  ON suggestion_votes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Comment for documentation
COMMENT ON TABLE content_suggestions IS 'User-suggested content for learning objectives. Part of Phase 2 community features.';
COMMENT ON TABLE suggestion_votes IS 'Upvotes/downvotes for content suggestions.';
