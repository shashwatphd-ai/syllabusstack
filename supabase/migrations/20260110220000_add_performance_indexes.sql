-- Performance indexes for frequently queried columns
-- These indexes address identified N+1 and slow query patterns

-- Consumption records: frequently queried by user_id + learning_objective_id together
CREATE INDEX IF NOT EXISTS idx_consumption_records_user_lo
ON consumption_records(user_id, learning_objective_id);

-- Content matches: frequently joined with LOs and filtered by status
CREATE INDEX IF NOT EXISTS idx_content_matches_lo_status
ON content_matches(learning_objective_id, status);

-- Capabilities: frequently filtered by user_id and course_id
CREATE INDEX IF NOT EXISTS idx_capabilities_user_course
ON capabilities(user_id, course_id);

-- Suggestion votes: for efficient vote lookups when loading suggestions
CREATE INDEX IF NOT EXISTS idx_suggestion_votes_user
ON suggestion_votes(user_id, suggestion_id);

-- Content suggestions: frequently filtered by learning_objective_id
CREATE INDEX IF NOT EXISTS idx_content_suggestions_lo
ON content_suggestions(learning_objective_id);

-- Recommendations: frequently filtered by user_id and dream_job_id
CREATE INDEX IF NOT EXISTS idx_recommendations_user_job
ON recommendations(user_id, dream_job_id);

-- Gap analyses: frequently filtered by dream_job_id and ordered by created_at
CREATE INDEX IF NOT EXISTS idx_gap_analyses_job_created
ON gap_analyses(dream_job_id, created_at DESC);

-- Comments for documentation
COMMENT ON INDEX idx_consumption_records_user_lo IS 'Speeds up student progress lookups in useCourseStudents';
COMMENT ON INDEX idx_content_matches_lo_status IS 'Speeds up content match filtering by LO and status';
COMMENT ON INDEX idx_capabilities_user_course IS 'Speeds up capability lookups per user and course';
COMMENT ON INDEX idx_suggestion_votes_user IS 'Speeds up vote lookups in useLOSuggestions';
