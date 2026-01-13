-- Add research and multi-agent generation fields to lecture_slides
ALTER TABLE public.lecture_slides ADD COLUMN IF NOT EXISTS 
  research_context JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.lecture_slides ADD COLUMN IF NOT EXISTS
  generation_phases JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.lecture_slides ADD COLUMN IF NOT EXISTS
  quality_score NUMERIC(5,2) DEFAULT NULL;

ALTER TABLE public.lecture_slides ADD COLUMN IF NOT EXISTS
  citation_count INTEGER DEFAULT 0;

ALTER TABLE public.lecture_slides ADD COLUMN IF NOT EXISTS
  is_research_grounded BOOLEAN DEFAULT false;

-- Add index for quality filtering
CREATE INDEX IF NOT EXISTS idx_lecture_slides_quality_score 
  ON public.lecture_slides(quality_score) 
  WHERE quality_score IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.lecture_slides.research_context IS 'Contains definitions, examples, citations gathered by research agent';
COMMENT ON COLUMN public.lecture_slides.generation_phases IS 'Tracks status and timing of each multi-agent phase';
COMMENT ON COLUMN public.lecture_slides.quality_score IS 'Overall quality score 0-100 from quality validation agent';
COMMENT ON COLUMN public.lecture_slides.citation_count IS 'Number of citations in the slide deck';
COMMENT ON COLUMN public.lecture_slides.is_research_grounded IS 'Whether slides were generated with web research';