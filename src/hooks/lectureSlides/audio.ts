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
      voiceId = 'Charon',
      enableSegmentMapping = true,
    }: {
      slideId: string;
      voiceId?: string;
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
        body: { slideId, voiceId, enableSegmentMapping }
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
        description: 'Generating narration in the background. This may take a few minutes.',
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
