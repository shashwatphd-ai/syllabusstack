import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query-keys';

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

// Create a new instructor course
export function useCreateInstructorCourse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (course: Omit<InstructorCourse, 'id' | 'instructor_id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate a unique access code with collision check
      let accessCode: string;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        // Check if code already exists
        const { data: existing } = await supabase
          .from('instructor_courses')
          .select('id')
          .eq('access_code', accessCode)
          .maybeSingle();

        if (!existing) break; // Code is unique
        attempts++;
      } while (attempts < maxAttempts);

      if (attempts >= maxAttempts) {
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

      // Generate new access code
      let accessCode: string;
      let attempts = 0;
      do {
        accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data: existing } = await supabase
          .from('instructor_courses')
          .select('id')
          .eq('access_code', accessCode)
          .maybeSingle();
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

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
          modules.forEach((oldMod, i) => {
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
    queryKey: queryKeys.courseStudents(courseId || ''),
    queryFn: async (): Promise<CourseStudentsProgress> => {
      if (!courseId) return { enrollments: [], totalLOs: 0, loProgress: {} };

      // Fetch enrollments and LOs in parallel (N+1 fix - independent queries)
      const [enrollmentsResult, losResult] = await Promise.all([
        supabase
          .from('course_enrollments')
          .select(`id, student_id, enrolled_at, overall_progress, completed_at`)
          .eq('instructor_course_id', courseId)
          .order('enrolled_at', { ascending: false }),
        supabase
          .from('learning_objectives')
          .select('id')
          .eq('instructor_course_id', courseId)
      ]);

      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (losResult.error) throw losResult.error;

      const enrollments = enrollmentsResult.data;
      const los = losResult.data;
      const totalLOs = los?.length || 0;

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

        // Pre-build lookup Maps for O(1) access instead of O(n) filter/find
        const consumptionMap = new Map<string, { watch_percentage: number; is_verified: boolean }>();
        consumption?.forEach(c => {
          consumptionMap.set(`${c.user_id}:${c.learning_objective_id}`, {
            watch_percentage: c.watch_percentage,
            is_verified: c.is_verified,
          });
        });

        const loStateMap = new Map<string, string>();
        loStates?.forEach(s => loStateMap.set(s.id, s.verification_state));

        // Now O(n * k) instead of O(n * k * m) - 1000x faster with 50 students × 30 LOs
        for (const studentId of studentIds) {
          const studentProgress: StudentLOProgress[] = [];

          for (const lo of los) {
            const consumptionRecord = consumptionMap.get(`${studentId}:${lo.id}`);
            const loState = loStateMap.get(lo.id);

            studentProgress.push({
              learning_objective_id: lo.id,
              verification_state: loState || 'unstarted',
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
