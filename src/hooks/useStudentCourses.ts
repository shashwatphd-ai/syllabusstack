import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface StudentEnrollment {
  id: string;
  student_id: string;
  instructor_course_id: string;
  enrolled_at: string;
  completed_at: string | null;
  overall_progress: number;
  instructor_course: {
    id: string;
    title: string;
    code: string | null;
    description: string | null;
    instructor_id: string;
    verification_threshold: number;
    is_published: boolean;
  };
}

export interface CourseWithModules {
  id: string;
  title: string;
  code: string | null;
  description: string | null;
  verification_threshold: number;
  modules: {
    id: string;
    title: string;
    description: string | null;
    sequence_order: number;
    learning_objectives: {
      id: string;
      text: string;
      bloom_level: string | null;
      verification_state: string;
      expected_duration_minutes: number | null;
    }[];
  }[];
}

// Fetch student's enrolled courses
export function useStudentEnrollments() {
  return useQuery({
    queryKey: ['student-enrollments'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('course_enrollments')
        .select(`
          *,
          instructor_course:instructor_courses (
            id,
            title,
            code,
            description,
            instructor_id,
            verification_threshold,
            is_published
          )
        `)
        .eq('student_id', user.id)
        .order('enrolled_at', { ascending: false });

      if (error) throw error;
      return data as StudentEnrollment[];
    },
  });
}

// Fetch a single enrolled course with modules and learning objectives
export function useEnrolledCourseDetail(courseId: string | undefined) {
  return useQuery({
    queryKey: ['enrolled-course-detail', courseId],
    queryFn: async () => {
      if (!courseId) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Verify enrollment
      const { data: enrollment, error: enrollError } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('student_id', user.id)
        .eq('instructor_course_id', courseId)
        .maybeSingle();

      if (enrollError) throw enrollError;
      if (!enrollment) throw new Error('Not enrolled in this course');

      // Fetch course with modules
      const { data: course, error: courseError } = await supabase
        .from('instructor_courses')
        .select('id, title, code, description, verification_threshold')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;

      // Fetch modules
      const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select('id, title, description, sequence_order')
        .eq('instructor_course_id', courseId)
        .order('sequence_order', { ascending: true });

      if (modulesError) throw modulesError;

      // Fetch ALL learning objectives for this course in ONE query (fixes N+1)
      // Then group by module_id in-memory (O(n))
      const { data: allLOs, error: losError } = await supabase
        .from('learning_objectives')
        .select('id, text, bloom_level, verification_state, expected_duration_minutes, module_id')
        .eq('instructor_course_id', courseId)
        .order('sequence_order', { ascending: true });

      if (losError) throw losError;

      // Group LOs by module_id for O(1) lookups
      const losByModule = new Map<string | null, typeof allLOs>();
      allLOs?.forEach(lo => {
        const key = lo.module_id;
        const existing = losByModule.get(key) || [];
        existing.push(lo);
        losByModule.set(key, existing);
      });

      // Attach LOs to their respective modules
      const modulesWithLOs = (modules || []).map(module => ({
        ...module,
        learning_objectives: losByModule.get(module.id) || [],
      }));

      // Get unassigned learning objectives (those without a module)
      const unassignedLOs = losByModule.get(null) || [];

      // If there are unassigned LOs, create a virtual "Course Objectives" module
      const allModules = [...modulesWithLOs];
      if (unassignedLOs && unassignedLOs.length > 0) {
        allModules.unshift({
          id: 'unassigned',
          title: 'Course Objectives',
          description: 'General learning objectives for this course',
          sequence_order: 0,
          learning_objectives: unassignedLOs,
        });
      }

      return {
        ...course,
        modules: allModules,
      } as CourseWithModules;
    },
    enabled: !!courseId,
  });
}

