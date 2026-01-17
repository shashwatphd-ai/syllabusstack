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

// AI-generated layout hint for adaptive rendering
export interface LayoutHint {
  type: 'flow' | 'comparison' | 'equation' | 'list' | 'quote' | 'callout' | 'plain';
  segments?: string[];        // For flows: ["Step 1", "Step 2", "Step 3"]
  left_right?: [string, string]; // For comparisons: ["Left side", "Right side"]
  formula?: string;           // For equations: "E = mc²"
  emphasis_words?: string[];  // Words to bold/highlight
}

// Key point with optional layout hint for adaptive rendering
export interface KeyPointWithHint {
  text: string;
  layout_hint?: LayoutHint;
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
    // Support both string[] (legacy) and KeyPointWithHint[] (new with layout hints)
    key_points?: (string | KeyPointWithHint)[];
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
  // Audio segment map for synchronized highlighting
  audio_segment_map?: {
    target_block: string;
    start_percent: number;
    end_percent: number;
    narration_excerpt?: string;
  }[];
  audio_url?: string;
  audio_duration_seconds?: number;
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
 * Fetch all lecture slides for a course, ordered by teaching unit sequence.
 * Includes Realtime subscription for auto-updating status changes.
 */
export function useCourseLectureSlides(instructorCourseId?: string) {
  const queryClient = useQueryClient();
  
  // Set up Realtime subscription for status changes
  // Use a ref to avoid stale closures with queryClient
  useEffect(() => {
    if (!instructorCourseId) return;
    
    console.log('[Realtime] Setting up lecture_slides subscription for:', instructorCourseId);
    
    const channel = supabase
      .channel(`lecture-slides-${instructorCourseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lecture_slides',
          filter: `instructor_course_id=eq.${instructorCourseId}`,
        },
        (payload) => {
          console.log('[Realtime] Lecture slide change:', payload.eventType, payload.new);
          
          // Use setTimeout to ensure we're not in a render cycle
          setTimeout(() => {
            // Invalidate queries to refresh the data
            queryClient.invalidateQueries({ 
              queryKey: ['course-lecture-slides', instructorCourseId] 
            });
            queryClient.invalidateQueries({ 
              queryKey: ['lecture-queue-status', instructorCourseId] 
            });
            
            // Also invalidate specific teaching unit query if available
            if (payload.new && typeof payload.new === 'object' && 'teaching_unit_id' in payload.new) {
              queryClient.invalidateQueries({ 
                queryKey: ['lecture-slides', (payload.new as any).teaching_unit_id] 
              });
            }
          }, 0);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });
    
    return () => {
      console.log('[Realtime] Cleaning up lecture_slides subscription');
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructorCourseId]);
  
  return useQuery({
    queryKey: ['course-lecture-slides', instructorCourseId],
    queryFn: async () => {
      if (!instructorCourseId) return [];
      
      // Join with teaching_units to get sequence_order for proper ordering
      const { data, error } = await supabase
        .from('lecture_slides')
        .select(`
          *,
          teaching_unit:teaching_units!teaching_unit_id (
            sequence_order
          )
        `)
        .eq('instructor_course_id', instructorCourseId);
      
      if (error) throw error;
      
      // Sort by teaching unit sequence order
      const sortedData = (data || []).sort((a, b) => {
        const aOrder = (a.teaching_unit as any)?.sequence_order ?? 999;
        const bOrder = (b.teaching_unit as any)?.sequence_order ?? 999;
        return aOrder - bOrder;
      });
      
      return sortedData.map(slide => ({
        ...slide,
        slides: (slide.slides as unknown as Slide[]) || [],
      })) as LectureSlide[];
    },
    enabled: !!instructorCourseId,
  });
}

/**
 * Fetch published slides for enrolled students, ordered by teaching unit sequence
 */
export function usePublishedLectureSlides(instructorCourseId?: string) {
  return useQuery({
    queryKey: ['published-lecture-slides', instructorCourseId],
    queryFn: async () => {
      if (!instructorCourseId) return [];
      
      // Join with teaching_units to get sequence_order for proper ordering
      const { data, error } = await supabase
        .from('lecture_slides')
        .select(`
          *,
          teaching_unit:teaching_units!teaching_unit_id (
            sequence_order
          )
        `)
        .eq('instructor_course_id', instructorCourseId)
        .eq('status', 'published');
      
      if (error) throw error;
      
      // Sort by teaching unit sequence order
      const sortedData = (data || []).sort((a, b) => {
        const aOrder = (a.teaching_unit as any)?.sequence_order ?? 999;
        const bOrder = (b.teaching_unit as any)?.sequence_order ?? 999;
        return aOrder - bOrder;
      });
      
      return sortedData.map(slide => ({
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
 * Generate TTS audio for lecture slides using Google Cloud WaveNet
 */
export function useGenerateLectureAudio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const mutation = useMutation({
    mutationFn: async ({ 
      slideId, 
      voice = 'en-US-Wavenet-D' 
    }: { 
      slideId: string; 
      voice?: string;
    }) => {
      setIsGenerating(true);
      
      const { data, error } = await supabase.functions.invoke('generate-lecture-audio', {
        body: { slideId, voice }
      });
      
      if (error) {
        console.error('Audio generation error:', error);
        throw new Error(error.message || 'Audio generation failed');
      }
      
      if (!data?.success) {
        throw new Error(data?.error || 'Audio generation failed');
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lecture-slides'] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides'] });
      queryClient.invalidateQueries({ queryKey: ['lecture-slide'] });
      
      setIsGenerating(false);
      
      toast({
        title: '🎙️ Audio Generated',
        description: `Created narration for ${data.slidesWithAudio} slides (~${Math.round(data.totalDurationSeconds / 60)} min)`,
      });
    },
    onError: (error: Error) => {
      setIsGenerating(false);
      toast({
        title: 'Audio Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    ...mutation,
    isGenerating,
  };
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

/**
 * Bulk queue teaching units for slide generation
 * Uses the process-lecture-queue edge function to handle concurrency
 */
export function useBulkQueueSlides() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ 
      instructorCourseId, 
      teachingUnitIds 
    }: { 
      instructorCourseId: string; 
      teachingUnitIds: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke('process-lecture-queue', {
        body: { 
          action: 'queue-bulk',
          instructor_course_id: instructorCourseId,
          teaching_unit_ids: teachingUnitIds,
        }
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Queue operation failed');
      
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides', variables.instructorCourseId] });
      
      toast({
        title: '🎓 Slides Queued for Generation',
        description: `Queued ${data.queued} teaching units. Generation will proceed automatically (max 2 at a time).${data.skipped > 0 ? ` Skipped ${data.skipped} already completed.` : ''}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Queue Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Get queue status for a course
 */
export function useQueueStatus(instructorCourseId?: string) {
  return useQuery({
    queryKey: ['lecture-queue-status', instructorCourseId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-lecture-queue', {
        body: { 
          action: 'get-status',
          instructor_course_id: instructorCourseId,
        }
      });
      
      if (error) throw error;
      return data as {
        success: boolean;
        total: number;
        pending: number;
        generating: number;
        ready: number;
        published: number;
        failed: number;
      };
    },
    enabled: !!instructorCourseId,
    refetchInterval: (query) => {
      // Auto-refetch every 5 seconds if there are pending or generating items
      const data = query.state.data;
      if (data && (data.pending > 0 || data.generating > 0)) {
        return 5000;
      }
      return false;
    },
    staleTime: 2000,
  });
}

/**
 * Cleanup stuck generating records
 */
export function useCleanupStuckSlides() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-lecture-queue', {
        body: { action: 'cleanup-stuck' }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides'] });
      queryClient.invalidateQueries({ queryKey: ['lecture-queue-status'] });
      
      if (data.reset > 0) {
        toast({
          title: 'Stuck Items Reset',
          description: `Reset ${data.reset} stuck items to pending. They will be retried.`,
        });
      } else {
        toast({
          title: 'No Stuck Items',
          description: 'All items are processing normally.',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Cleanup Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Retry all failed slide generations for a course
 */
export function useRetryFailedSlides() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (instructorCourseId: string) => {
      const { data, error } = await supabase.functions.invoke('process-lecture-queue', {
        body: { 
          action: 'retry-failed',
          instructor_course_id: instructorCourseId,
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, instructorCourseId) => {
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides', instructorCourseId] });
      queryClient.invalidateQueries({ queryKey: ['lecture-queue-status', instructorCourseId] });
      
      if (data.reset > 0) {
        toast({
          title: 'Retrying Failed Slides',
          description: `Reset ${data.reset} failed slides. They will regenerate automatically.`,
        });
      } else {
        toast({
          title: 'No Failed Slides',
          description: 'All slides are in good state.',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Retry Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
