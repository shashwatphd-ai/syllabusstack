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

  // Set up Realtime subscription for status changes
  useEffect(() => {
    if (!instructorCourseId) return;

    const channelName = `lecture-slides-${instructorCourseId}`;

    // Check if channel already exists
    const existingChannels = supabase.getChannels();
    const existingChannel = existingChannels.find(ch => ch.topic === `realtime:${channelName}`);
    if (existingChannel) {
      return;
    }

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
        (payload) => {
          // Use setTimeout to ensure we're not in a render cycle
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ['course-lecture-slides', instructorCourseId]
            });
            queryClient.invalidateQueries({
              queryKey: ['lecture-queue-status', instructorCourseId]
            });

            // Also invalidate specific teaching unit query if available
            if (payload.new && typeof payload.new === 'object' && 'teaching_unit_id' in payload.new) {
              queryClient.invalidateQueries({
                queryKey: ['lecture-slides', (payload.new as { teaching_unit_id: string }).teaching_unit_id]
              });
            }
          }, 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instructorCourseId, queryClient]);

  return useQuery({
    queryKey: ['course-lecture-slides', instructorCourseId],
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
