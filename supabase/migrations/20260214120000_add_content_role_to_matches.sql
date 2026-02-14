-- Add content_role column to content_matches table
-- Tracks what role a video plays in the learning experience:
-- core_explainer, curiosity_spark, real_world_case,
-- practitioner_perspective, debate_or_analysis, adjacent_insight
ALTER TABLE content_matches ADD COLUMN IF NOT EXISTS content_role TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN content_matches.content_role IS 'The pedagogical role this content plays: core_explainer, curiosity_spark, real_world_case, practitioner_perspective, debate_or_analysis, adjacent_insight';
