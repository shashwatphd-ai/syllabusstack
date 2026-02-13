/**
 * Lecture Audio Generation Hooks
 *
 * Contains hooks for generating TTS audio for lecture slides.
 * Uses fire-and-forget pattern with status polling to avoid gateway timeouts.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Generate TTS audio for lecture slides using Google Cloud TTS (Chirp 3: HD).
 *
 * Architecture:
 * - Fire-and-forget: the mutation fires the edge function but does NOT await
 *   the full response. It returns as soon as the request is accepted.
 * - Polling: a companion query polls `lecture_slides.audio_status` every 5s
 *   while status is `generating`. When it flips to `ready` or `failed`,
 *   polling stops and queries are invalidated.
 */
export function useGenerateLectureAudio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [pollingSlideId, setPollingSlideId] = useState<string | null>(null);
  const toastShownRef = useRef(false);

  // Poll audio_status every 5s while generating
  const { data: pollingData } = useQuery({
    queryKey: ['audio-status-poll', pollingSlideId],
    queryFn: async () => {
      if (!pollingSlideId) return null;
      const { data, error } = await supabase
        .from('lecture_slides')
        .select('audio_status, has_audio, audio_generated_at')
        .eq('id', pollingSlideId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!pollingSlideId && isGenerating,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  // React to polling results
  useEffect(() => {
    if (!pollingData || !pollingSlideId || !isGenerating) return;

    const status = pollingData.audio_status;

    if (status === 'ready') {
      setIsGenerating(false);
      setPollingSlideId(null);

      // Invalidate all slide queries so UI refreshes
      queryClient.invalidateQueries({ queryKey: ['lecture-slides'] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides'] });
      queryClient.invalidateQueries({ queryKey: ['lecture-slide'] });

      if (!toastShownRef.current) {
        toastShownRef.current = true;
        toast({
          title: 'Audio Generated',
          description: 'Narration is ready for playback.',
        });
      }
    } else if (status === 'failed') {
      setIsGenerating(false);
      setPollingSlideId(null);

      queryClient.invalidateQueries({ queryKey: ['lecture-slides'] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides'] });
      queryClient.invalidateQueries({ queryKey: ['lecture-slide'] });

      if (!toastShownRef.current) {
        toastShownRef.current = true;
        toast({
          title: 'Audio Generation Failed',
          description: 'The audio generation encountered an error. Please try again.',
          variant: 'destructive',
        });
      }
    }
  }, [pollingData, pollingSlideId, isGenerating, queryClient, toast]);

  const mutation = useMutation({
    mutationFn: async ({
      slideId,
      enableSegmentMapping = true,
    }: {
      slideId: string;
      enableSegmentMapping?: boolean;
    }) => {
      // Reset toast guard for new generation
      toastShownRef.current = false;
      setIsGenerating(true);
      setPollingSlideId(slideId);

      // Fire-and-forget: invoke the edge function but don't await the full
      // processing. We only check for immediate errors (validation, config).
      // The edge function sets audio_status = 'generating' and proceeds.
      // Our polling query watches for the status to change.
      supabase.functions.invoke('generate-lecture-audio', {
        body: { slideId, enableSegmentMapping }
      }).then(({ error, data }) => {
        // Handle only immediate failures (e.g. validation errors returned quickly)
        if (error) {
          console.error('Audio generation invocation error:', error);
          let errorMessage = 'Audio generation failed';
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
          // Only show toast if polling hasn't already shown one
          if (!toastShownRef.current) {
            toastShownRef.current = true;
            setIsGenerating(false);
            setPollingSlideId(null);
            toast({
              title: 'Audio Generation Failed',
              description: errorMessage,
              variant: 'destructive',
            });
          }
        }
        // Success response from edge function is ignored here — polling handles it
      }).catch((err) => {
        // Network-level errors (gateway timeout, etc.) are expected for long jobs.
        // Polling will pick up the actual result. Only log, don't show error toast.
        console.warn('Audio generation request did not return (expected for long jobs):', err?.message);
      });

      // Return immediately — don't block the UI
      return { started: true, slideId };
    },
    onSuccess: () => {
      toast({
        title: 'Audio Generation Started',
        description: 'Generating narration for all 6 voices. This may take several minutes.',
      });
    },
    onError: (error: Error) => {
      setIsGenerating(false);
      setPollingSlideId(null);
      toast({
        title: 'Audio Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Allow external reset (e.g. when dialog closes)
  const cancelPolling = useCallback(() => {
    setIsGenerating(false);
    setPollingSlideId(null);
  }, []);

  return {
    ...mutation,
    isGenerating,
    cancelPolling,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Batch Audio Generation Hook
// ──────────────────────────────────────────────────────────────────────────────

interface BatchAudioStatus {
  total: number;
  completed: number;
  pending: number;
  generating: number;
  failed: number;
  actionable: number;
  isRunning: boolean;
}

/**
 * Hook for batch audio generation across an entire course.
 *
 * - Mutation fires `generate-batch-audio` (fire-and-forget).
 * - Polling query watches `lecture_slides` audio_status for progress.
 */
export function useBatchGenerateAudio(instructorCourseId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Poll audio progress for the course
  const { data: audioStatus } = useQuery<BatchAudioStatus>({
    queryKey: ['batch-audio-status', instructorCourseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lecture_slides')
        .select('has_audio, audio_status')
        .eq('instructor_course_id', instructorCourseId!)
        .in('status', ['ready', 'published']);

      if (error) throw error;

      const slides = data || [];
      const completed = slides.filter(s => s.has_audio === true).length;
      const generating = slides.filter(s => s.audio_status === 'generating').length;
      const failed = slides.filter(s => s.audio_status === 'failed').length;
      const pending = slides.filter(s => !s.has_audio && s.audio_status !== 'generating' && s.audio_status !== 'failed').length;
      // "actionable" = pending + failed (units that need audio generation)
      const actionable = pending + failed;

      return {
        total: slides.length,
        completed,
        pending,
        generating,
        failed,
        actionable,
        isRunning: generating > 0,
      };
    },
    enabled: !!instructorCourseId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.isRunning) return 10_000; // 10s while generating
      return false;
    },
    staleTime: 10_000,
  });

  const mutation = useMutation({
    mutationFn: async (courseId: string) => {
      // Fire-and-forget — the edge function self-continues
      supabase.functions.invoke('generate-batch-audio', {
        body: { instructorCourseId: courseId },
      }).catch(err => {
        console.warn('Batch audio invocation warning (expected for long jobs):', err?.message);
      });

      return { started: true };
    },
    onSuccess: () => {
      toast({
        title: 'Batch Audio Generation Started',
        description: 'Generating audio for all pending teaching units. This runs in the background and may take a few hours.',
      });
      // Start polling
      queryClient.invalidateQueries({ queryKey: ['batch-audio-status', instructorCourseId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Batch Audio Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    ...mutation,
    audioStatus: audioStatus ?? { total: 0, completed: 0, pending: 0, generating: 0, failed: 0, actionable: 0, isRunning: false },
  };
}
