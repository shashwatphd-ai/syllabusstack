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
      console.log(`[Batch] Submitting ${teachingUnitIds.length} units for batch generation`);

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

      console.log(`[Batch] Placeholders created, batch_job_id: ${submitData.batch_job_id}`);

      // STEP 2: Start research and Vertex AI submission (slow, runs in background)
      // This call may take 2-5 minutes for large batches
      if (submitData.batch_job_id && submitData.total > 0) {
        console.log(`[Batch] Starting research for ${submitData.total} units...`);

        // Fire and don't wait - let it run in background
        // The poll-batch-status will track progress
        supabase.functions.invoke('process-batch-research', {
          body: { batch_job_id: submitData.batch_job_id },
        }).then(({ data: researchData, error: researchError }) => {
          if (researchError) {
            console.error('[Batch] Research error:', researchError);
          } else {
            console.log('[Batch] Research started:', researchData);
          }
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

    // Only enable if we have a batch job ID
    enabled: !!batchJobId,

    // Poll every 30 seconds (more conservative than old 5s queue polling)
    // Google recommends conservative polling for Batch API
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling if job is complete
      if (data?.is_complete) {
        return false;
      }
      // Poll every 30 seconds while in progress
      return 30000;
    },

    // Keep data fresh but not too aggressive
    staleTime: 10000,
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

    // Poll every 30 seconds if there's an active batch OR we still have work in-flight.
    // This makes the UI resilient when Realtime events are delayed/blocked.
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasWorkInFlight = !!data?.active_batch || (data?.batch_pending ?? 0) > 0 || (data?.generating ?? 0) > 0;
      if (hasWorkInFlight) {
        return 30000; // Conservative polling - aligns with provider recommendations
      }
      return false;
    },

    staleTime: 5000,
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
}

export function useTriggerImageGeneration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ instructorCourseId }: { instructorCourseId: string }) => {
      console.log(`[ImageGen] Triggering image generation for course ${instructorCourseId}`);

      const { data, error } = await supabase.functions.invoke('process-batch-images', {
        body: { instructor_course_id: instructorCourseId },
      });

      if (error) {
        console.error('[ImageGen] Trigger error:', error);
        throw error;
      }

      return data as ImageGenerationStatusResponse;
    },

    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course-slide-status', variables.instructorCourseId] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides', variables.instructorCourseId] });

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
        .select('status, lecture_slides!inner(instructor_course_id)')
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

      for (const item of queueItems || []) {
        if (item.status === 'pending') counts.pending++;
        else if (item.status === 'processing') counts.processing++;
        else if (item.status === 'completed') counts.completed++;
        else if (item.status === 'failed') counts.failed++;
      }

      return {
        success: true,
        queued: counts.pending,
        processing: counts.processing,
        completed: counts.completed,
        failed: counts.failed,
        total: (queueItems || []).length,
      };
    },

    enabled: !!instructorCourseId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Poll every 10 seconds while there's active work
      if (data?.processing && data.processing > 0) {
        return 10000;
      }
      if (data?.queued && data.queued > 0) {
        return 10000;
      }
      return false;
    },
    staleTime: 5000,
  });
}
