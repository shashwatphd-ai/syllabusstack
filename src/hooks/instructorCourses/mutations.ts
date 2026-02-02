/**
 * Instructor Courses Mutation Hooks
 *
 * Contains hooks for creating, updating, deleting courses and modules.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query-keys';
import type { InstructorCourse, Module } from './types';

// Create a new instructor course
export function useCreateInstructorCourse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (course: Omit<InstructorCourse, 'id' | 'instructor_id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate batch of candidate access codes and check all at once (N+1 fix)
      const candidates = Array.from({ length: 10 }, () =>
        Math.random().toString(36).substring(2, 8).toUpperCase()
      );

      const { data: existing } = await supabase
        .from('instructor_courses')
        .select('access_code')
        .in('access_code', candidates);

      const existingCodes = new Set(existing?.map(e => e.access_code) || []);
      const accessCode = candidates.find(c => !existingCodes.has(c));

      if (!accessCode) {
        throw new Error('Failed to generate unique access code. Please try again.');
      }

      const { data, error } = await supabase
        .from('instructor_courses')
        .insert({
          ...course,
          instructor_id: user.id,
          access_code: accessCode,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.instructorCourses.all });
      toast({
        title: 'Course Created',
        description: 'Your new course has been created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create course',
        variant: 'destructive',
      });
    },
  });
}

// Update an instructor course
export function useUpdateInstructorCourse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ courseId, updates }: { courseId: string; updates: Partial<InstructorCourse> }) => {
      const { data, error } = await supabase
        .from('instructor_courses')
        .update(updates)
        .eq('id', courseId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.instructorCourses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.instructorCourses.detail(data.id) });
      toast({
        title: 'Course Updated',
        description: 'Your course has been updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update course',
        variant: 'destructive',
      });
    },
  });
}

// Delete an instructor course
export function useDeleteInstructorCourse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase
        .from('instructor_courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;
      return courseId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.instructorCourses.all });
      toast({
        title: 'Course Deleted',
        description: 'The course has been permanently deleted',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete course',
        variant: 'destructive',
      });
    },
  });
}

// Duplicate an instructor course
export function useDuplicateInstructorCourse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (courseId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get the original course
      const { data: original, error: fetchError } = await supabase
        .from('instructor_courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (fetchError) throw fetchError;

      // Generate batch of candidate access codes and check all at once (N+1 fix)
      const candidates = Array.from({ length: 10 }, () =>
        Math.random().toString(36).substring(2, 8).toUpperCase()
      );

      const { data: existingCodes } = await supabase
        .from('instructor_courses')
        .select('access_code')
        .in('access_code', candidates);

      const existingSet = new Set(existingCodes?.map(e => e.access_code) || []);
      const accessCode = candidates.find(c => !existingSet.has(c));

      if (!accessCode) {
        throw new Error('Failed to generate unique access code. Please try again.');
      }

      // Create duplicate
      const { data: newCourse, error: createError } = await supabase
        .from('instructor_courses')
        .insert({
          instructor_id: user.id,
          title: `${original.title} (Copy)`,
          code: original.code ? `${original.code}-COPY` : null,
          description: original.description,
          curation_mode: original.curation_mode,
          verification_threshold: original.verification_threshold,
          is_published: false, // Always start as draft
          access_code: accessCode,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Copy modules
      const { data: modules } = await supabase
        .from('modules')
        .select('*')
        .eq('instructor_course_id', courseId)
        .order('sequence_order');

      if (modules && modules.length > 0) {
        // Batch insert all modules at once instead of sequential loop
        const { data: newModules } = await supabase
          .from('modules')
          .insert(modules.map(mod => ({
            instructor_course_id: newCourse.id,
            title: mod.title,
            description: mod.description,
            sequence_order: mod.sequence_order,
          })))
          .select()
          .order('sequence_order', { ascending: true });

        // Build module mapping from original order (sequence_order preserved)
        const moduleMapping: Record<string, string> = {};
        if (newModules) {
          modules.forEach((oldMod) => {
            const newMod = newModules.find(m => m.sequence_order === oldMod.sequence_order);
            if (newMod) {
              moduleMapping[oldMod.id] = newMod.id;
            }
          });
        }

        // Copy learning objectives
        const { data: los } = await supabase
          .from('learning_objectives')
          .select('*')
          .eq('instructor_course_id', courseId);

        if (los && los.length > 0) {
          await supabase.from('learning_objectives').insert(
            los.map(lo => ({
              instructor_course_id: newCourse.id,
              user_id: user.id,
              module_id: lo.module_id ? moduleMapping[lo.module_id] : null,
              text: lo.text,
              bloom_level: lo.bloom_level,
              expected_duration_minutes: lo.expected_duration_minutes,
              sequence_order: lo.sequence_order,
              core_concept: lo.core_concept,
              action_verb: lo.action_verb,
              domain: lo.domain,
              search_keywords: lo.search_keywords,
            }))
          );
        }
      }

      return newCourse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.instructorCourses.all });
      toast({
        title: 'Course Duplicated',
        description: 'A copy of the course has been created',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to duplicate course',
        variant: 'destructive',
      });
    },
  });
}

// Create a new module
export function useCreateModule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (module: Omit<Module, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('modules')
        .insert(module)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.modules.list(data.instructor_course_id) });
      toast({
        title: 'Module Created',
        description: 'New module has been added to the course',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create module',
        variant: 'destructive',
      });
    },
  });
}

// Delete a module
export function useDeleteModule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ moduleId, courseId }: { moduleId: string; courseId: string }) => {
      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', moduleId);

      if (error) throw error;
      return { moduleId, courseId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.modules.list(data.courseId) });
      toast({
        title: 'Module Deleted',
        description: 'The module has been removed from the course',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete module',
        variant: 'destructive',
      });
    },
  });
}
