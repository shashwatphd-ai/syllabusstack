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

// Student progress interfaces
export interface EnrolledStudent {
  id: string;
  student_id: string;
  enrolled_at: string;
  overall_progress: number;
  completed_at: string | null;
  profile: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export interface StudentLOProgress {
  learning_objective_id: string;
  verification_state: string | null;
  content_watched: number;
  micro_checks_passed: number;
}

export interface CourseStudentsProgress {
  enrollments: EnrolledStudent[];
  totalLOs: number;
  loProgress: Record<string, StudentLOProgress[]>; // student_id -> LO progress
}

// Fetch enrolled students and their progress for a course
export function useCourseStudents(courseId?: string) {
  return useQuery({
    queryKey: ['course-students', courseId],
    queryFn: async (): Promise<CourseStudentsProgress> => {
      if (!courseId) return { enrollments: [], totalLOs: 0, loProgress: {} };

      // Get enrollments with profile info
      const { data: enrollments, error: enrollError } = await supabase
        .from('course_enrollments')
        .select(`
          id,
          student_id,
          enrolled_at,
          overall_progress,
          completed_at
        `)
        .eq('instructor_course_id', courseId)
        .order('enrolled_at', { ascending: false });

      if (enrollError) throw enrollError;

      // Get profiles for enrolled students
      const studentIds = enrollments?.map(e => e.student_id) || [];
      let profiles: Record<string, { full_name: string | null; email: string | null }> = {};

      if (studentIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', studentIds);

        if (profileData) {
          profiles = profileData.reduce((acc, p) => {
            acc[p.id] = { full_name: p.full_name, email: p.email };
            return acc;
          }, {} as Record<string, { full_name: string | null; email: string | null }>);
        }
      }

      // Get total LOs for the course
      const { data: los, error: loError } = await supabase
        .from('learning_objectives')
        .select('id')
        .eq('instructor_course_id', courseId);

      if (loError) throw loError;
      const totalLOs = los?.length || 0;

      // Get consumption records for all students in this course
      const loProgress: Record<string, StudentLOProgress[]> = {};

      if (studentIds.length > 0 && los && los.length > 0) {
        const loIds = los.map(lo => lo.id);

        // Get consumption records for these students and LOs
        const { data: consumption } = await supabase
          .from('consumption_records')
          .select('user_id, learning_objective_id, watch_percentage, is_verified')
          .in('user_id', studentIds)
          .in('learning_objective_id', loIds);

        // Get LO verification states
        const { data: loStates } = await supabase
          .from('learning_objectives')
          .select('id, verification_state, user_id')
          .in('id', loIds);

        // Build progress map for each student
        for (const studentId of studentIds) {
          const studentConsumption = consumption?.filter(c => c.user_id === studentId) || [];
          const studentProgress: StudentLOProgress[] = [];

          for (const lo of los) {
            const consumptionRecord = studentConsumption.find(c => c.learning_objective_id === lo.id);
            const loState = loStates?.find(s => s.id === lo.id);

            studentProgress.push({
              learning_objective_id: lo.id,
              verification_state: loState?.verification_state || 'unstarted',
              content_watched: consumptionRecord?.watch_percentage || 0,
              micro_checks_passed: consumptionRecord?.is_verified ? 1 : 0,
            });
          }

          loProgress[studentId] = studentProgress;
        }
      }

      // Combine enrollments with profiles
      const enrichedEnrollments: EnrolledStudent[] = (enrollments || []).map(e => ({
        ...e,
        profile: profiles[e.student_id] || null,
      }));

      return {
        enrollments: enrichedEnrollments,
        totalLOs,
        loProgress,
      };
    },
    enabled: !!courseId,
  });
}
