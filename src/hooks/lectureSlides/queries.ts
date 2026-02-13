/**
 * Lecture Slides Query Hooks
 *
 * Contains all read-only query hooks for fetching lecture slides data.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import type { LectureSlide, Slide } from './types';

/**
 * Fetch lecture slides for a specific teaching unit
 */
export function useLectureSlides(teachingUnitId?: string) {
  return useQuery({
    queryKey: ['lecture-slides', teachingUnitId],
    queryFn: async () => {
      if (!teachingUnitId) return null;

      const { data, error } = await supabase
        .from('lecture_slides')
        .select('*')
        .eq('teaching_unit_id', teachingUnitId)
        .maybeSingle();

      if (error) throw error;

      // Parse slides from JSONB
      if (data) {
        return {
          ...data,
          slides: (data.slides as unknown as Slide[]) || [],
        } as LectureSlide;
      }

      return null;
    },
    enabled: !!teachingUnitId,
  });
}

/**
 * Fetch a single lecture slide by ID (for student slide page)
 */
export function useLectureSlide(slideId?: string) {
  return useQuery({
    queryKey: ['lecture-slide', slideId],
    queryFn: async () => {
      if (!slideId) return null;

      const { data, error } = await supabase
        .from('lecture_slides')
        .select('*')
        .eq('id', slideId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return {
          ...data,
          slides: (data.slides as unknown as Slide[]) || [],
        } as LectureSlide;
      }

      return null;
    },
    enabled: !!slideId,
  });
}

/**
 * Fetch all lecture slides for a course, ordered by teaching unit sequence.
 * Includes Realtime subscription for auto-updating status changes.
 */
export function useCourseLectureSlides(instructorCourseId?: string) {
  const queryClient = useQueryClient();

  // Set up Realtime subscription for status changes — throttled to avoid
  // cascading re-fetches during batch operations (audio, images, slides).
  useEffect(() => {
    if (!instructorCourseId) return;

    const channelName = `lecture-slides-${instructorCourseId}`;

    // Check if channel already exists
    const existingChannels = supabase.getChannels();
    const existingChannel = existingChannels.find(ch => ch.topic === `realtime:${channelName}`);
    if (existingChannel) {
      return;
    }

    // Throttle: at most one invalidation per 5 seconds during batch ops
    let lastInvalidation = 0;
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

    const throttledInvalidate = (payload: any) => {
      const now = Date.now();
      const elapsed = now - lastInvalidation;

      const doInvalidate = () => {
        lastInvalidation = Date.now();
        queryClient.invalidateQueries({
          queryKey: ['course-lecture-slides', instructorCourseId]
        });
        // Also invalidate specific teaching unit query if available
        if (payload?.new && typeof payload.new === 'object' && 'teaching_unit_id' in payload.new) {
          queryClient.invalidateQueries({
            queryKey: ['lecture-slides', (payload.new as { teaching_unit_id: string }).teaching_unit_id]
          });
        }
      };

      if (elapsed >= 5000) {
        doInvalidate();
      } else if (!pendingTimeout) {
        pendingTimeout = setTimeout(() => {
          pendingTimeout = null;
          doInvalidate();
        }, 5000 - elapsed);
      }
    };

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lecture_slides',
          filter: `instructor_course_id=eq.${instructorCourseId}`,
        },
        throttledInvalidate
      )
      .subscribe();

    return () => {
      if (pendingTimeout) clearTimeout(pendingTimeout);
      supabase.removeChannel(channel);
    };
  }, [instructorCourseId, queryClient]);

  return useQuery({
    queryKey: ['course-lecture-slides', instructorCourseId],
    queryFn: async () => {
      if (!instructorCourseId) return [];

      // Fetch only the columns needed for the course detail page — avoid
      // pulling the full slides JSONB (which can be multi-MB) on every refetch.
      // The full JSONB is fetched on-demand by useLectureSlide(slideId).
      const { data, error } = await supabase
        .from('lecture_slides')
        .select(`
          id, title, status, has_audio, audio_status, teaching_unit_id,
          instructor_course_id, learning_objective_id, total_slides,
          estimated_duration_minutes, slide_style, error_message,
          created_at, updated_at,
          teaching_unit:teaching_units!teaching_unit_id (
            sequence_order
          )
        `)
        .eq('instructor_course_id', instructorCourseId);

      if (error) throw error;

      // Sort by teaching unit sequence order
      const sortedData = (data || []).sort((a, b) => {
        const aOrder = (a.teaching_unit as { sequence_order?: number })?.sequence_order ?? 999;
        const bOrder = (b.teaching_unit as { sequence_order?: number })?.sequence_order ?? 999;
        return aOrder - bOrder;
      });

      return sortedData.map(slide => ({
        ...slide,
        slides: (slide.slides as unknown as Slide[]) || [],
      })) as LectureSlide[];
    },
    enabled: !!instructorCourseId,
    staleTime: 10_000, // 10s — prevents cascading refetches from Realtime + polling
  });
}

/**
 * Fetch published slides for enrolled students, ordered by teaching unit sequence
 */
export function usePublishedLectureSlides(instructorCourseId?: string) {
  const queryClient = useQueryClient();

  // Subscribe to Realtime changes so students see newly published slides
  useEffect(() => {
    if (!instructorCourseId) return;

    const channelName = `published-slides-${instructorCourseId}`;
    // Avoid duplicate subscriptions
    const existing = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);
    if (existing) return;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lecture_slides',
          filter: `instructor_course_id=eq.${instructorCourseId}`,
        },
        () => {
          // Invalidate on next tick to avoid interference with Supabase callback
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['published-lecture-slides', instructorCourseId] });
          }, 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instructorCourseId, queryClient]);

  return useQuery({
    queryKey: ['published-lecture-slides', instructorCourseId],
    queryFn: async () => {
      if (!instructorCourseId) return [];

      // Join with teaching_units to get sequence_order for proper ordering
      const { data, error } = await supabase
        .from('lecture_slides')
        .select(`
          *,
          teaching_unit:teaching_units!teaching_unit_id (
            sequence_order
          )
        `)
        .eq('instructor_course_id', instructorCourseId)
        .eq('status', 'published');

      if (error) throw error;

      // Sort by teaching unit sequence order
      const sortedData = (data || []).sort((a, b) => {
        const aOrder = (a.teaching_unit as { sequence_order?: number })?.sequence_order ?? 999;
        const bOrder = (b.teaching_unit as { sequence_order?: number })?.sequence_order ?? 999;
        return aOrder - bOrder;
      });

      return sortedData.map(slide => ({
        ...slide,
        slides: (slide.slides as unknown as Slide[]) || [],
      })) as LectureSlide[];
    },
    enabled: !!instructorCourseId,
  });
}
