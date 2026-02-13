/**
 * ============================================================================
 * BATCH SLIDES HOOKS - Vertex AI Batch Prediction Integration
 * ============================================================================
 *
 * PURPOSE: Replace queue-based slide generation with Vertex AI Batch Prediction API
 *
 * WHY THIS EXISTS:
 *   - 50% cost savings via Batch API discount
 *   - Simpler UX: "Processing 45/85 slides..." instead of "2 active, 83 queued"
 *   - No queue management code on frontend
 *   - Higher throughput (no MAX_CONCURRENT limit)
 *
 * HOOKS:
 *   - useSubmitBatchSlides(): Submit all teaching units to batch API
 *   - useBatchStatus(): Poll batch job status every 30 seconds
 *   - useCourseSlideStatus(): Get overall course slide status
 *
 * REPLACES:
 *   - useBulkQueueSlides() in useLectureSlides.ts
 *   - useQueueStatus() in useLectureSlides.ts
 *
 * ============================================================================
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface BatchJob {
  id: string;
  status: 'submitted' | 'processing' | 'completed' | 'failed' | 'partial';
  total_requests: number;
  succeeded_count: number;
  failed_count: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface BatchStatusResponse {
  success: boolean;
  batch_job?: BatchJob;
  slides?: {
    ready: number;
    failed: number;
    batch_pending: number;
    generating: number;
  };
  progress_percent?: number;
  is_complete?: boolean;
  // Vertex AI fields for enterprise status display
  vertex_state?: string;  // "JOB_STATE_RUNNING", "JOB_STATE_SUCCEEDED", etc.
  input_uri?: string;     // GCS input path for debugging
  output_uri?: string;    // GCS output path for debugging
}

export interface CourseSlideStatusResponse {
  success: boolean;
  total_teaching_units: number;
  total_slides: number;
  pending: number;
  batch_pending: number;
  generating: number;
  ready: number;
  published: number;
  failed: number;
  active_batch?: {
    id: string;
    status: string;
    total: number;
    succeeded: number;
    failed: number;
  } | null;
  recent_batches?: Array<{
    id: string;
    status: string;
    total: number;
    succeeded: number;
    failed: number;
    created_at: string;
  }>;
  // Vertex AI fields for enterprise status display
  vertex_state?: string;    // "JOB_STATE_RUNNING", "JOB_STATE_SUCCEEDED", etc.
  progress_percent?: number; // 0-100 completion percentage
}

// ============================================================================
// useSubmitBatchSlides
// ============================================================================
//
// Submit all teaching units for a course to Vertex AI Batch Prediction API.
// Uses TWO-FUNCTION PATTERN to avoid 150s edge function timeout:
//   1. submit-batch-slides → Creates placeholders (fast)
//   2. process-batch-research → Runs research + Vertex AI submission (slow)
//
// USAGE:
//   const submitBatch = useSubmitBatchSlides();
//   submitBatch.mutate({ instructorCourseId, teachingUnitIds });
//

export function useSubmitBatchSlides() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      instructorCourseId,
      teachingUnitIds,
    }: {
      instructorCourseId: string;
      teachingUnitIds: string[];
    }) => {
      // STEP 1: Create placeholder records (fast)
      const { data: submitData, error: submitError } = await supabase.functions.invoke('submit-batch-slides', {
        body: {
          instructor_course_id: instructorCourseId,
          teaching_unit_ids: teachingUnitIds,
        },
      });

      if (submitError) {
        console.error('[Batch] Submit error:', submitError);
        throw submitError;
      }

      if (!submitData?.success) {
        throw new Error(submitData?.error || 'Batch submission failed');
      }

      // STEP 2: Start research and Vertex AI submission (slow, runs in background)
      if (submitData.batch_job_id && submitData.total > 0) {
        // Fire and don't wait - let it run in background
        supabase.functions.invoke('process-batch-research', {
          body: { batch_job_id: submitData.batch_job_id },
        }).catch((err) => {
          console.error('[Batch] Research invocation failed:', err);
        });
      }

      return submitData as {
        success: boolean;
        batch_job_id: string | null;
        total: number;
        skipped: number;
        status: string;
        message: string;
        next_step?: string;
      };
    },

    onSuccess: (data, variables) => {
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides', variables.instructorCourseId] });
      queryClient.invalidateQueries({ queryKey: ['course-slide-status', variables.instructorCourseId] });
      queryClient.invalidateQueries({ queryKey: ['lecture-queue-status', variables.instructorCourseId] });

      // Show progress toast - research is running in background
      toast({
        title: '🔬 Research Started',
        description: `Processing ${data.total} slides. This may take a few minutes.`,
      });
    },

    onError: (error: Error) => {
      console.error('[Batch] Submit failed:', error);
      const errorMessage = error.message;
      
      // Enterprise error codes with specific user guidance
      if (errorMessage.includes('GCP_SERVICE_ACCOUNT_KEY')) {
        toast({
          title: 'Batch Processing Not Configured',
          description: 'Service account not configured. Contact administrator.',
          variant: 'destructive',
        });
      } else if (errorMessage.includes('GCS_BUCKET')) {
        toast({
          title: 'Cloud Storage Not Configured',
          description: 'Storage bucket not configured. Contact administrator.',
          variant: 'destructive',
        });
      } else if (errorMessage.includes('403') || errorMessage.includes('Permission')) {
        toast({
          title: 'Permission Denied',
          description: 'Service account lacks required permissions. Check IAM roles.',
          variant: 'destructive',
        });
      } else if (errorMessage.includes('429')) {
        toast({
          title: 'Rate Limited',
          description: 'Please try again in a few minutes.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Batch Generation Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    },
  });
}

// ============================================================================
// useBatchStatus
// ============================================================================
//
// Poll a specific batch job for status updates.
// Use when you have a batch_job_id and want to track its progress.
//
// USAGE:
//   const { data, isLoading } = useBatchStatus(batchJobId);
//   // data.progress_percent, data.is_complete, etc.
//

export function useBatchStatus(batchJobId?: string | null) {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<boolean>(false);

  // Set up Realtime subscription for this specific batch job
  useEffect(() => {
    if (!batchJobId || subscriptionRef.current) return;

    const channelName = `batch-job-${batchJobId}`;
    
    const existingChannels = supabase.getChannels();
    const existingChannel = existingChannels.find(ch => ch.topic === `realtime:${channelName}`);
    if (existingChannel) {
      return;
    }

    subscriptionRef.current = true;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'batch_jobs',
          filter: `id=eq.${batchJobId}`,
        },
        (payload) => {
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['batch-status', batchJobId] });
          }, 0);
        }
      )
      .subscribe();

    return () => {
      subscriptionRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [batchJobId, queryClient]);

  return useQuery({
    queryKey: ['batch-status', batchJobId],

    queryFn: async (): Promise<BatchStatusResponse> => {
      if (!batchJobId) {
        return { success: false };
      }

      const { data, error } = await supabase.functions.invoke('poll-batch-status', {
        body: { batch_job_id: batchJobId },
      });

      if (error) throw error;
      return data;
    },

    enabled: !!batchJobId,

    // Poll every 10 seconds for responsive progress updates
    // Realtime subscription handles instant updates; polling is fallback
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.is_complete) {
        return false;
      }
      return 60000; // 60 seconds - Realtime handles instant updates, this is safety net
    },

    staleTime: 3000,
  });
}

// ============================================================================
// useCourseSlideStatus
// ============================================================================
//
// Get overall slide generation status for a course.
// Shows total counts, active batches, and recent batch history.
//
// USAGE:
//   const { data } = useCourseSlideStatus(instructorCourseId);
//   // data.ready, data.generating, data.active_batch, etc.
//

export function useCourseSlideStatus(instructorCourseId?: string) {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<boolean>(false);

  // Set up Realtime subscription for batch_jobs updates
  useEffect(() => {
    if (!instructorCourseId || subscriptionRef.current) return;

    const channelName = `batch-jobs-${instructorCourseId}`;
    
    // Check if channel already exists to prevent duplicates
    const existingChannels = supabase.getChannels();
    const existingChannel = existingChannels.find(ch => ch.topic === `realtime:${channelName}`);
    if (existingChannel) {
      return;
    }

    subscriptionRef.current = true;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'batch_jobs',
          filter: `instructor_course_id=eq.${instructorCourseId}`,
        },
        (payload) => {
          // Invalidate queries immediately on any change
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ['course-slide-status', instructorCourseId]
            });
            queryClient.invalidateQueries({
              queryKey: ['course-lecture-slides', instructorCourseId]
            });

            // Also invalidate specific batch status if we have an ID
            if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
              queryClient.invalidateQueries({
                queryKey: ['batch-status', (payload.new as { id: string }).id]
              });
            }
          }, 0);
        }
      )
      .subscribe();

    return () => {
      subscriptionRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [instructorCourseId, queryClient]);

  return useQuery({
    queryKey: ['course-slide-status', instructorCourseId],

    queryFn: async (): Promise<CourseSlideStatusResponse> => {
      if (!instructorCourseId) {
        return {
          success: false,
          total_teaching_units: 0,
          total_slides: 0,
          pending: 0,
          batch_pending: 0,
          generating: 0,
          ready: 0,
          published: 0,
          failed: 0,
        };
      }

      const { data, error } = await supabase.functions.invoke('poll-batch-status', {
        body: { instructor_course_id: instructorCourseId },
      });

      if (error) throw error;
      return data;
    },

    enabled: !!instructorCourseId,

    // Poll every 10 seconds if there's an active batch OR we still have work in-flight.
    // Faster polling (10s vs 30s) provides more responsive UI during generation.
    // Realtime subscription handles instant updates; polling is fallback.
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasWorkInFlight = !!data?.active_batch || (data?.batch_pending ?? 0) > 0 || (data?.generating ?? 0) > 0;
      if (hasWorkInFlight) {
        return 60000; // 60 seconds - Realtime handles instant updates, this is safety net
      }
      return false;
    },

    staleTime: 10_000,
  });
}

// ============================================================================
// useRetryFailedBatchSlides
// ============================================================================
//
// Retry failed slides by submitting them to a new batch.
// Gets all failed slides for a course and resubmits them.
//
// USAGE:
//   const retryFailed = useRetryFailedBatchSlides();
//   retryFailed.mutate(instructorCourseId);
//

export function useRetryFailedBatchSlides() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (instructorCourseId: string) => {
      // First, get all failed slides for this course
      const { data: failedSlides, error: fetchError } = await supabase
        .from('lecture_slides')
        .select('teaching_unit_id')
        .eq('instructor_course_id', instructorCourseId)
        .eq('status', 'failed');

      if (fetchError) throw fetchError;

      if (!failedSlides || failedSlides.length === 0) {
        return { success: true, message: 'No failed slides to retry', count: 0 };
      }

      // Submit failed units to new batch
      const teachingUnitIds = failedSlides.map(s => s.teaching_unit_id);

      const { data, error } = await supabase.functions.invoke('submit-batch-slides', {
        body: {
          instructor_course_id: instructorCourseId,
          teaching_unit_ids: teachingUnitIds,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Retry failed');

      return data;
    },

    onSuccess: (data, instructorCourseId) => {
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides', instructorCourseId] });
      queryClient.invalidateQueries({ queryKey: ['course-slide-status', instructorCourseId] });

      toast({
        title: 'Retrying Failed Slides',
        description: data.message || `Retrying ${data.total ?? data.count ?? 0} failed slides`,
      });
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

// ============================================================================
// BACKWARDS COMPATIBILITY
// ============================================================================
//
// These exports allow gradual migration from old queue hooks.
// They wrap the new batch functions but use the old naming.
//

/**
 * @deprecated Use useSubmitBatchSlides instead
 */
