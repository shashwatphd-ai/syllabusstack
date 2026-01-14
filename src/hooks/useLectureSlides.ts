import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';

// Legacy slide format (v1)
export interface Slide {
  order: number;
  type: 'title' | 'objectives' | 'prerequisites' | 'concept' | 'example' | 
        'worked_problem' | 'misconception' | 'summary' | 'discussion' | 'assessment';
  title: string;
  content: string[];
  speaker_notes: string;
  visual_suggestion: string;
  audio_url?: string;
  audio_duration_seconds?: number;
}

// Enhanced slide format (v2) - research-grounded with citations
export interface EnhancedSlide {
  order: number;
  type: 'title' | 'definition' | 'explanation' | 'example' | 'process' | 
        'diagram' | 'misconception' | 'case_study' | 'summary' | 'assessment';
  title: string;
  content: {
    main_text: string;
    bullets?: string[];
    definition?: {
      term: string;
      meaning: string;
      source: string;
    };
    steps?: {
      step: number;
      title: string;
      explanation: string;
    }[];
    example?: {
      scenario: string;
      explanation: string;
      source?: string;
    };
  };
  visual: {
    type: 'diagram' | 'image' | 'chart' | 'none';
    url?: string;
    alt_text: string;
    source?: string;
    fallback_description: string;
  };
  speaker_notes: string;
  speaker_notes_duration_seconds?: number;
  citations?: {
    claim: string;
    source: string;
    url?: string;
  }[];
  quality_score?: number;
}

// Professor AI slide format (v3) - comprehensive pedagogical structure
export interface ProfessorSlide {
  order: number;
  type: 'title' | 'hook' | 'recap' | 'definition' | 'explanation' | 
        'example' | 'demonstration' | 'misconception' | 'practice' | 
        'synthesis' | 'preview' | 'process' | 'summary';
  title: string;
  content: {
    main_text: string;
    key_points?: string[];
    definition?: {
      term: string;
      formal_definition: string;
      simple_explanation: string;
    };
    example?: {
      scenario: string;
      walkthrough: string;
      connection_to_concept: string;
    };
    misconception?: {
      wrong_belief: string;
      why_wrong: string;
      correct_understanding: string;
    };
    steps?: {
      step: number;
      title: string;
      explanation: string;
    }[];
  };
  visual: {
    type: 'diagram' | 'screenshot' | 'comparison' | 'flowchart' | 'illustration' | 'none';
    url?: string | null;
    alt_text: string;
    fallback_description: string;
    elements?: string[];
    style?: string;
  };
  speaker_notes: string;
  speaker_notes_duration_seconds?: number;
  pedagogy?: {
    purpose: string;
    bloom_action: string;
    transition_to_next: string;
  };
  quality_score?: number;
}

// Type guard for Professor AI slides (v3)
export function isProfessorSlide(slide: Slide | EnhancedSlide | ProfessorSlide): slide is ProfessorSlide {
  return 'content' in slide && 
         typeof slide.content === 'object' && 
         slide.content !== null && 
         'main_text' in slide.content &&
         'pedagogy' in slide;
}

export interface LectureSlide {
  id: string;
  teaching_unit_id: string;
  learning_objective_id: string;
  instructor_course_id: string;
  title: string;
  slides: Slide[] | EnhancedSlide[];
  total_slides: number;
  estimated_duration_minutes: number | null;
  slide_style: 'standard' | 'minimal' | 'detailed' | 'interactive';
  generation_context: Record<string, unknown> | null;
  generation_model: string | null;
  status: 'pending' | 'generating' | 'ready' | 'published' | 'failed';
  error_message: string | null;
  has_audio: boolean;
  audio_status: 'pending' | 'generating' | 'ready' | 'failed' | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // V2 fields
  research_context?: {
    definitions?: any[];
    examples?: any[];
    citations?: any[];
  };
  generation_phases?: {
    current_phase?: string;
    progress_percent?: number;
    completed?: string;
  };
  quality_score?: number;
  citation_count?: number;
  is_research_grounded?: boolean;
}

