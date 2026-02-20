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
  isStalled: boolean;
}

const STALL_THRESHOLD_MS = 180_000; // 3 minutes without progress

/**
 * Hook for batch audio generation across an entire course.
 *
 * - Mutation fires `generate-batch-audio` (fire-and-forget).
 * - Polling query watches `lecture_slides` audio_status for progress.
 */
export function useBatchGenerateAudio(instructorCourseId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Local flag: stays true from the moment the user clicks until generation
  // finishes. This ensures polling starts immediately — even before the DB
  // has any rows with audio_status = 'generating'.
  const [batchActive, setBatchActive] = useState(false);
  const prevCompletedRef = useRef<number | null>(null);
  const lastProgressAtRef = useRef<number>(Date.now());
  const [isStalled, setIsStalled] = useState(false);

  // Poll audio progress for the course
  const { data: audioStatus } = useQuery<BatchAudioStatus>({
    queryKey: ['batch-audio-status', instructorCourseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lecture_slides')
        .select('has_audio, audio_status, updated_at')
        .eq('instructor_course_id', instructorCourseId!)
        .in('status', ['ready', 'published']);

      if (error) throw error;

      const slides = data || [];
      const completed = slides.filter(s => s.has_audio === true).length;
      // Treat slides stuck in 'generating' for >10 min as stale (not truly generating)
      const STALE_MS = 10 * 60 * 1000;
      const now = Date.now();
      const activelyGenerating = slides.filter(s => 
        s.audio_status === 'generating' && 
        s.updated_at && (now - new Date(s.updated_at).getTime()) < STALE_MS
      ).length;
      const staleGenerating = slides.filter(s => 
        s.audio_status === 'generating' && 
        (!s.updated_at || (now - new Date(s.updated_at).getTime()) >= STALE_MS)
      ).length;
      const failed = slides.filter(s => s.audio_status === 'failed').length;
      const pending = slides.filter(s => !s.has_audio && s.audio_status !== 'generating' && s.audio_status !== 'failed').length;
      // Stale generating slides count as actionable (need retry), not as actively running
      const actionable = pending + failed + staleGenerating;

      return {
        total: slides.length,
        completed,
        pending: pending + staleGenerating,
        generating: activelyGenerating,
        failed,
        actionable,
        isRunning: activelyGenerating > 0 || (batchActive && actionable > 0),
        isStalled: false, // calculated in effect below
      };
    },
    enabled: !!instructorCourseId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Poll every 10s while batch is active, generating, OR stalled (keep polling to detect recovery)
      if (batchActive || isStalled || (data && (data.generating > 0))) return 10_000;
      return false;
    },
    staleTime: 3_000,
  });

  // When audio progress changes, also refresh the slide cards in the course view
  useEffect(() => {
    if (!audioStatus || !instructorCourseId) return;
    const prev = prevCompletedRef.current;
    if (prev !== null && prev !== audioStatus.completed) {
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides', instructorCourseId] });
      // Progress happened — reset stall timer
      lastProgressAtRef.current = Date.now();
      setIsStalled(false);
    }
    prevCompletedRef.current = audioStatus.completed;

    // Stall detection: generating > 0 but no progress for 3 min
    if (audioStatus.generating > 0 && Date.now() - lastProgressAtRef.current > STALL_THRESHOLD_MS) {
      setIsStalled(true);
    } else if (audioStatus.generating === 0) {
      setIsStalled(false);
    }

    // Auto-deactivate batch when nothing is left to process
    if (batchActive && audioStatus.generating === 0 && audioStatus.pending === 0) {
      setBatchActive(false);
    }
  }, [audioStatus, instructorCourseId, batchActive, queryClient]);

  const mutation = useMutation({
    mutationFn: async (courseId: string) => {
      // Activate polling immediately
      setBatchActive(true);

      // Reset stall state
      setIsStalled(false);
      lastProgressAtRef.current = Date.now();

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
      // Force immediate refetch
      queryClient.invalidateQueries({ queryKey: ['batch-audio-status', instructorCourseId] });
    },
    onError: (error: Error) => {
      setBatchActive(false);
      toast({
        title: 'Batch Audio Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    ...mutation,
    audioStatus: audioStatus
      ? { ...audioStatus, isStalled }
      : { total: 0, completed: 0, pending: 0, generating: 0, failed: 0, actionable: 0, isRunning: false, isStalled: false },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Retry Stuck Audio Hook
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Resets slides stuck in `audio_status = 'generating'` for >5 minutes
 * back to null, then re-invokes the batch orchestrator.
 */
export function useRetryStuckAudio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (instructorCourseId: string) => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      // Reset stuck slides
      const { data: reset, error: resetError } = await supabase
        .from('lecture_slides')
        .update({ audio_status: null } as Record<string, unknown>)
        .eq('instructor_course_id', instructorCourseId)
        .eq('audio_status', 'generating')
        .lt('updated_at', fiveMinAgo)
        .select('id');

      if (resetError) throw resetError;

      // Re-invoke orchestrator
      supabase.functions.invoke('generate-batch-audio', {
        body: { instructorCourseId },
      }).catch(err => {
        console.warn('Retry stuck audio invocation warning:', err?.message);
      });

      return { resetCount: reset?.length ?? 0 };
    },
    onSuccess: ({ resetCount }) => {
      toast({
        title: 'Retrying Audio Generation',
        description: `Reset ${resetCount} stuck slide(s) and restarted the audio pipeline.`,
      });
      queryClient.invalidateQueries({ queryKey: ['batch-audio-status'] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides'] });
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
