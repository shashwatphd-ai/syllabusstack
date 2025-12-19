-- Fix security warnings: Set search_path for functions

-- Fix keyword_similarity function
CREATE OR REPLACE FUNCTION public.keyword_similarity(arr1 TEXT[], arr2 TEXT[])
RETURNS FLOAT AS $$
DECLARE
  intersection_count INTEGER;
  union_count INTEGER;
BEGIN
  IF arr1 IS NULL OR arr2 IS NULL OR array_length(arr1, 1) IS NULL OR array_length(arr2, 1) IS NULL THEN
    RETURN 0;
  END IF;
  
  SELECT COUNT(*) INTO intersection_count 
  FROM unnest(arr1) a 
  WHERE a = ANY(arr2);
  
  SELECT COUNT(DISTINCT elem) INTO union_count 
  FROM (
    SELECT unnest(arr1) AS elem 
    UNION 
    SELECT unnest(arr2)
  ) sub;
  
  IF union_count = 0 THEN 
    RETURN 0; 
  END IF;
  
  RETURN intersection_count::FLOAT / union_count::FLOAT;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Fix find_similar_capabilities function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;