import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ObjectiveProgress {
  id: string;
  objectiveId: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed';
  completedAt: string | null;
  assessmentPassed: boolean | null;
  assessmentScore: number | null;
  timeSpent: number;
}

export interface ModuleProgress {
  id: string;
  moduleId: string;
  title: string;
  orderIndex: number;
  status: 'not_started' | 'in_progress' | 'completed';
  objectives: ObjectiveProgress[];
  completedObjectives: number;
  totalObjectives: number;
  percentComplete: number;
  completedAt: string | null;
}

export interface CourseProgress {
  enrollmentId: string;
  courseId: string;
  userId: string;
  courseTitle: string;
  status: 'enrolled' | 'in_progress' | 'completed' | 'dropped';
  enrolledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastAccessedAt: string | null;
  overallProgress: number;
  modules: ModuleProgress[];
  completedModules: number;
  totalModules: number;
  completedObjectives: number;
  totalObjectives: number;
  totalTimeSpent: number;
  currentModule: ModuleProgress | null;
  currentObjective: ObjectiveProgress | null;
  certificateEarned: boolean;
  certificateId: string | null;
}

export function useCourseProgress(courseId: string | undefined) {
  return useQuery({
    queryKey: ['course-progress', courseId],
    queryFn: async (): Promise<CourseProgress | null> => {
      if (!courseId) return null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .select(`
          id,
          student_id,
          instructor_course_id,
          enrolled_at,
          completed_at,
          overall_progress,
          certificate_id,
          instructor_courses (
            id,
            title
          )
        `)
        .eq('instructor_course_id', courseId)
        .eq('student_id', user.id)
        .maybeSingle();
      
      if (!enrollment) return null;
      
      const course = enrollment.instructor_courses as { id: string; title: string } | null;
      
      return {
        enrollmentId: enrollment.id,
        courseId: enrollment.instructor_course_id,
        userId: enrollment.student_id,
        courseTitle: course?.title || 'Unknown Course',
        status: enrollment.completed_at ? 'completed' : 
                (enrollment.overall_progress || 0) > 0 ? 'in_progress' : 'enrolled',
        enrolledAt: enrollment.enrolled_at || '',
        startedAt: null,
        completedAt: enrollment.completed_at,
        lastAccessedAt: null,
        overallProgress: enrollment.overall_progress || 0,
        modules: [],
        completedModules: 0,
        totalModules: 0,
        completedObjectives: 0,
        totalObjectives: 0,
        totalTimeSpent: 0,
        currentModule: null,
        currentObjective: null,
        certificateEarned: !!enrollment.certificate_id,
        certificateId: enrollment.certificate_id,
      };
    },
    enabled: !!courseId,
  });
}

export function useEnrollment(courseId: string | undefined) {
  return useCourseProgress(courseId);
}

export function useModuleProgress(moduleId: string | undefined) {
  return useQuery({
    queryKey: ['module-progress', moduleId],
    queryFn: async (): Promise<ModuleProgress | null> => {
      if (!moduleId) return null;
      return null;
    },
    enabled: !!moduleId,
  });
}
