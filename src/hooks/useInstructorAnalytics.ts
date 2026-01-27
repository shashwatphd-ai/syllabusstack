import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CourseAnalytics {
  courseId: string;
  courseTitle: string;
  courseCode: string | null;

  // Enrollment metrics
  totalEnrollments: number;
  activeStudents: number; // Active in last 7 days
  completedStudents: number;
  averageProgress: number;

  // Engagement metrics
  totalContentViews: number;
  totalAssessmentAttempts: number;
  averageAssessmentScore: number;
  passRate: number;

  // Time metrics
  averageTimeSpent: number; // in minutes
  lastActivityAt: string | null;

  // Content breakdown
  contentStats: ContentStat[];
  moduleProgress: ModuleProgress[];
}

export interface ContentStat {
  contentType: 'video' | 'reading' | 'assessment' | 'slide';
  count: number;
  totalViews: number;
  averageCompletionRate: number;
}

export interface ModuleProgress {
  moduleId: string;
  moduleName: string;
  averageProgress: number;
  completedCount: number;
  dropOffRate: number;
}

export interface StudentProgress {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  enrolledAt: string;
  lastActivityAt: string | null;
  overallProgress: number;
  assessmentScores: number[];
  averageScore: number | null;
  status: 'active' | 'inactive' | 'completed' | 'struggling';
  completedAt: string | null;
}

export interface InstructorDashboardStats {
  totalCourses: number;
  totalEnrollments: number;
  totalActiveStudents: number;
  totalCompletions: number;
  averageCompletionRate: number;
  averageRating: number | null;
  recentEnrollments: number; // Last 7 days
  coursesWithActivity: number;
}

// Fetch analytics for a specific course
async function fetchCourseAnalytics(courseId: string): Promise<CourseAnalytics | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Verify instructor owns this course
  const { data: course, error: courseError } = await supabase
    .from('instructor_courses')
    .select('id, title, code, instructor_id')
    .eq('id', courseId)
    .eq('instructor_id', user.id)
    .single();

  if (courseError || !course) return null;

  // Get enrollments
  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('id, student_id, overall_progress, enrolled_at, completed_at, last_accessed_at')
    .eq('instructor_course_id', courseId);

  const enrollmentsList = enrollments || [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const activeStudents = enrollmentsList.filter(e =>
    e.last_accessed_at && new Date(e.last_accessed_at) >= sevenDaysAgo
  ).length;

  const completedStudents = enrollmentsList.filter(e => e.completed_at).length;
  const averageProgress = enrollmentsList.length > 0
    ? enrollmentsList.reduce((sum, e) => sum + (e.overall_progress || 0), 0) / enrollmentsList.length
    : 0;

  // Get assessment stats
  const studentIds = enrollmentsList.map(e => e.student_id);
  let assessmentStats = { attempts: 0, passed: 0, totalScore: 0 };

  if (studentIds.length > 0) {
    const { data: assessments } = await supabase
      .from('assessment_sessions')
      .select('id, status, score, user_id')
      .in('user_id', studentIds)
      .eq('status', 'completed');

    if (assessments) {
      assessmentStats.attempts = assessments.length;
      assessmentStats.passed = assessments.filter(a => (a.score || 0) >= 70).length;
      assessmentStats.totalScore = assessments.reduce((sum, a) => sum + (a.score || 0), 0);
    }
  }

  // Get content consumption
  const { count: contentViews } = await supabase
    .from('consumption_records')
    .select('*', { count: 'exact', head: true })
    .eq('instructor_course_id', courseId);

  const lastActivity = enrollmentsList
    .filter(e => e.last_accessed_at)
    .sort((a, b) => new Date(b.last_accessed_at!).getTime() - new Date(a.last_accessed_at!).getTime())[0];

  return {
    courseId,
    courseTitle: course.title,
    courseCode: course.code,
    totalEnrollments: enrollmentsList.length,
    activeStudents,
    completedStudents,
    averageProgress: Math.round(averageProgress),
    totalContentViews: contentViews || 0,
    totalAssessmentAttempts: assessmentStats.attempts,
    averageAssessmentScore: assessmentStats.attempts > 0
      ? Math.round(assessmentStats.totalScore / assessmentStats.attempts)
      : 0,
    passRate: assessmentStats.attempts > 0
      ? Math.round((assessmentStats.passed / assessmentStats.attempts) * 100)
      : 0,
    averageTimeSpent: 0, // Would need consumption_records with duration
    lastActivityAt: lastActivity?.last_accessed_at || null,
    contentStats: [],
    moduleProgress: [],
  };
}