// Enroll in a course using access code
export function useEnrollWithAccessCode() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (accessCode: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Find course by access code
      const { data: course, error: courseError } = await supabase
        .from('instructor_courses')
        .select('id, title, is_published')
        .eq('access_code', accessCode.trim().toUpperCase())
        .maybeSingle();

      if (courseError) throw courseError;
      if (!course) throw new Error('Invalid access code');
      if (!course.is_published) throw new Error('This course is not yet published');

      // Check if already enrolled
      const { data: existing } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('student_id', user.id)
        .eq('instructor_course_id', course.id)
        .maybeSingle();

      if (existing) throw new Error('You are already enrolled in this course');

      // Create enrollment
      const { data: enrollment, error: enrollError } = await supabase
        .from('course_enrollments')
        .insert({
          student_id: user.id,
          instructor_course_id: course.id,
        })
        .select()
        .single();

      if (enrollError) throw enrollError;

      // Copy learning objectives for this student
      const { data: modules } = await supabase
        .from('modules')
        .select('id')
        .eq('instructor_course_id', course.id);

      if (modules && modules.length > 0) {
        // Get template LOs (created by instructor)
        const { data: templateLOs } = await supabase
          .from('learning_objectives')
          .select('*')
          .in('module_id', modules.map(m => m.id))
          .eq('user_id', course.id); // Template LOs might be stored differently

        // For now, we'll create student-specific LOs when they access the module
      }

      return { enrollment, course };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['student-enrollments'] });
      toast({
        title: 'Enrolled Successfully',
        description: `You are now enrolled in "${data.course.title}"`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Enrollment Failed',
        description: error instanceof Error ? error.message : 'Failed to enroll',
        variant: 'destructive',
      });
    },
  });
}

// Unenroll from a single course
export function useUnenrollFromCourse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase
        .from('course_enrollments')
        .delete()
        .eq('id', enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-enrollments'] });
      toast({ title: 'Unenrolled from course' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to unenroll',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}

// Bulk unenroll from multiple courses
export function useBulkUnenroll() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (enrollmentIds: string[]) => {
      const { error } = await supabase
        .from('course_enrollments')
        .delete()
        .in('id', enrollmentIds);
      if (error) throw error;
      return enrollmentIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['student-enrollments'] });
      toast({ title: `Dropped ${count} course${count > 1 ? 's' : ''}` });
    },
    onError: (error) => {
      toast({
        title: 'Failed to drop courses',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}

// Mark course(s) as completed
export function useMarkCoursesCompleted() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (enrollmentIds: string[]) => {
      const { error } = await supabase
        .from('course_enrollments')
        .update({ completed_at: new Date().toISOString(), overall_progress: 100 })
        .in('id', enrollmentIds);
      if (error) throw error;
      return enrollmentIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['student-enrollments'] });
      toast({ title: `Marked ${count} course${count > 1 ? 's' : ''} as completed` });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update courses',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}

// Get consumption progress for a learning objective
export function useLearningObjectiveProgress(learningObjectiveId: string | undefined) {
  return useQuery({
    queryKey: ['lo-progress', learningObjectiveId],
    queryFn: async () => {
      if (!learningObjectiveId) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get the learning objective
      const { data: lo, error: loError } = await supabase
        .from('learning_objectives')
        .select('*, course:courses(title)')
        .eq('id', learningObjectiveId)
        .single();

      if (loError) throw loError;

      // Get matched content
      const { data: matches, error: matchError } = await supabase
        .from('content_matches')
        .select(`
          *,
          content:content (*)
        `)
        .eq('learning_objective_id', learningObjectiveId)
        .in('status', ['approved', 'auto_approved'])
        .order('match_score', { ascending: false });

      if (matchError) throw matchError;

      // Get consumption records for this LO
      const { data: consumption, error: consumeError } = await supabase
        .from('consumption_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('learning_objective_id', learningObjectiveId);

      if (consumeError) throw consumeError;

      return {
        learningObjective: lo,
        matchedContent: matches || [],
        consumptionRecords: consumption || [],
      };
    },
    enabled: !!learningObjectiveId,
  });
}
