/**
 * useCourseProgress.ts
 *
 * PURPOSE: Track student progress through instructor courses.
 *
 * WHY THIS WAS CREATED:
 * - Test file useCourseProgress.test.ts exists expecting this hook
 * - Tests fail with "Cannot find module './useCourseProgress'"
 * - Part of MASTER_IMPLEMENTATION_PLAN.md Task 1.1.1
 *
 * WHAT THIS HOOK DOES:
 * - Fetches enrollment data for a student in a specific course
 * - Computes progress metrics (completed modules, objectives, time spent)
 * - Identifies current position in the course (current module/objective)
 * - Tracks certificate eligibility
 *
 * DATA FLOW:
 * course_enrollments → instructor_courses → course_modules → learning_objectives → assessment_sessions
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPE DEFINITIONS
// These interfaces match the test expectations in useCourseProgress.test.ts
// ============================================================================

/**
 * Progress tracking for a single learning objective within a module.
 *
 * WHY THESE FIELDS:
 * - id: Unique identifier for this progress record
 * - objectiveId: Links to learning_objectives table
 * - status: Tracks completion state for UI indicators
 * - assessmentPassed/Score: Links to assessment_sessions results
 * - timeSpent: Tracks engagement for analytics
 */
export interface ObjectiveProgress {
  id: string;
  objectiveId: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed';
  completedAt: string | null;
  assessmentPassed: boolean | null;
  assessmentScore: number | null;
  timeSpent: number; // seconds
}

/**
 * Progress tracking for a course module (collection of objectives).
 *
 * WHY THESE FIELDS:
 * - orderIndex: Determines display order and sequential progression
 * - objectives: Nested array for detailed drilling down
 * - percentComplete: Computed from completedObjectives/totalObjectives
 */
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

/**
 * Complete progress tracking for a student's course enrollment.
 *
 * WHY THESE FIELDS:
 * - status: enrollment status ('enrolled' | 'in_progress' | 'completed' | 'dropped')
 * - overallProgress: 0-100 percentage shown in UI progress bars
 * - modules: Full module tree for detailed progress view
 * - currentModule/Objective: Quick access to "where left off" for resume functionality
 * - certificateEarned: Unlocks certificate download when true
 */
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

// ============================================================================
// MAIN HOOK: useCourseProgress
// ============================================================================

/**
 * Fetches and computes course progress for the current user.
 *
 * @param courseId - The instructor_course_id to fetch progress for
 * @returns React Query result with CourseProgress data
 *
 * IMPLEMENTATION NOTES:
 * - Returns null if no courseId provided (enables conditional fetching)
 * - Returns null if user not authenticated
 * - Returns null if user not enrolled in course
 * - Computes derived fields (percentages, current position) from raw data
 */
