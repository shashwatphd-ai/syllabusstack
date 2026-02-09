/**
 * Lecture Slides Queue Hooks
 *
 * Contains hooks for bulk operations and queue management.
 *
 * CONSOLIDATION NOTE (2026-02):
 * Previously called the deprecated `process-lecture-queue` function.
 * Now uses `submit-batch-slides` + `process-batch-research` for batch
 * generation, and direct DB queries for status/cleanup/retry operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { QueueStatus } from './types';

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
 * Uses submit-batch-slides → process-batch-research pipeline
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
      // Step 1: Create placeholder records via submit-batch-slides
      const { data: submitData, error: submitError } = await supabase.functions.invoke('submit-batch-slides', {
        body: {
          instructor_course_id: instructorCourseId,
          teaching_unit_ids: teachingUnitIds,
        }
      });

      if (submitError) throw submitError;
      if (!submitData?.success) throw new Error(submitData?.error || 'Batch submission failed');

      const batchJobId = submitData.batch_job_id;

      // Step 2: Trigger research + generation (fire-and-forget, it self-continues)
      if (batchJobId) {
        supabase.functions.invoke('process-batch-research', {
          body: { batch_job_id: batchJobId }
        }).catch(err => {
          console.warn('[Queue] Failed to trigger batch research:', err);
        });
      }

      return {
        success: true,
        batch_job_id: batchJobId,
        queued: submitData.total || 0,
        skipped: submitData.skipped || 0,
      };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides', variables.instructorCourseId] });
      queryClient.invalidateQueries({ queryKey: ['lecture-queue-status', variables.instructorCourseId] });

      toast({
        title: 'Slides Queued for Generation',
        description: `Queued ${data.queued} teaching units. Generation will proceed automatically.${data.skipped > 0 ? ` Skipped ${data.skipped} already completed.` : ''}`,
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
 * Get queue status for a course (direct DB query, no deprecated function)
 */
export function useQueueStatus(instructorCourseId?: string) {
  return useQuery({
    queryKey: ['lecture-queue-status', instructorCourseId],
    queryFn: async (): Promise<QueueStatus> => {
      const { data, error } = await supabase
        .from('lecture_slides')
        .select('status')
        .eq('instructor_course_id', instructorCourseId!);

      if (error) throw error;

      const slides = data || [];
      return {
        success: true,
        pending: slides.filter(s => s.status === 'pending' || s.status === 'preparing' || s.status === 'batch_pending').length,
        generating: slides.filter(s => s.status === 'generating').length,
        ready: slides.filter(s => s.status === 'ready').length,
        published: slides.filter(s => s.status === 'published').length,
        failed: slides.filter(s => s.status === 'failed').length,
        total: slides.length,
      };
    },
    enabled: !!instructorCourseId,
    refetchInterval: (query) => {
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
 * Cleanup stuck generating records (direct DB operation)
 */
export function useCleanupStuckSlides() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      // Reset slides stuck in 'generating' for more than 10 minutes
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('lecture_slides')
        .update({ status: 'pending', error_message: 'Reset from stuck generating state' })
        .eq('status', 'generating')
        .lt('updated_at', tenMinutesAgo)
        .select('id');

      if (error) throw error;
      return { reset: data?.length || 0 };
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
      const { data, error } = await supabase
        .from('lecture_slides')
        .update({ status: 'pending', error_message: null })
        .eq('instructor_course_id', instructorCourseId)
        .eq('status', 'failed')
        .select('id');

      if (error) throw error;
      return { reset: data?.length || 0 };
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