// Type guard to check if slides are enhanced (v2) format
export function isEnhancedSlide(slide: Slide | EnhancedSlide): slide is EnhancedSlide {
  return 'content' in slide && typeof slide.content === 'object' && 'main_text' in (slide.content || {});
}

/**
 * Fetch lecture slides for a specific teaching unit
 */
export function useLectureSlides(teachingUnitId?: string) {
  return useQuery({
    queryKey: ['lecture-slides', teachingUnitId],
    queryFn: async () => {
      if (!teachingUnitId) return null;
      
      const { data, error } = await supabase
        .from('lecture_slides')
        .select('*')
        .eq('teaching_unit_id', teachingUnitId)
        .maybeSingle();
      
      if (error) throw error;
      
      // Parse slides from JSONB
      if (data) {
        return {
          ...data,
          slides: (data.slides as unknown as Slide[]) || [],
        } as LectureSlide;
      }
      
      return null;
    },
    enabled: !!teachingUnitId,
  });
}

/**
 * Fetch a single lecture slide by ID (for student slide page)
 */
export function useLectureSlide(slideId?: string) {
  return useQuery({
    queryKey: ['lecture-slide', slideId],
    queryFn: async () => {
      if (!slideId) return null;
      
      const { data, error } = await supabase
        .from('lecture_slides')
        .select('*')
        .eq('id', slideId)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        return {
          ...data,
          slides: (data.slides as unknown as Slide[]) || [],
        } as LectureSlide;
      }
      
      return null;
    },
    enabled: !!slideId,
  });
}

/**
 * Fetch all lecture slides for a course
 */
export function useCourseLectureSlides(instructorCourseId?: string) {
  return useQuery({
    queryKey: ['course-lecture-slides', instructorCourseId],
    queryFn: async () => {
      if (!instructorCourseId) return [];
      
      const { data, error } = await supabase
        .from('lecture_slides')
        .select('*')
        .eq('instructor_course_id', instructorCourseId)
        .order('created_at');
      
      if (error) throw error;
      
      return (data || []).map(slide => ({
        ...slide,
        slides: (slide.slides as unknown as Slide[]) || [],
      })) as LectureSlide[];
    },
    enabled: !!instructorCourseId,
  });
}

/**
 * Fetch published slides for enrolled students
 */
export function usePublishedLectureSlides(instructorCourseId?: string) {
  return useQuery({
    queryKey: ['published-lecture-slides', instructorCourseId],
    queryFn: async () => {
      if (!instructorCourseId) return [];
      
      const { data, error } = await supabase
        .from('lecture_slides')
        .select('*')
        .eq('instructor_course_id', instructorCourseId)
        .eq('status', 'published')
        .order('created_at');
      
      if (error) throw error;
      
      return (data || []).map(slide => ({
        ...slide,
        slides: (slide.slides as unknown as Slide[]) || [],
      })) as LectureSlide[];
    },
    enabled: !!instructorCourseId,
  });
}

/**
 * Generate lecture slides for a teaching unit
 * Uses the v2 multi-agent system for research-grounded content
 */
