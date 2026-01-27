import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GradebookEntry {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  enrolledAt: string;
  lastActivityAt: string | null;
  overallProgress: number;
  completedAt: string | null;

  // Assessment data
  assessments: AssessmentGrade[];
  averageScore: number | null;
  passedAssessments: number;
  totalAssessments: number;

  // Calculated fields
  letterGrade: string | null;
  status: 'not_started' | 'in_progress' | 'passing' | 'failing' | 'completed';
}

export interface AssessmentGrade {
  assessmentId: string;
  assessmentTitle: string;
  score: number | null;
  maxScore: number;
  status: 'not_started' | 'in_progress' | 'completed';
  completedAt: string | null;
  attempts: number;
}

export interface GradebookSummary {
  totalStudents: number;
  averageScore: number;
  passingRate: number;
  completionRate: number;
  gradeDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };
}

export interface CourseAssessment {
  id: string;
  title: string;
  maxScore: number;
  passingScore: number;
  weight: number;
}

// Type definitions for untyped tables
interface EnrollmentRow {
  id: string;
  student_id: string;
  overall_progress: number | null;
  enrolled_at: string;
  completed_at: string | null;
  profiles?: { id: string; full_name: string | null; email: string | null } | null;
}

interface AssessmentSessionRow {
  id: string;
  user_id: string;
  status: string | null;
  total_score: number | null;
  completed_at: string | null;
  created_at: string;
  learning_objective_id: string;
}

// Calculate letter grade from percentage
function calculateLetterGrade(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// Calculate student status
function calculateStatus(
  progress: number,
  averageScore: number | null,
  completedAt: string | null
): GradebookEntry['status'] {
  if (completedAt) return 'completed';
  if (progress === 0) return 'not_started';
  if (averageScore !== null && averageScore < 70) return 'failing';
  if (averageScore !== null && averageScore >= 70) return 'passing';
  return 'in_progress';
}

// Fetch gradebook data for a course
async function fetchGradebook(courseId: string): Promise<GradebookEntry[]> {
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

  // Get enrollments with student profiles (without last_accessed_at which doesn't exist)
  const { data: enrollmentsRaw } = await supabase
    .from('course_enrollments')
    .select(`
      id,
      student_id,
      overall_progress,
      enrolled_at,
      completed_at,
      profiles!course_enrollments_student_id_fkey (
        id,
        full_name,
        email
      )
    `)
    .eq('instructor_course_id', courseId)
    .order('enrolled_at', { ascending: true });

  const enrollments = (enrollmentsRaw || []) as unknown as EnrollmentRow[];

  if (enrollments.length === 0) return [];

  // Get all assessment sessions for enrolled students
  const studentIds = enrollments.map(e => e.student_id);

  // Query assessment sessions for these students using total_score (correct column name)
  const { data: assessmentSessionsRaw } = await supabase
    .from('assessment_sessions')
    .select(`
      id,
      user_id,
      status,
      total_score,
      completed_at,
      created_at,
      learning_objective_id
    `)
    .in('user_id', studentIds.length > 0 ? studentIds : ['none']);

  const assessmentSessions = (assessmentSessionsRaw || []) as unknown as AssessmentSessionRow[];

  // Group assessment sessions by student
  const sessionsByStudent = new Map<string, AssessmentSessionRow[]>();
  for (const session of assessmentSessions) {
    const studentSessions = sessionsByStudent.get(session.user_id) || [];
    studentSessions.push(session);
    sessionsByStudent.set(session.user_id, studentSessions);
  }

  return enrollments.map((e): GradebookEntry => {
    const profile = e.profiles;
    const studentSessions = sessionsByStudent.get(e.student_id) || [];

    // Group sessions by learning objective and get best scores
    const assessmentMap = new Map<string, AssessmentGrade>();
    for (const session of studentSessions) {
      const loId = session.learning_objective_id;
      if (!loId) continue;

      const existing = assessmentMap.get(loId);
      const currentScore = session.total_score ?? 0;

      if (!existing || (session.total_score && session.total_score > (existing.score || 0))) {
        assessmentMap.set(loId, {
          assessmentId: loId,
          assessmentTitle: `Objective ${loId.slice(0, 8)}`,
          score: session.status === 'completed' ? session.total_score : null,
          maxScore: 100,
          status: (session.status as 'not_started' | 'in_progress' | 'completed') || 'not_started',
          completedAt: session.completed_at,
          attempts: (existing?.attempts || 0) + 1,
        });
      } else if (existing) {
        existing.attempts++;
      }
    }

    const assessments = Array.from(assessmentMap.values());
    const completedAssessments = assessments.filter(a => a.status === 'completed');
    const passedAssessments = completedAssessments.filter(a => (a.score || 0) >= 70).length;

    const averageScore = completedAssessments.length > 0
      ? completedAssessments.reduce((sum, a) => sum + (a.score || 0), 0) / completedAssessments.length
      : null;

    return {
      id: e.id,
      studentId: e.student_id,
      studentName: profile?.full_name || 'Unknown Student',
      studentEmail: profile?.email || '',
      enrolledAt: e.enrolled_at,
      lastActivityAt: null, // Column doesn't exist yet
      overallProgress: e.overall_progress || 0,
      completedAt: e.completed_at,
      assessments,
      averageScore: averageScore !== null ? Math.round(averageScore) : null,
      passedAssessments,
      totalAssessments: assessments.length,
      letterGrade: calculateLetterGrade(averageScore),
      status: calculateStatus(e.overall_progress || 0, averageScore, e.completed_at),
    };
  });
}

// Fetch gradebook summary
async function fetchGradebookSummary(courseId: string): Promise<GradebookSummary | null> {
  const entries = await fetchGradebook(courseId);
  if (entries.length === 0) return null;

  const studentsWithScores = entries.filter(e => e.averageScore !== null);
  const averageScore = studentsWithScores.length > 0
    ? studentsWithScores.reduce((sum, e) => sum + (e.averageScore || 0), 0) / studentsWithScores.length
    : 0;

  const passingStudents = entries.filter(e => e.status === 'passing' || e.status === 'completed').length;
  const completedStudents = entries.filter(e => e.status === 'completed').length;

  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const entry of entries) {
    if (entry.letterGrade && entry.letterGrade in gradeDistribution) {
      gradeDistribution[entry.letterGrade as keyof typeof gradeDistribution]++;
    }
  }

  return {
    totalStudents: entries.length,
    averageScore: Math.round(averageScore),
    passingRate: entries.length > 0 ? Math.round((passingStudents / entries.length) * 100) : 0,
    completionRate: entries.length > 0 ? Math.round((completedStudents / entries.length) * 100) : 0,
    gradeDistribution,
  };
}

