/**
 * Lecture Slides Mutation Hooks
 *
 * Contains hooks for slide generation, CRUD operations, and publishing.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Slide, GenerationProgress } from './types';

/** Max time (ms) to poll before giving up */
const GENERATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate lecture slides for a teaching unit
 * Uses fire-and-forget + polling to avoid gateway timeouts.
 */
export function useGenerateLectureSlides() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pollingTeachingUnitId, setPollingTeachingUnitId] = useState<string | null>(null);
  const toastShownRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  // Poll lecture_slides status every 5s while generating
  const { data: pollingData } = useQuery({
    queryKey: ['slide-generation-poll', pollingTeachingUnitId],
    queryFn: async () => {
      if (!pollingTeachingUnitId) return null;
      const { data, error } = await supabase
        .from('lecture_slides')
        .select('id, status, total_slides, generation_phases, error_message')
        .eq('teaching_unit_id', pollingTeachingUnitId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!pollingTeachingUnitId && isGenerating,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  // React to polling results
  useEffect(() => {
    if (!pollingData || !pollingTeachingUnitId || !isGenerating) return;

    const status = pollingData.status;

    // Update progress from real generation_phases data
    const phases = pollingData.generation_phases as Record<string, unknown> | null;
    if (phases && status === 'generating') {
      const currentPhase = (phases.current_phase as string) || 'generating';
      const progressPercent = (phases.progress_percent as number) || 0;
      const phaseMessage = (phases.phase_message as string) || `Generating: ${currentPhase}...`;
      setProgress({ phase: currentPhase, percent: progressPercent, message: phaseMessage });
    }

    if (status === 'ready') {
      setIsGenerating(false);
      setPollingTeachingUnitId(null);
      setProgress(null);

      queryClient.invalidateQueries({ queryKey: ['lecture-slides', pollingTeachingUnitId] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides'] });

      if (!toastShownRef.current) {
        toastShownRef.current = true;
        toast({
          title: 'Lecture Slides Generated',
          description: `Created ${pollingData.total_slides || ''} slides successfully.`,
        });
      }
    } else if (status === 'failed') {
      setIsGenerating(false);
      setPollingTeachingUnitId(null);
      setProgress(null);

      queryClient.invalidateQueries({ queryKey: ['lecture-slides', pollingTeachingUnitId] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides'] });

      if (!toastShownRef.current) {
        toastShownRef.current = true;
        toast({
          title: 'Generation Failed',
          description: (pollingData.error_message as string) || 'Slide generation failed. Please try again.',
          variant: 'destructive',
        });
      }
    }

    // Timeout safety
    if (Date.now() - startTimeRef.current > GENERATION_TIMEOUT_MS && status === 'generating') {
      setIsGenerating(false);
      setPollingTeachingUnitId(null);
      setProgress(null);

      if (!toastShownRef.current) {
        toastShownRef.current = true;
        toast({
          title: 'Generation Timeout',
          description: 'Generation is taking longer than expected. Check back shortly — it may still complete.',
          variant: 'destructive',
        });
      }
    }
  }, [pollingData, pollingTeachingUnitId, isGenerating, queryClient, toast]);

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
      // Reset state for new generation
      toastShownRef.current = false;
      startTimeRef.current = Date.now();
      setIsGenerating(true);
      setPollingTeachingUnitId(teachingUnitId);
      setProgress({ phase: 'starting', percent: 0, message: 'Initializing Professor AI...' });

      // Fire-and-forget: invoke the edge function but don't await the full response.
      // The edge function creates/updates the lecture_slides record with status='generating'
      // before doing work, so our polling query will pick up progress.
      supabase.functions.invoke('generate-lecture-slides-v3', {
        body: {
          teaching_unit_id: teachingUnitId,
          style,
          regenerate,
        }
      }).then(({ error, data }) => {
        // Handle only immediate failures (e.g. validation errors returned quickly)
        if (error) {
          console.error('Slide generation invocation error:', error);
          let errorMessage = 'Slide generation failed';
          try {
            if (error.context?.body) {
              const body = typeof error.context.body === 'string'
                ? JSON.parse(error.context.body)
                : error.context.body;
              errorMessage = body?.error?.message || body?.message || error.message || errorMessage;
            } else {
              errorMessage = error.message || errorMessage;
            }
          } catch {
            errorMessage = error.message || errorMessage;
          }
          // Only show toast if polling hasn't already resolved
          if (!toastShownRef.current) {
            toastShownRef.current = true;
            setIsGenerating(false);
            setPollingTeachingUnitId(null);
            setProgress(null);
            toast({
              title: 'Generation Failed',
              description: errorMessage,
              variant: 'destructive',
            });
          }
        }
        // Success response is ignored — polling handles the result
      }).catch((err) => {
        // Network-level errors (gateway timeout) are expected for long jobs.
        // Polling will pick up the actual result. Only log.
        console.warn('Slide generation request did not return (expected for long jobs):', err?.message);
      });

      // Return immediately — don't block the UI
      return { started: true, teachingUnitId };
    },
    onSuccess: (_data, variables) => {
      toast({
        title: 'Slide Generation Started',
        description: 'Professor AI is creating your lecture slides. This may take a few minutes.',
      });
    },
    onError: (error: Error) => {
      setIsGenerating(false);
      setPollingTeachingUnitId(null);
      setProgress(null);
      toast({
        title: 'Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Allow external reset (e.g. when navigating away)
  const cancelPolling = useCallback(() => {
    setIsGenerating(false);
    setPollingTeachingUnitId(null);
    setProgress(null);
  }, []);

  return {
    ...mutation,
    progress,
    isGenerating,
    cancelPolling,
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
 * Cancel a queued (pending) slide — deletes the empty placeholder record
 */
export function useCancelQueuedSlide() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ teachingUnitId }: { teachingUnitId: string }) => {
      const { error } = await supabase
        .from('lecture_slides')
        .delete()
        .eq('teaching_unit_id', teachingUnitId)
        .in('status', ['pending']);

      if (error) throw error;
      return { teachingUnitId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lecture-slides', data.teachingUnitId] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides'] });

      toast({
        title: 'Queued Slide Cancelled',
        description: 'You can now regenerate this lecture.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Cancel Failed',
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
