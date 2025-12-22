import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface InstructorCourse {
  id: string;
  instructor_id: string;
  title: string;
  code: string | null;
  description: string | null;
  curation_mode: 'full_control' | 'guided_auto' | 'hands_off';
  verification_threshold: number;
  is_published: boolean;
  access_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: string;
  instructor_course_id: string;
  title: string;
  description: string | null;
  sequence_order: number;
  created_at: string;
  updated_at: string;
}

// Fetch instructor's courses
export function useInstructorCourses() {
  return useQuery({
    queryKey: ['instructor-courses'],
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
    queryKey: ['instructor-course', courseId],
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
    queryKey: ['modules', courseId],
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

// Create a new instructor course
export function useCreateInstructorCourse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (course: Omit<InstructorCourse, 'id' | 'instructor_id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate a unique access code
      const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();

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
      queryClient.invalidateQueries({ queryKey: ['instructor-courses'] });
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
      queryClient.invalidateQueries({ queryKey: ['instructor-courses'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-course', data.id] });
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
      queryClient.invalidateQueries({ queryKey: ['modules', data.instructor_course_id] });
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
      queryClient.invalidateQueries({ queryKey: ['modules', data.courseId] });
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
