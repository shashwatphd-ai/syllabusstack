/**
 * Course Students Progress Hook
 *
 * Fetches enrolled students and their progress for an instructor course.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import type { CourseStudentsProgress, EnrolledStudent, StudentLOProgress } from './types';

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
