-- Migration: Add Dynamic Terms and Learned Synonyms
-- Purpose: Enable automatic synonym learning from syllabus content

-- Table to store learned synonyms (per-course and domain-wide)
CREATE TABLE IF NOT EXISTS learned_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_course_id UUID REFERENCES instructor_courses(id) ON DELETE CASCADE,
  canonical_term TEXT NOT NULL,
  synonyms TEXT[] NOT NULL DEFAULT '{}',
  domain TEXT NOT NULL DEFAULT 'general',
  confidence DECIMAL(3,2) DEFAULT 0.8,
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instructor_course_id, canonical_term)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_learned_synonyms_canonical ON learned_synonyms(canonical_term);
CREATE INDEX IF NOT EXISTS idx_learned_synonyms_course ON learned_synonyms(instructor_course_id);
CREATE INDEX IF NOT EXISTS idx_learned_synonyms_domain ON learned_synonyms(domain);

-- Table to store extracted terms from course syllabi
CREATE TABLE IF NOT EXISTS course_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_course_id UUID NOT NULL REFERENCES instructor_courses(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  domain TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instructor_course_id, term)
);

CREATE INDEX IF NOT EXISTS idx_course_terms_course ON course_terms(instructor_course_id);
CREATE INDEX IF NOT EXISTS idx_course_terms_term ON course_terms(term);

-- Add detected_domain and syllabus_text columns to instructor_courses if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'instructor_courses' AND column_name = 'detected_domain'
  ) THEN
    ALTER TABLE instructor_courses ADD COLUMN detected_domain TEXT DEFAULT 'general';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'instructor_courses' AND column_name = 'syllabus_text'
  ) THEN
    ALTER TABLE instructor_courses ADD COLUMN syllabus_text TEXT;
  END IF;
END $$;

-- Function to get synonyms for a search term (including learned ones)
CREATE OR REPLACE FUNCTION get_dynamic_synonyms(
  p_term TEXT,
  p_course_id UUID DEFAULT NULL
)
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_synonyms TEXT[] := '{}';
  v_record RECORD;
BEGIN
  IF p_course_id IS NOT NULL THEN
    FOR v_record IN
      SELECT synonyms FROM learned_synonyms
      WHERE instructor_course_id = p_course_id
        AND (canonical_term ILIKE '%' || p_term || '%'
             OR p_term ILIKE '%' || canonical_term || '%')
    LOOP
      v_synonyms := v_synonyms || v_record.synonyms;
    END LOOP;
  END IF;

  FOR v_record IN
    SELECT synonyms FROM learned_synonyms
    WHERE instructor_course_id IS NULL
      AND (canonical_term ILIKE '%' || p_term || '%'
           OR p_term ILIKE '%' || canonical_term || '%')
  LOOP
    v_synonyms := v_synonyms || v_record.synonyms;
  END LOOP;

  UPDATE learned_synonyms
  SET hit_count = hit_count + 1, updated_at = now()
  WHERE (instructor_course_id = p_course_id OR instructor_course_id IS NULL)
    AND (canonical_term ILIKE '%' || p_term || '%'
         OR p_term ILIKE '%' || canonical_term || '%');

  RETURN ARRAY(SELECT DISTINCT unnest(v_synonyms));
END;
$$;

-- Function to find similar cached searches using dynamic synonyms
CREATE OR REPLACE FUNCTION find_similar_cached_search_dynamic(
  p_keywords TEXT[],
  p_source TEXT,
  p_min_overlap DECIMAL DEFAULT 0.5,
  p_course_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  search_concept TEXT,
  results JSONB,
  similarity_score DECIMAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_expanded_keywords TEXT[];
  v_synonyms TEXT[];
BEGIN
  v_expanded_keywords := p_keywords;

  IF p_course_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT term)
    INTO v_synonyms
    FROM (
      SELECT unnest(synonyms) as term
      FROM learned_synonyms
      WHERE instructor_course_id = p_course_id
        AND canonical_term = ANY(p_keywords)
    ) s;

    IF v_synonyms IS NOT NULL THEN
      v_expanded_keywords := v_expanded_keywords || v_synonyms;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.search_concept,
    c.results,
    (
      SELECT COUNT(*)::DECIMAL / GREATEST(
        array_length(c.search_keywords, 1) + array_length(v_expanded_keywords, 1) -
        (SELECT COUNT(*) FROM unnest(c.search_keywords) k WHERE k = ANY(v_expanded_keywords)),
        1
      )
      FROM unnest(c.search_keywords) k
      WHERE k = ANY(v_expanded_keywords)
    ) as similarity_score
  FROM content_search_cache c
  WHERE c.source = p_source
    AND c.expires_at > now()
    AND c.search_keywords && v_expanded_keywords
  HAVING (
    SELECT COUNT(*)::DECIMAL / GREATEST(
      array_length(c.search_keywords, 1) + array_length(v_expanded_keywords, 1) -
      (SELECT COUNT(*) FROM unnest(c.search_keywords) k WHERE k = ANY(v_expanded_keywords)),
      1
    )
    FROM unnest(c.search_keywords) k
    WHERE k = ANY(v_expanded_keywords)
  ) >= p_min_overlap
  ORDER BY similarity_score DESC
  LIMIT 5;
END;
$$;

-- RLS policies
ALTER TABLE learned_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage learned_synonyms"
  ON learned_synonyms FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage course_terms"
  ON course_terms FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Authenticated users can read domain synonyms"
  ON learned_synonyms FOR SELECT
  USING (auth.role() = 'authenticated' AND instructor_course_id IS NULL);

COMMENT ON TABLE learned_synonyms IS 'Dynamically learned synonyms from course syllabus content';
COMMENT ON TABLE course_terms IS 'Extracted domain-specific terms from each course syllabus';