-- Add AI reasoning columns to content_matches
ALTER TABLE content_matches ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;
ALTER TABLE content_matches ADD COLUMN IF NOT EXISTS ai_relevance_score DECIMAL(5,2);
ALTER TABLE content_matches ADD COLUMN IF NOT EXISTS ai_pedagogy_score DECIMAL(5,2);
ALTER TABLE content_matches ADD COLUMN IF NOT EXISTS ai_quality_score DECIMAL(5,2);
ALTER TABLE content_matches ADD COLUMN IF NOT EXISTS ai_recommendation TEXT;
ALTER TABLE content_matches ADD COLUMN IF NOT EXISTS ai_concern TEXT;

-- Store search strategies for transparency and learning
CREATE TABLE IF NOT EXISTS content_search_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_objective_id UUID REFERENCES learning_objectives(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  rationale TEXT,
  expected_video_type TEXT,
  priority INTEGER,
  videos_found INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on content_search_strategies
ALTER TABLE content_search_strategies ENABLE ROW LEVEL SECURITY;

-- Policies for content_search_strategies
CREATE POLICY "Users can view strategies for their LOs" 
ON content_search_strategies FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM learning_objectives lo 
    WHERE lo.id = content_search_strategies.learning_objective_id 
    AND lo.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert strategies for their LOs" 
ON content_search_strategies FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM learning_objectives lo 
    WHERE lo.id = learning_objective_id 
    AND lo.user_id = auth.uid()
  )
);

-- Store instructor-AI conversations
CREATE TABLE IF NOT EXISTS content_assistant_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_objective_id UUID REFERENCES learning_objectives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on content_assistant_chats
ALTER TABLE content_assistant_chats ENABLE ROW LEVEL SECURITY;

-- Policies for content_assistant_chats
CREATE POLICY "Users can view their own chats" 
ON content_assistant_chats FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own chats" 
ON content_assistant_chats FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own chats" 
ON content_assistant_chats FOR UPDATE 
USING (user_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_content_search_strategies_lo_id ON content_search_strategies(learning_objective_id);
CREATE INDEX IF NOT EXISTS idx_content_assistant_chats_lo_id ON content_assistant_chats(learning_objective_id);
CREATE INDEX IF NOT EXISTS idx_content_assistant_chats_user_id ON content_assistant_chats(user_id);