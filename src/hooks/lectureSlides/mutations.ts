/**
 * Lecture Slides Mutation Hooks
 *
 * Contains hooks for slide generation, CRUD operations, and publishing.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import type { Slide, GenerationProgress } from './types';

/**
 * Generate lecture slides for a teaching unit
 * Uses the v3 Professor AI system for research-grounded content
 */
export function useGenerateLectureSlides() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

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
        title: 'Lecture Slides Generated',
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
      { phase: 'professor', percent: 15, message: 'Professor AI: Analyzing teaching context...' },
      { phase: 'professor', percent: 35, message: 'Professor AI: Designing pedagogical sequence...' },
      { phase: 'professor', percent: 55, message: 'Professor AI: Writing slide content...' },
      { phase: 'visual', percent: 70, message: 'Visual AI: Generating custom diagrams...' },
      { phase: 'visual', percent: 85, message: 'Visual AI: Processing images...' },
      { phase: 'finalize', percent: 95, message: 'Finalizing lecture deck...' },
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