export function useCourseProgress(courseId: string | undefined) {
  return useQuery({
    // Query key includes courseId for cache isolation per course
    queryKey: ['course-progress', courseId],

    queryFn: async (): Promise<CourseProgress | null> => {
      // GUARD: Don't query if no courseId
      if (!courseId) return null;

      // STEP 1: Get current user
      // WHY: Progress is user-specific, need user_id for enrollment lookup
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // STEP 2: Fetch enrollment with course details
      // WHY: course_enrollments is the source of truth for enrollment status
      // JOIN: instructor_courses for course title
      const { data: enrollment, error: enrollmentError } = await supabase
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

      // GUARD: No enrollment found - user not enrolled in this course
      if (enrollmentError || !enrollment) {
        return null;
      }

      // STEP 3: Extract course info from join
      // WHY: Supabase returns joined data as nested object or array
      const courseData = enrollment.instructor_courses as { id: string; title: string } | null;

      // STEP 4: Fetch modules for this course
      // WHY: Modules provide the structure for progress tracking
      const { data: modules } = await supabase
        .from('course_modules')
        .select(`
          id,
          title,
          order_index
        `)
        .eq('instructor_course_id', courseId)
        .order('order_index', { ascending: true });

      // STEP 5: Fetch learning objectives for all modules
      // WHY: Objectives are the atomic unit of progress
      const moduleIds = modules?.map(m => m.id) || [];
      const { data: objectives } = await supabase
        .from('learning_objectives')
        .select(`
          id,
          title,
          module_id,
          order_index
        `)
        .in('module_id', moduleIds.length > 0 ? moduleIds : ['none']);

      // STEP 6: Fetch assessment sessions for user
      // WHY: Assessment completion determines objective completion
      const { data: assessments } = await supabase
        .from('assessment_sessions')
        .select(`
          id,
          learning_objective_id,
          status,
          total_score,
          completed_at
        `)
        .eq('user_id', user.id)
        .eq('status', 'completed');

      // STEP 7: Build objective progress map
      // WHY: Need quick lookup of assessment results per objective
      const assessmentByObjective = new Map(
        assessments?.map(a => [a.learning_objective_id, a]) || []
      );

      // STEP 8: Build module progress with nested objectives
      // WHY: Transform raw data into the expected interface structure
      const moduleProgress: ModuleProgress[] = (modules || []).map(module => {
        const moduleObjectives = (objectives || [])
          .filter(o => o.module_id === module.id)
          .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

        // Build objective progress for this module
        const objProgress: ObjectiveProgress[] = moduleObjectives.map(obj => {
          const assessment = assessmentByObjective.get(obj.id);
          const isCompleted = !!assessment;

          return {
            id: `progress-${obj.id}`,
            objectiveId: obj.id,
            title: obj.title || 'Untitled Objective',
            status: isCompleted ? 'completed' : 'not_started',
            completedAt: assessment?.completed_at || null,
            assessmentPassed: assessment ? (assessment.total_score || 0) >= 70 : null,
            assessmentScore: assessment?.total_score || null,
            timeSpent: 0, // Would need consumption_records aggregation
          };
        });

        const completedCount = objProgress.filter(o => o.status === 'completed').length;
        const totalCount = objProgress.length;
        const isModuleComplete = totalCount > 0 && completedCount === totalCount;
        const hasStarted = completedCount > 0;

        return {
          id: `mod-progress-${module.id}`,
          moduleId: module.id,
          title: module.title || 'Untitled Module',
          orderIndex: module.order_index || 0,
          status: isModuleComplete ? 'completed' : hasStarted ? 'in_progress' : 'not_started',
          objectives: objProgress,
          completedObjectives: completedCount,
          totalObjectives: totalCount,
          percentComplete: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
          completedAt: isModuleComplete ? new Date().toISOString() : null, // Simplified
        };
      });

      // STEP 9: Compute aggregate metrics
      // WHY: Dashboard needs quick summary without traversing tree
      const totalModules = moduleProgress.length;
      const completedModules = moduleProgress.filter(m => m.status === 'completed').length;
      const totalObjectives = moduleProgress.reduce((sum, m) => sum + m.totalObjectives, 0);
      const completedObjectives = moduleProgress.reduce((sum, m) => sum + m.completedObjectives, 0);

      // STEP 10: Find current position (first non-completed module/objective)
      // WHY: "Continue where you left off" functionality
      const currentModule = moduleProgress.find(m => m.status === 'in_progress') ||
                           moduleProgress.find(m => m.status === 'not_started') || null;
      const currentObjective = currentModule?.objectives.find(o => o.status !== 'completed') || null;

      // STEP 11: Determine course status
      // WHY: Enrollment status determines UI state and available actions
      let status: CourseProgress['status'] = 'enrolled';
      if (enrollment.completed_at) {
        status = 'completed';
      } else if (completedObjectives > 0) {
        status = 'in_progress';
      }

      // STEP 12: Build and return final progress object
      return {
        enrollmentId: enrollment.id,
        courseId: enrollment.instructor_course_id,
        userId: enrollment.student_id,
        courseTitle: courseData?.title || 'Unknown Course',
        status,
        enrolledAt: enrollment.enrolled_at || new Date().toISOString(),
        startedAt: completedObjectives > 0 ? enrollment.enrolled_at : null,
        completedAt: enrollment.completed_at,
        lastAccessedAt: null, // Would need last_accessed_at column
        overallProgress: enrollment.overall_progress || 0,
        modules: moduleProgress,
        completedModules,
        totalModules,
        completedObjectives,
        totalObjectives,
        totalTimeSpent: 0, // Would need consumption_records aggregation
        currentModule,
        currentObjective,
        certificateEarned: !!enrollment.certificate_id,
        certificateId: enrollment.certificate_id,
      };
    },

    // Only run query if courseId is provided
    enabled: !!courseId,
  });
}