// Fetch course assessments (for column headers)
async function fetchCourseAssessments(courseId: string): Promise<CourseAssessment[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get learning objectives linked to this course
  const { data: learningObjectivesRaw } = await supabase
    .from('learning_objectives')
    .select('id, objective_text, instructor_course_id')
    .eq('instructor_course_id', courseId);

  interface LORow {
    id: string;
    objective_text: string | null;
    instructor_course_id: string;
  }

  const learningObjectives = (learningObjectivesRaw || []) as unknown as LORow[];

  return learningObjectives.map(lo => ({
    id: lo.id,
    title: lo.objective_text || 'Assessment',
    maxScore: 100,
    passingScore: 70,
    weight: 1,
  }));
}

// Export gradebook data to CSV format
function exportGradebookToCsv(entries: GradebookEntry[], assessments: CourseAssessment[]): string {
  const headers = [
    'Student Name',
    'Email',
    'Progress',
    ...assessments.map(a => a.title),
    'Average Score',
    'Letter Grade',
    'Status',
    'Enrolled Date',
    'Completed Date',
  ];

  const rows = entries.map(entry => {
    const assessmentScores = assessments.map(a => {
      const grade = entry.assessments.find(ea => ea.assessmentId === a.id);
      return grade?.score?.toString() || '-';
    });

    return [
      entry.studentName,
      entry.studentEmail,
      `${entry.overallProgress}%`,
      ...assessmentScores,
      entry.averageScore?.toString() || '-',
      entry.letterGrade || '-',
      entry.status.replace('_', ' '),
      new Date(entry.enrolledAt).toLocaleDateString(),
      entry.completedAt ? new Date(entry.completedAt).toLocaleDateString() : '-',
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

// Send reminder to student(s) - simplified without notifications table
async function sendReminder(
  studentIds: string[],
  courseId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // For now, just log the reminder - notifications table doesn't exist in types
  console.log('Reminder would be sent to:', studentIds, 'for course:', courseId, 'message:', message);
  
  return { success: true };
}

// Issue completion certificate
async function issueCertificate(
  studentId: string,
  courseId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Mark the enrollment as completed
  const { error } = await supabase
    .from('course_enrollments')
    .update({
      completed_at: new Date().toISOString(),
      overall_progress: 100,
    })
    .eq('instructor_course_id', courseId)
    .eq('student_id', studentId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Hooks

/**
 * Fetch gradebook entries for a course
 */
export function useGradebook(courseId: string | undefined) {
  return useQuery({
    queryKey: ['gradebook', 'entries', courseId],
    queryFn: () => courseId ? fetchGradebook(courseId) : [],
    enabled: !!courseId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Fetch gradebook summary statistics
 */
export function useGradebookSummary(courseId: string | undefined) {
  return useQuery({
    queryKey: ['gradebook', 'summary', courseId],
    queryFn: () => courseId ? fetchGradebookSummary(courseId) : null,
    enabled: !!courseId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Fetch assessments for a course (column headers)
 */
export function useCourseAssessments(courseId: string | undefined) {
  return useQuery({
    queryKey: ['gradebook', 'assessments', courseId],
    queryFn: () => courseId ? fetchCourseAssessments(courseId) : [],
    enabled: !!courseId,
    staleTime: 1000 * 60 * 10, // 10 minutes - assessments don't change often
  });
}

/**
 * Export gradebook to CSV
 */
export function useExportGradebook(courseId: string | undefined) {
  const { data: entries = [] } = useGradebook(courseId);
  const { data: assessments = [] } = useCourseAssessments(courseId);

  return {
    exportToCsv: () => {
      const csv = exportGradebookToCsv(entries, assessments);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `gradebook-${courseId}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    isReady: entries.length > 0,
  };
}

/**
 * Send reminder to students
 */
export function useSendReminder(courseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ studentIds, message }: { studentIds: string[]; message: string }) =>
      courseId ? sendReminder(studentIds, courseId, message) : Promise.resolve({ success: false, error: 'No course' }),
    onSuccess: () => {
      // Could invalidate notifications if needed
    },
  });
}

/**
 * Issue certificate to student
 */
export function useIssueCertificate(courseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (studentId: string) =>
      courseId ? issueCertificate(studentId, courseId) : Promise.resolve({ success: false, error: 'No course' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gradebook', 'entries', courseId] });
      queryClient.invalidateQueries({ queryKey: ['gradebook', 'summary', courseId] });
    },
  });
}

/**
 * Filter and sort gradebook entries
 */
export function useFilteredGradebook(
  courseId: string | undefined,
  options: {
    filter?: 'all' | 'passing' | 'failing' | 'completed' | 'not_started';
    sortBy?: 'name' | 'progress' | 'score' | 'enrolled' | 'activity';
    sortOrder?: 'asc' | 'desc';
    searchQuery?: string;
  } = {}
) {
  const { data: entries = [], isLoading, error } = useGradebook(courseId);
  const { filter = 'all', sortBy = 'name', sortOrder = 'asc', searchQuery = '' } = options;

  let filtered = [...entries];

  // Apply search
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      e => e.studentName.toLowerCase().includes(query) || e.studentEmail.toLowerCase().includes(query)
    );
  }

  // Apply filter
  if (filter !== 'all') {
    filtered = filtered.filter(e => e.status === filter);
  }

  // Apply sort
  filtered.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.studentName.localeCompare(b.studentName);
        break;
      case 'progress':
        comparison = a.overallProgress - b.overallProgress;
        break;
      case 'score':
        comparison = (a.averageScore || 0) - (b.averageScore || 0);
        break;
      case 'enrolled':
        comparison = new Date(a.enrolledAt).getTime() - new Date(b.enrolledAt).getTime();
        break;
      case 'activity':
        const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        comparison = aTime - bTime;
        break;
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  return {
    entries: filtered,
    isLoading,
    error,
    totalCount: entries.length,
    filteredCount: filtered.length,
  };
}
