/**
 * Lecture Slides Queue Hooks
 *
 * Contains hooks for bulk operations and queue management.
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
 * Uses the process-lecture-queue edge function to handle concurrency
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
      const { data, error } = await supabase.functions.invoke('process-lecture-queue', {
        body: {
          action: 'queue-bulk',
          instructor_course_id: instructorCourseId,
          teaching_unit_ids: teachingUnitIds,
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Queue operation failed');

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides', variables.instructorCourseId] });

      toast({
        title: 'Slides Queued for Generation',
        description: `Queued ${data.queued} teaching units. Generation will proceed automatically (max 2 at a time).${data.skipped > 0 ? ` Skipped ${data.skipped} already completed.` : ''}`,
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
 * Get queue status for a course
 */
export function useQueueStatus(instructorCourseId?: string) {
  return useQuery({
    queryKey: ['lecture-queue-status', instructorCourseId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-lecture-queue', {
        body: {
          action: 'get-status',
          instructor_course_id: instructorCourseId,
        }
      });

      if (error) throw error;
      return data as QueueStatus;
    },
    enabled: !!instructorCourseId,
    refetchInterval: (query) => {
      // Auto-refetch every 5 seconds if there are pending or generating items
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
 * Cleanup stuck generating records
 */
export function useCleanupStuckSlides() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-lecture-queue', {
        body: { action: 'cleanup-stuck' }
      });

      if (error) throw error;
      return data;
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
      const { data, error } = await supabase.functions.invoke('process-lecture-queue', {
        body: {
          action: 'retry-failed',
          instructor_course_id: instructorCourseId,
        }
      });

      if (error) throw error;
      return data;
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