// ============================================================================
// ALIAS HOOK: useEnrollment
// ============================================================================

/**
 * Alias for useCourseProgress.
 *
 * WHY THIS EXISTS:
 * - Test file imports both useCourseProgress and useEnrollment
 * - Some components may prefer "enrollment" terminology
 * - Backward compatibility if hook was previously named differently
 */
export function useEnrollment(courseId: string | undefined) {
  return useCourseProgress(courseId);
}

// ============================================================================
// HELPER HOOK: useModuleProgress
// ============================================================================

/**
 * Fetches progress for a single module.
 *
 * @param moduleId - The course_module id to fetch progress for
 * @returns React Query result with ModuleProgress data
 *
 * WHY SEPARATE HOOK:
 * - Some views only need single module data
 * - Avoids fetching entire course progress
 * - Lighter weight for module-focused UIs
 */
export function useModuleProgress(moduleId: string | undefined) {
  return useQuery({
    queryKey: ['module-progress', moduleId],

    queryFn: async (): Promise<ModuleProgress | null> => {
      if (!moduleId) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Fetch module with its objectives
      const { data: module } = await supabase
        .from('course_modules')
        .select(`
          id,
          title,
          order_index,
          learning_objectives (
            id,
            title,
            order_index
          )
        `)
        .eq('id', moduleId)
        .single();

      if (!module) return null;

      // Fetch user's assessments for these objectives
      const objectiveIds = (module.learning_objectives as any[] || []).map((o: any) => o.id);
      const { data: assessments } = await supabase
        .from('assessment_sessions')
        .select('learning_objective_id, status, total_score, completed_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .in('learning_objective_id', objectiveIds.length > 0 ? objectiveIds : ['none']);

      const assessmentMap = new Map(
        assessments?.map(a => [a.learning_objective_id, a]) || []
      );

      // Build objective progress
      const objProgress: ObjectiveProgress[] = ((module.learning_objectives as any[]) || [])
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
        .map(obj => {
          const assessment = assessmentMap.get(obj.id);
          return {
            id: `progress-${obj.id}`,
            objectiveId: obj.id,
            title: obj.title || 'Untitled',
            status: assessment ? 'completed' : 'not_started',
            completedAt: assessment?.completed_at || null,
            assessmentPassed: assessment ? (assessment.total_score || 0) >= 70 : null,
            assessmentScore: assessment?.total_score || null,
            timeSpent: 0,
          };
        });

      const completedCount = objProgress.filter(o => o.status === 'completed').length;
      const totalCount = objProgress.length;

      return {
        id: `mod-progress-${module.id}`,
        moduleId: module.id,
        title: module.title || 'Untitled Module',
        orderIndex: module.order_index || 0,
        status: completedCount === totalCount && totalCount > 0 ? 'completed' :
                completedCount > 0 ? 'in_progress' : 'not_started',
        objectives: objProgress,
        completedObjectives: completedCount,
        totalObjectives: totalCount,
        percentComplete: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
        completedAt: null,
      };
    },

    enabled: !!moduleId,
  });
}
