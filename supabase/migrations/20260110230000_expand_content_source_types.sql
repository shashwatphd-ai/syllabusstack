-- Expand content source types to support multi-source search
-- Adds new video platforms and educational content sources

-- Drop and recreate the CHECK constraint with expanded source types
ALTER TABLE public.content DROP CONSTRAINT IF EXISTS content_source_type_check;

ALTER TABLE public.content ADD CONSTRAINT content_source_type_check
CHECK (source_type IN (
  'youtube',           -- YouTube videos
  'instructor_upload', -- Direct instructor uploads
  'article',           -- Web articles
  'textbook',          -- Textbook references
  'vimeo',             -- Vimeo videos
  'archive_org',       -- Internet Archive content
  'mit_ocw',           -- MIT OpenCourseWare
  'khan_academy',      -- Khan Academy
  'wikimedia',         -- Wikimedia Commons
  'coursera',          -- Coursera courses
  'edx',               -- edX courses
  'other'              -- Other sources (generic URLs)
));

-- Also update content_suggestions table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_suggestions') THEN
    ALTER TABLE public.content_suggestions DROP CONSTRAINT IF EXISTS content_suggestions_source_type_check;
    ALTER TABLE public.content_suggestions ADD CONSTRAINT content_suggestions_source_type_check
    CHECK (source_type IN (
      'youtube', 'instructor_upload', 'article', 'textbook', 'vimeo',
      'archive_org', 'mit_ocw', 'khan_academy', 'wikimedia', 'coursera', 'edx', 'other'
    ));
  END IF;
END $$;

-- Add index on source_type for analytics queries
CREATE INDEX IF NOT EXISTS idx_content_source_type ON public.content(source_type);

-- Comment for documentation
COMMENT ON COLUMN public.content.source_type IS 'Content source platform: youtube, vimeo, archive_org, mit_ocw, khan_academy, wikimedia, coursera, edx, instructor_upload, article, textbook, other';
