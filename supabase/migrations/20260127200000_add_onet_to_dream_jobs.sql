-- Migration: Add O*NET fields to dream_jobs
-- This allows dream jobs created from career matches to store O*NET data
-- and skip expensive AI analysis when requirements are already known

-- Add O*NET fields to dream_jobs
ALTER TABLE public.dream_jobs
ADD COLUMN IF NOT EXISTS onet_soc_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual' CHECK (source_type IN ('manual', 'career_match', 'job_posting', 'discovery')),
ADD COLUMN IF NOT EXISTS career_match_id UUID REFERENCES public.career_matches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS onet_data JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS common_misconceptions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS realistic_bar TEXT;

-- Index for O*NET lookups
CREATE INDEX IF NOT EXISTS idx_dream_jobs_onet_soc_code ON public.dream_jobs(onet_soc_code)
WHERE onet_soc_code IS NOT NULL;

-- Index for source type filtering
CREATE INDEX IF NOT EXISTS idx_dream_jobs_source_type ON public.dream_jobs(source_type);

-- Index for career match linking
CREATE INDEX IF NOT EXISTS idx_dream_jobs_career_match ON public.dream_jobs(career_match_id)
WHERE career_match_id IS NOT NULL;

-- Function to create dream job from career match with O*NET data
CREATE OR REPLACE FUNCTION create_dream_job_from_career_match(
  p_user_id UUID,
  p_career_match_id UUID,
  p_onet_soc_code VARCHAR(10),
  p_occupation_title TEXT,
  p_match_score INTEGER DEFAULT NULL
) RETURNS public.dream_jobs AS $$
DECLARE
  v_onet_data JSONB;
  v_result public.dream_jobs;
BEGIN
  -- Fetch O*NET data if available
  SELECT jsonb_build_object(
    'soc_code', o.soc_code,
    'title', o.title,
    'description', o.description,
    'riasec_code', o.riasec_code,
    'required_skills', o.required_skills,
    'required_knowledge', o.required_knowledge,
    'required_abilities', o.required_abilities,
    'education_level', o.education_level,
    'median_wage', o.median_wage,
    'job_outlook', o.job_outlook,
    'bright_outlook', o.bright_outlook
  ) INTO v_onet_data
  FROM public.onet_occupations o
  WHERE o.soc_code = p_onet_soc_code;

  -- Create the dream job
  INSERT INTO public.dream_jobs (
    user_id,
    title,
    description,
    onet_soc_code,
    source_type,
    career_match_id,
    onet_data,
    match_score,
    requirements_keywords
  ) VALUES (
    p_user_id,
    p_occupation_title,
    COALESCE(v_onet_data->>'description', 'O*NET occupation: ' || p_onet_soc_code),
    p_onet_soc_code,
    'career_match',
    p_career_match_id,
    v_onet_data,
    COALESCE(p_match_score, 0),
    COALESCE(
      (SELECT array_agg(skill->>'skill')
       FROM jsonb_array_elements(v_onet_data->'required_skills') AS skill),
      '{}'::TEXT[]
    )
  )
  RETURNING * INTO v_result;

  -- Update the career match to link to this dream job
  UPDATE public.career_matches
  SET dream_job_id = v_result.id,
      is_saved = true,
      updated_at = NOW()
  WHERE id = p_career_match_id;

  -- Auto-create job requirements from O*NET skills
  IF v_onet_data->'required_skills' IS NOT NULL THEN
    INSERT INTO public.job_requirements (dream_job_id, skill_name, importance, category)
    SELECT
      v_result.id,
      skill->>'skill',
      CASE
        WHEN (skill->>'importance')::TEXT = 'high' THEN 'required'
        WHEN (skill->>'importance')::TEXT = 'medium' THEN 'preferred'
        ELSE 'nice_to_have'
      END,
      'O*NET Skills'
    FROM jsonb_array_elements(v_onet_data->'required_skills') AS skill
    WHERE skill->>'skill' IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;

  -- Auto-create job requirements from O*NET knowledge
  IF v_onet_data->'required_knowledge' IS NOT NULL THEN
    INSERT INTO public.job_requirements (dream_job_id, skill_name, importance, category)
    SELECT
      v_result.id,
      knowledge->>'name',
      CASE
        WHEN (knowledge->>'level')::INTEGER > 70 THEN 'required'
        WHEN (knowledge->>'level')::INTEGER > 50 THEN 'preferred'
        ELSE 'nice_to_have'
      END,
      'O*NET Knowledge'
    FROM jsonb_array_elements(v_onet_data->'required_knowledge') AS knowledge
    WHERE knowledge->>'name' IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION create_dream_job_from_career_match(UUID, UUID, VARCHAR, TEXT, INTEGER) TO authenticated;

COMMENT ON COLUMN public.dream_jobs.onet_soc_code IS 'O*NET SOC code when created from career match';
COMMENT ON COLUMN public.dream_jobs.source_type IS 'How this dream job was created: manual, career_match, job_posting, or discovery';
COMMENT ON COLUMN public.dream_jobs.career_match_id IS 'Link to the career_match that created this dream job';
COMMENT ON COLUMN public.dream_jobs.onet_data IS 'Cached O*NET occupation data for quick access';
COMMENT ON FUNCTION create_dream_job_from_career_match IS 'Creates a dream job from a career match, auto-populating O*NET data and requirements';
