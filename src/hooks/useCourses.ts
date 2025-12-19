import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

// Types from database
export type Course = Tables<'courses'>;
export type CourseInsert = TablesInsert<'courses'>;

export interface CourseCapability {
  id: string;
  course_id: string;
  capability_name: string;
  proficiency_level: number;
  evidence: string;
  category: string;
}

// Fetch all courses for the current user
async function fetchCourses(): Promise<Course[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Fetch a single course by ID
async function fetchCourseById(id: string): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

// Create a new course
async function createCourse(course: Omit<CourseInsert, 'user_id'>): Promise<Course> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('courses')
    .insert({ ...course, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete a course
async function deleteCourse(id: string): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Hooks
export function useCourses() {
  return useQuery({
    queryKey: queryKeys.coursesList(),
    queryFn: fetchCourses,
  });
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: queryKeys.courseDetail(id),
    queryFn: () => fetchCourseById(id),
    enabled: !!id,
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      // Invalidate related queries for cache consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.courses });
      queryClient.invalidateQueries({ queryKey: queryKeys.capabilities });
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast({
        title: 'Course added',
        description: 'Your course has been added successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add course',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Course> }) => {
      const { data, error } = await supabase
        .from('courses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses });
      queryClient.invalidateQueries({ queryKey: queryKeys.courseDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.capabilities });
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
      toast({
        title: 'Course updated',
        description: 'Your course has been updated.',
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

export function useDeleteCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses });
      queryClient.invalidateQueries({ queryKey: queryKeys.capabilities });
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast({
        title: 'Course deleted',
        description: 'Your course has been removed.',
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