export const useBulkQueueSlides = useSubmitBatchSlides;

/**
 * @deprecated Use useCourseSlideStatus instead
 */
export function useQueueStatus(instructorCourseId?: string) {
  const status = useCourseSlideStatus(instructorCourseId);

  // Transform to match old queue status format
  return {
    ...status,
    data: status.data ? {
      success: true,
      total: status.data.total_slides,
      pending: status.data.pending + status.data.batch_pending,
      generating: status.data.generating,
      ready: status.data.ready,
      published: status.data.published,
      failed: status.data.failed,
    } : undefined,
  };
}

// ============================================================================
// useTriggerImageGeneration
// ============================================================================
//
// Triggers the queue-based image generation for slides that need images.
// Uses the new image_generation_queue table and self-continuing process-batch-images.
//
// USAGE:
//   const triggerImages = useTriggerImageGeneration();
//   triggerImages.mutate({ instructorCourseId });
//

export interface ImageGenerationStatusResponse {
  success: boolean;
  message?: string;
  queued?: number;
  processing?: number;
  completed?: number;
  failed?: number;
  total?: number;
  failedReason?: string;
}

export function useTriggerImageGeneration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ instructorCourseId }: { instructorCourseId: string }) => {
      // SMART TRIGGER: First check if there are failed items that need resetting.
      // This merges the old "Generate Images" and "Retry Failed Images" into one flow.
      const { data: failedCheck } = await supabase
        .from('image_generation_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .in('lecture_slides_id', 
          (await supabase
            .from('lecture_slides')
            .select('id')
            .eq('instructor_course_id', instructorCourseId)
          ).data?.map(l => l.id) || []
        );

      const failedCount = failedCheck ?? 0;

      // If there are failed items but no pending, reset them first
      if (typeof failedCount === 'number' && failedCount > 0) {
        console.log(`[ImageGen] Found failed items, resetting before processing...`);
        const { data: resetData, error: resetError } = await supabase.functions.invoke('process-batch-images', {
          body: { reset_failed: true, instructor_course_id: instructorCourseId },
        });
        if (resetError) {
          console.warn('[ImageGen] Reset failed:', resetError);
        } else {
          console.log(`[ImageGen] Reset ${resetData?.reset || 0} failed items`);
          // reset_failed mode auto-triggers continuation, so we can return
          if (resetData?.continuing) {
            return { ...resetData, message: `Reset ${resetData.reset} failed images and restarting...` } as ImageGenerationStatusResponse;
          }
        }
      }

      // Fast path: process existing queue items (MODE 1) — returns in <2s
      const { data, error } = await supabase.functions.invoke('process-batch-images', {
        body: { continue: true },
      });

      if (error) {
        console.error('[ImageGen] Trigger error:', error);
        throw error;
      }

      // If nothing was in the queue, populate it in the background (fire-and-forget)
      if (data?.processed === 0 && data?.remaining === undefined) {
        supabase.functions.invoke('process-batch-images', {
          body: { instructor_course_id: instructorCourseId },
        }).catch(err => console.warn('[ImageGen] Background populate failed:', err));
        
        return { ...data, message: 'Image generation queued and starting...' } as ImageGenerationStatusResponse;
      }

      return data as ImageGenerationStatusResponse;
    },

    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course-slide-status', variables.instructorCourseId] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides', variables.instructorCourseId] });
      // Force immediate refresh of image gen status so button updates
      queryClient.invalidateQueries({ queryKey: ['image-generation-status', variables.instructorCourseId] });

      toast({
        title: '🖼️ Image Generation Started',
        description: data.message || `Processing images for ${data.queued || 0} slides.`,
      });
    },

    onError: (error: Error) => {
      console.error('[ImageGen] Trigger failed:', error);
      toast({
        title: 'Image Generation Failed',
        description: error.message || 'Failed to start image generation.',
        variant: 'destructive',
      });
    },
  });
}

