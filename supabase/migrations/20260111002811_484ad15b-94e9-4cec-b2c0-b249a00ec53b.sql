-- Performance indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_consumption_records_user_lo ON consumption_records(user_id, learning_objective_id);
CREATE INDEX IF NOT EXISTS idx_content_matches_lo_status ON content_matches(learning_objective_id, status);
CREATE INDEX IF NOT EXISTS idx_capabilities_user_course ON capabilities(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_learning_objectives_course ON learning_objectives(instructor_course_id);
CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(instructor_course_id);

-- Expand content source types to support multi-source content discovery
ALTER TABLE public.content DROP CONSTRAINT IF EXISTS content_source_type_check;
ALTER TABLE public.content ADD CONSTRAINT content_source_type_check
CHECK (source_type IN (
  'youtube', 'instructor_upload', 'article', 'textbook',
  'vimeo', 'archive_org', 'mit_ocw', 'khan_academy',
  'wikimedia', 'coursera', 'edx', 'other'
));