// Fetch student progress for a course
async function fetchStudentProgress(courseId: string): Promise<StudentProgress[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Verify instructor owns this course
  const { data: course } = await supabase
    .from('instructor_courses')
    .select('id')
    .eq('id', courseId)
    .eq('instructor_id', user.id)
    .single();

  if (!course) return [];

  // Get enrollments with student profiles
  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select(`
      id,
      student_id,
      overall_progress,
      enrolled_at,
      completed_at,
      last_accessed_at,
      profiles!course_enrollments_student_id_fkey (
        id,
        full_name,
        email
      )
    `)
    .eq('instructor_course_id', courseId);

  if (!enrollments) return [];

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return enrollments.map((e): StudentProgress => {
    const profile = e.profiles as { id: string; full_name: string | null; email: string | null } | null;
    const progress = e.overall_progress || 0;
    const lastActivity = e.last_accessed_at ? new Date(e.last_accessed_at) : null;
    const isActive = lastActivity && lastActivity >= sevenDaysAgo;

    let status: StudentProgress['status'] = 'inactive';
    if (e.completed_at) {
      status = 'completed';
    } else if (progress < 20 && !isActive) {
      status = 'struggling';
    } else if (isActive) {
      status = 'active';
    }

    return {
      id: e.id,
      studentId: e.student_id,
      studentName: profile?.full_name || 'Unknown Student',
      studentEmail: profile?.email || 'No email',
      enrolledAt: e.enrolled_at,
      lastActivityAt: e.last_accessed_at,
      overallProgress: progress,
      assessmentScores: [],
      averageScore: null,
      status,
      completedAt: e.completed_at,
    };
  });
}

// Fetch instructor dashboard stats
async function fetchInstructorDashboardStats(): Promise<InstructorDashboardStats | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get all instructor courses
  const { data: courses } = await supabase
    .from('instructor_courses')
    .select('id')
    .eq('instructor_id', user.id);

  if (!courses || courses.length === 0) {
    return {
      totalCourses: 0,
      totalEnrollments: 0,
      totalActiveStudents: 0,
      totalCompletions: 0,
      averageCompletionRate: 0,
      averageRating: null,
      recentEnrollments: 0,
      coursesWithActivity: 0,
    };
  }

  const courseIds = courses.map(c => c.id);

  // Get enrollment stats
  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('id, instructor_course_id, overall_progress, enrolled_at, completed_at, last_accessed_at')
    .in('instructor_course_id', courseIds);

  const enrollmentsList = enrollments || [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const activeStudents = enrollmentsList.filter(e =>
    e.last_accessed_at && new Date(e.last_accessed_at) >= sevenDaysAgo
  ).length;

  const completedStudents = enrollmentsList.filter(e => e.completed_at).length;
  const recentEnrollments = enrollmentsList.filter(e =>
    new Date(e.enrolled_at) >= sevenDaysAgo
  ).length;

  const coursesWithRecentActivity = new Set(
    enrollmentsList
      .filter(e => e.last_accessed_at && new Date(e.last_accessed_at) >= sevenDaysAgo)
      .map(e => e.instructor_course_id)
  ).size;

  const averageCompletion = enrollmentsList.length > 0
    ? enrollmentsList.reduce((sum, e) => sum + (e.overall_progress || 0), 0) / enrollmentsList.length
    : 0;

  return {
    totalCourses: courses.length,
    totalEnrollments: enrollmentsList.length,
    totalActiveStudents: activeStudents,
    totalCompletions: completedStudents,
    averageCompletionRate: Math.round(averageCompletion),
    averageRating: null, // Would need course_reviews table
    recentEnrollments,
    coursesWithActivity: coursesWithRecentActivity,
  };
}

// Hooks

/**
 * Fetch analytics for a specific course
 */
export function useCourseAnalytics(courseId: string | undefined) {
  return useQuery({
    queryKey: ['instructor-analytics', 'course', courseId],
    queryFn: () => courseId ? fetchCourseAnalytics(courseId) : null,
    enabled: !!courseId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch student progress for a course
 */
export function useStudentProgress(courseId: string | undefined) {
  return useQuery({
    queryKey: ['instructor-analytics', 'students', courseId],
    queryFn: () => courseId ? fetchStudentProgress(courseId) : [],
    enabled: !!courseId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch instructor dashboard stats
 */
export function useInstructorDashboardStats() {
  return useQuery({
    queryKey: ['instructor-analytics', 'dashboard'],
    queryFn: fetchInstructorDashboardStats,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Get students filtered by status
 */
export function useFilteredStudents(
  courseId: string | undefined,
  filter: 'all' | 'active' | 'inactive' | 'completed' | 'struggling'
) {
  const { data: students = [], isLoading } = useStudentProgress(courseId);

  const filteredStudents = filter === 'all'
    ? students
    : students.filter(s => s.status === filter);

  return {
    students: filteredStudents,
    isLoading,
    counts: {
      all: students.length,
      active: students.filter(s => s.status === 'active').length,
      inactive: students.filter(s => s.status === 'inactive').length,
      completed: students.filter(s => s.status === 'completed').length,
      struggling: students.filter(s => s.status === 'struggling').length,
    },
  };
}
