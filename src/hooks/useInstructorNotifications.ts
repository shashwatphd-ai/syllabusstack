import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InstructorNotification {
  id: string;
  type: InstructorNotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export type InstructorNotificationType =
  | 'new_enrollment'
  | 'student_completed'
  | 'student_struggling'
  | 'assessment_submitted'
  | 'course_review'
  | 'verification_update';

// Instructor-specific notification configuration
export const INSTRUCTOR_NOTIFICATION_CONFIG: Record<InstructorNotificationType, {
  icon: string;
  color: string;
  bgColor: string;
  getLink?: (data: Record<string, unknown>) => string;
}> = {
  new_enrollment: {
    icon: 'UserPlus',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    getLink: (data) => `/instructor/courses/${data.course_id}/analytics`,
  },
  student_completed: {
    icon: 'Award',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    getLink: (data) => `/instructor/courses/${data.course_id}/gradebook`,
  },
  student_struggling: {
    icon: 'AlertTriangle',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    getLink: (data) => `/instructor/courses/${data.course_id}/gradebook`,
  },
  assessment_submitted: {
    icon: 'FileCheck',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    getLink: (data) => `/instructor/courses/${data.course_id}/gradebook`,
  },
  course_review: {
    icon: 'Star',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    getLink: (data) => `/instructor/courses/${data.course_id}`,
  },
  verification_update: {
    icon: 'Shield',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    getLink: () => '/instructor/verification',
  },
};

// Type for enrollment data
interface EnrollmentWithProfile {
  id: string;
  enrolled_at: string;
  completed_at: string | null;
  student_id: string;
  profiles?: { full_name: string | null } | null;
}

// Fetch instructor notifications - returns empty since table doesn't exist
async function fetchInstructorNotifications(limit = 20): Promise<InstructorNotification[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Notifications table doesn't exist in schema - return empty
  return [];
}

// Get unread count for instructor notifications
async function fetchInstructorUnreadCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  // Notifications table doesn't exist - return 0
  return 0;
}

// Get summary of instructor notifications by course
async function fetchNotificationsByCourse(): Promise<Map<string, InstructorNotification[]>> {
  const notifications = await fetchInstructorNotifications(50);
  const byCourse = new Map<string, InstructorNotification[]>();

  for (const notification of notifications) {
    const courseId = notification.data.course_id as string;
    if (courseId) {
      const existing = byCourse.get(courseId) || [];
      existing.push(notification);
      byCourse.set(courseId, existing);
    }
  }

  return byCourse;
}

// Hooks

/**
 * Fetch instructor notifications
 */
export function useInstructorNotifications(limit = 20) {
  return useQuery({
    queryKey: ['instructor-notifications', limit],
    queryFn: () => fetchInstructorNotifications(limit),
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60 * 5,
  });
}

/**
 * Get unread count for instructor notifications
 */
export function useInstructorUnreadCount() {
  return useQuery({
    queryKey: ['instructor-notifications', 'unread-count'],
    queryFn: fetchInstructorUnreadCount,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}

/**
 * Get notifications grouped by course
 */
export function useNotificationsByCourse() {
  return useQuery({
    queryKey: ['instructor-notifications', 'by-course'],
    queryFn: fetchNotificationsByCourse,
    staleTime: 1000 * 60,
  });
}

/**
 * Mark instructor notifications as read
 */
export function useMarkInstructorNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationIds: string[]) => {
      // Notifications table doesn't exist - no-op
      console.log('Would mark as read:', notificationIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-notifications'] });
    },
  });
}

/**
 * Get activity feed for a specific course
 */
export function useCourseActivityFeed(courseId: string | undefined) {
  return useQuery({
    queryKey: ['instructor-notifications', 'course', courseId],
    queryFn: async () => {
      if (!courseId) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get recent enrollments
      const { data: enrollmentsRaw } = await supabase
        .from('course_enrollments')
        .select(`
          id,
          enrolled_at,
          completed_at,
          student_id,
          profiles!course_enrollments_student_id_fkey (
            full_name
          )
        `)
        .eq('instructor_course_id', courseId)
        .order('enrolled_at', { ascending: false })
        .limit(10);

      const enrollments = (enrollmentsRaw || []) as unknown as EnrollmentWithProfile[];

      const activities: {
        type: 'enrollment' | 'completion';
        studentName: string;
        timestamp: string;
      }[] = [];

      for (const enrollment of enrollments) {
        const studentName = enrollment.profiles?.full_name || 'A student';

        activities.push({
          type: 'enrollment',
          studentName,
          timestamp: enrollment.enrolled_at,
        });

        if (enrollment.completed_at) {
          activities.push({
            type: 'completion',
            studentName,
            timestamp: enrollment.completed_at,
          });
        }
      }

      // Sort by timestamp descending
      activities.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return activities.slice(0, 10);
    },
    enabled: !!courseId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Get helper for notification link
 */
export function getInstructorNotificationLink(notification: InstructorNotification): string | null {
  const config = INSTRUCTOR_NOTIFICATION_CONFIG[notification.type];
  return config?.getLink?.(notification.data) || null;
}