export function useGenerateLectureSlides() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [progress, setProgress] = useState<{
    phase: string;
    percent: number;
    message: string;
  } | null>(null);
  
  const mutation = useMutation({
    mutationFn: async ({ 
      teachingUnitId, 
      style = 'standard',
      regenerate = false,
    }: { 
      teachingUnitId: string; 
      style?: 'standard' | 'minimal' | 'detailed' | 'interactive';
      regenerate?: boolean;
    }) => {
      setProgress({ phase: 'starting', percent: 0, message: 'Initializing Professor AI...' });
      
      // Use v3 Professor AI endpoint
      const { data, error } = await supabase.functions.invoke('generate-lecture-slides-v3', {
        body: { 
          teaching_unit_id: teachingUnitId,
          style,
          regenerate,
        }
      });
      
      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Generation failed');
      }
      if (!data?.success) throw new Error(data?.error || 'Generation failed');
      
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lecture-slides', variables.teachingUnitId] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides'] });
      
      setProgress(null);
      
      toast({
        title: '🎓 Lecture Slides Generated',
        description: `Created ${data.slideCount} slides${data.visualCount ? ` with ${data.visualCount} custom visuals` : ''} (Quality: ${data.qualityScore || 'N/A'}%)`,
      });
    },
    onError: (error: Error) => {
      setProgress(null);
      toast({
        title: 'Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Progress simulation while waiting - v3 two-phase approach
  useEffect(() => {
    if (!mutation.isPending) return;
    
    const phases = [
      { phase: 'professor', percent: 15, message: '🎓 Professor AI: Analyzing teaching context...' },
      { phase: 'professor', percent: 35, message: '🎓 Professor AI: Designing pedagogical sequence...' },
      { phase: 'professor', percent: 55, message: '🎓 Professor AI: Writing slide content...' },
      { phase: 'visual', percent: 70, message: '🎨 Visual AI: Generating custom diagrams...' },
      { phase: 'visual', percent: 85, message: '🎨 Visual AI: Processing images...' },
      { phase: 'finalize', percent: 95, message: '✅ Finalizing lecture deck...' },
    ];
    
    let currentPhaseIndex = 0;
    const interval = setInterval(() => {
      if (currentPhaseIndex < phases.length) {
        setProgress(phases[currentPhaseIndex]);
        currentPhaseIndex++;
      }
    }, 8000); // ~8s per phase estimate (faster v3)
    
    return () => clearInterval(interval);
  }, [mutation.isPending]);

  return {
    ...mutation,
    progress,
  };
}

// useGenerateExpertLectureSlides is now merged into useGenerateLectureSlides above

/**
 * Publish lecture slides (make available to students)
 */
export function usePublishLectureSlides() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (slideId: string) => {
      const { data, error } = await supabase
        .from('lecture_slides')
        .update({ status: 'published' })
        .eq('id', slideId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lecture-slides', data.teaching_unit_id] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides'] });
      queryClient.invalidateQueries({ queryKey: ['published-lecture-slides'] });
      
      toast({
        title: 'Slides Published',
        description: 'Students can now access these lecture slides.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Publish Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Unpublish lecture slides
 */
export function useUnpublishLectureSlides() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (slideId: string) => {
      const { data, error } = await supabase
        .from('lecture_slides')
        .update({ status: 'ready' })
        .eq('id', slideId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lecture-slides', data.teaching_unit_id] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides'] });
      queryClient.invalidateQueries({ queryKey: ['published-lecture-slides'] });
      
      toast({
        title: 'Slides Unpublished',
        description: 'Slides are no longer visible to students.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Update slide content (for inline editing)
 */
export function useUpdateLectureSlide() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ 
      slideId, 
      slides,
    }: { 
      slideId: string; 
      slides: Slide[];
    }) => {
      const { data, error } = await supabase
        .from('lecture_slides')
        .update({ 
          slides: JSON.parse(JSON.stringify(slides)),
          total_slides: slides.length,
        })
        .eq('id', slideId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lecture-slides', data.teaching_unit_id] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides'] });
      
      toast({
        title: 'Slides Updated',
        description: 'Your changes have been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Delete lecture slides
 */
export function useDeleteLectureSlides() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ slideId, teachingUnitId }: { slideId: string; teachingUnitId: string }) => {
      const { error } = await supabase
        .from('lecture_slides')
        .delete()
        .eq('id', slideId);
      
      if (error) throw error;
      return { teachingUnitId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lecture-slides', data.teachingUnitId] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides'] });
      queryClient.invalidateQueries({ queryKey: ['published-lecture-slides'] });
      
      toast({
        title: 'Slides Deleted',
        description: 'The lecture slides have been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Bulk publish all ready slides for a course
 */
export function useBulkPublishSlides() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (instructorCourseId: string) => {
      const { data, error } = await supabase
        .from('lecture_slides')
        .update({ status: 'published' })
        .eq('instructor_course_id', instructorCourseId)
        .eq('status', 'ready')
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, instructorCourseId) => {
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides', instructorCourseId] });
      queryClient.invalidateQueries({ queryKey: ['published-lecture-slides'] });
      
      toast({
        title: 'All Slides Published',
        description: `Published ${data?.length || 0} lecture slide sets.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Bulk Publish Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
