import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

export interface LectureSlide {
  id: string;
  teaching_unit_id: string;
  learning_objective_id: string;
  instructor_course_id: string;
  title: string;
  slides: Slide[];
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
 */
export function useGenerateLectureSlides() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ 
      teachingUnitId, 
      style = 'standard',
      regenerate = false,
    }: { 
      teachingUnitId: string; 
      style?: 'standard' | 'minimal' | 'detailed' | 'interactive';
      regenerate?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-lecture-slides', {
        body: { 
          teaching_unit_id: teachingUnitId,
          style,
          include_speaker_notes: true,
          regenerate,
        }
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Generation failed');
      
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lecture-slides', variables.teachingUnitId] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides'] });
      
      if (data.already_exists) {
        toast({
          title: 'Slides Already Exist',
          description: 'Opening existing slides...',
        });
      } else {
        toast({
          title: 'Lecture Slides Generated',
          description: `Created ${data.total_slides} slides`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

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
