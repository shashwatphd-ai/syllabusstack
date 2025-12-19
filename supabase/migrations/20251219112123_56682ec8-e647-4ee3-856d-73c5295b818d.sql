-- Phase 3: Add keyword columns for semantic search
-- Alternative to vector embeddings - uses keyword arrays for similarity matching

-- Add keyword arrays to courses table
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS capability_keywords TEXT[] DEFAULT '{}';

-- Add keyword arrays to dream_jobs table  
ALTER TABLE public.dream_jobs 
ADD COLUMN IF NOT EXISTS requirements_keywords TEXT[] DEFAULT '{}';

-- Add keyword arrays to job_requirements_cache table
ALTER TABLE public.job_requirements_cache 
ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';

-- Create GIN indexes for efficient array operations
CREATE INDEX IF NOT EXISTS idx_courses_capability_keywords 
ON public.courses USING GIN(capability_keywords);

CREATE INDEX IF NOT EXISTS idx_dream_jobs_requirements_keywords 
ON public.dream_jobs USING GIN(requirements_keywords);

CREATE INDEX IF NOT EXISTS idx_job_requirements_cache_keywords 
ON public.job_requirements_cache USING GIN(keywords);

-- Create function for keyword similarity (Jaccard coefficient)
CREATE OR REPLACE FUNCTION public.keyword_similarity(arr1 TEXT[], arr2 TEXT[])
RETURNS FLOAT AS $$
DECLARE
  intersection_count INTEGER;
  union_count INTEGER;
BEGIN
  -- Handle null or empty arrays
  IF arr1 IS NULL OR arr2 IS NULL OR array_length(arr1, 1) IS NULL OR array_length(arr2, 1) IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Count intersection
  SELECT COUNT(*) INTO intersection_count 
  FROM unnest(arr1) a 
  WHERE a = ANY(arr2);
  
  -- Count union (distinct elements from both arrays)
  SELECT COUNT(DISTINCT elem) INTO union_count 
  FROM (
    SELECT unnest(arr1) AS elem 
    UNION 
    SELECT unnest(arr2)
  ) sub;
  
  -- Return Jaccard similarity
  IF union_count = 0 THEN 
    RETURN 0; 
  END IF;
  
  RETURN intersection_count::FLOAT / union_count::FLOAT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to find similar capabilities by keywords
CREATE OR REPLACE FUNCTION public.find_similar_capabilities(
  target_keywords TEXT[],
  user_uuid UUID,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  capability_id UUID,
  capability_name TEXT,
  course_title TEXT,
  similarity_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    co.title,
    public.keyword_similarity(
      target_keywords, 
      ARRAY(SELECT unnest(string_to_array(lower(c.name), ' ')) 
            WHERE length(unnest) > 2)
    ) as sim_score
  FROM public.capabilities c
  LEFT JOIN public.courses co ON c.course_id = co.id
  WHERE c.user_id = user_uuid
  ORDER BY sim_score DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;