// ============================================================================
// useImageGenerationStatus
// ============================================================================
//
// Fetches the current status of image generation queue for a course.
//

export function useImageGenerationStatus(instructorCourseId?: string) {
  return useQuery({
    queryKey: ['image-generation-status', instructorCourseId],

    queryFn: async (): Promise<ImageGenerationStatusResponse> => {
      if (!instructorCourseId) {
        return { success: false };
      }

      // Query the image_generation_queue table directly
      const { data: queueItems, error } = await supabase
        .from('image_generation_queue')
        .select('status, error_message, lecture_slides!inner(instructor_course_id)')
        .eq('lecture_slides.instructor_course_id', instructorCourseId);

      if (error) {
        console.error('[ImageGen] Status query error:', error);
        return { success: false };
      }

      const counts = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };
      
      // Collect unique error messages from failed items
      const errorMessages = new Set<string>();

      for (const item of queueItems || []) {
        if (item.status === 'pending') counts.pending++;
        else if (item.status === 'processing') counts.processing++;
        else if (item.status === 'completed') counts.completed++;
        else if (item.status === 'failed') {
          counts.failed++;
          if (item.error_message) {
            // Extract the key part of the error message
            const msg = item.error_message;
            if (msg.includes('402') || msg.includes('Payment Required')) {
              errorMessages.add('Payment Required (credits exhausted)');
            } else if (msg.includes('403') || msg.includes('Forbidden')) {
              errorMessages.add('Forbidden (API access denied)');
            } else if (msg.includes('429') || msg.includes('Rate')) {
              errorMessages.add('Rate limited');
            } else {
              errorMessages.add(msg.substring(0, 60));
            }
          }
        }
      }

      return {
        success: true,
        queued: counts.pending,
        processing: counts.processing,
        completed: counts.completed,
        failed: counts.failed,
        total: (queueItems || []).length,
        failedReason: errorMessages.size > 0 ? Array.from(errorMessages).join('; ') : undefined,
      };
    },

    enabled: !!instructorCourseId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Poll every 10 seconds only while there's genuinely active work
      if (data?.processing && data.processing > 0) {
        return 10_000;
      }
      if (data?.queued && data.queued > 0) {
        return 10_000;
      }
      // Stop polling when idle — no active processing or queued items
      return false;
    },
    staleTime: 10_000,
  });
}

// ============================================================================
// useRetryFailedImages
// ============================================================================
//
// Resets failed image queue items back to pending and auto-triggers processing.
//
// USAGE:
//   const retryImages = useRetryFailedImages();
//   retryImages.mutate({ instructorCourseId });
//

export function useRetryFailedImages() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ instructorCourseId }: { instructorCourseId: string }) => {
      // Step 1: Reset failed items via edge function
      const { data, error } = await supabase.functions.invoke('process-batch-images', {
        body: { reset_failed: true, instructor_course_id: instructorCourseId },
      });

      if (error) {
        console.error('[ImageGen] Reset failed error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.message || 'Failed to reset images');
      }

      return data as { success: boolean; message: string; reset: number; continuing: boolean };
    },

    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['image-generation-status', variables.instructorCourseId] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides', variables.instructorCourseId] });

      toast({
        title: '🔄 Retrying Failed Images',
        description: data.message || `Reset ${data.reset} images for retry.`,
      });
    },

    onError: (error: Error) => {
      console.error('[ImageGen] Retry failed:', error);
      toast({
        title: 'Retry Failed',
        description: error.message || 'Failed to retry images.',
        variant: 'destructive',
      });
    },
  });
}
