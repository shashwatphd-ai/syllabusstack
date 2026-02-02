/**
 * Instructor Courses Query Hooks
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import type { InstructorCourse, Module } from './types';

// Fetch instructor's courses
export function useInstructorCourses() {
  return useQuery({
    queryKey: queryKeys.instructorCourses.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructor_courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as InstructorCourse[];
    },
  });
}

// Fetch a single instructor course with modules
export function useInstructorCourse(courseId?: string) {
  return useQuery({
    queryKey: queryKeys.instructorCourses.detail(courseId || ''),
    queryFn: async () => {
      if (!courseId) return null;

      const { data, error } = await supabase
        .from('instructor_courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (error) throw error;
      return data as InstructorCourse;
    },
    enabled: !!courseId,
  });
}

// Fetch modules for a course
export function useModules(courseId?: string) {
  return useQuery({
    queryKey: queryKeys.modules.list(courseId || ''),
    queryFn: async () => {
      if (!courseId) return [];

      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('instructor_course_id', courseId)
        .order('sequence_order', { ascending: true });

      if (error) throw error;
      return data as Module[];
    },
    enabled: !!courseId,
  });
}
