/**
 * Lecture Audio Generation Hooks
 *
 * Contains hooks for generating TTS audio for lecture slides.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

/**
 * Generate TTS audio for lecture slides using GPT Audio via OpenRouter
 */
export function useGenerateLectureAudio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({
      slideId,
      voiceId = 'onyx'
    }: {
      slideId: string;
      voiceId?: string;
    }) => {
      setIsGenerating(true);

      const { data, error } = await supabase.functions.invoke('generate-lecture-audio', {
        body: { slideId, voiceId }
      });

      if (error) {
        console.error('Audio generation error:', error);
        // Edge function errors come as FunctionsHttpError with the response body
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
        throw new Error(errorMessage);
      }

      if (!data?.success) {
        throw new Error(data?.error || data?.message || 'Audio generation failed');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lecture-slides'] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides'] });
      queryClient.invalidateQueries({ queryKey: ['lecture-slide'] });

      setIsGenerating(false);

      toast({
        title: 'Audio Generated',
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
