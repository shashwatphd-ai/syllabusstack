-- Phase 1: Create teaching_units table for curriculum decomposition

-- Task 1.1: Create teaching_units table
CREATE TABLE public.teaching_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_objective_id UUID NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  
  -- Core teaching content
  title TEXT NOT NULL,
  description TEXT,
  what_to_teach TEXT NOT NULL,
  why_this_matters TEXT,
  how_to_teach TEXT,
  common_misconceptions TEXT[],
  
  -- Learning graph
  prerequisites TEXT[],
  enables TEXT[],
  
  -- Search optimization
  target_video_type TEXT CHECK (target_video_type IN ('explainer', 'tutorial', 'case_study', 'worked_example', 'lecture', 'demonstration')),
  target_duration_minutes INTEGER DEFAULT 10,
  search_queries TEXT[] NOT NULL DEFAULT '{}',
  required_concepts TEXT[],
  avoid_terms TEXT[],
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'searching', 'found', 'approved', 'failed')),
  videos_found_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_teaching_units_lo ON public.teaching_units(learning_objective_id);
CREATE INDEX idx_teaching_units_status ON public.teaching_units(status);

-- Enable RLS
ALTER TABLE public.teaching_units ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teaching_units
CREATE POLICY "Users can view teaching units for their LOs"
  ON public.teaching_units FOR SELECT
  USING (learning_objective_id IN (
    SELECT id FROM public.learning_objectives WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert teaching units for their LOs"
  ON public.teaching_units FOR INSERT
  WITH CHECK (learning_objective_id IN (
    SELECT id FROM public.learning_objectives WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update teaching units for their LOs"
  ON public.teaching_units FOR UPDATE
  USING (learning_objective_id IN (
    SELECT id FROM public.learning_objectives WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete teaching units for their LOs"
  ON public.teaching_units FOR DELETE
  USING (learning_objective_id IN (
    SELECT id FROM public.learning_objectives WHERE user_id = auth.uid()
  ));

-- Task 1.2: Add teaching_unit_id to content_matches
ALTER TABLE public.content_matches 
  ADD COLUMN teaching_unit_id UUID REFERENCES public.teaching_units(id) ON DELETE SET NULL;

CREATE INDEX idx_content_matches_teaching_unit ON public.content_matches(teaching_unit_id);

-- Task 1.3: Add decomposition_status to learning_objectives
ALTER TABLE public.learning_objectives
  ADD COLUMN decomposition_status TEXT DEFAULT 'not_started' 
    CHECK (decomposition_status IN ('not_started', 'in_progress', 'completed', 'failed'));

-- Trigger for updated_at on teaching_units
CREATE TRIGGER update_teaching_units_updated_at
  BEFORE UPDATE ON public.teaching_units
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();