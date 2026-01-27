import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InstructorNotification {
  id: string;
  type: InstructorNotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
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
  getLink?: (data: Record<string, any>) => string;
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

// Fetch instructor notifications
async function fetchInstructorNotifications(limit = 20): Promise<InstructorNotification[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Instructor notifications are stored with type prefixes
  const instructorTypes = [
    'new_enrollment',
    'student_completed',
    'student_struggling',
    'assessment_submitted',
    'course_review',
    'verification_update',
  ];

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .in('type', instructorTypes)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((n): InstructorNotification => ({
      id: n.id,
      type: n.type as InstructorNotificationType,
      title: n.title,
      message: n.message,
      data: n.data || {},
      read: n.read,
      createdAt: n.created_at,
    }));
  } catch (error) {
    console.error('Error fetching instructor notifications:', error);
    return [];
  }
}

// Get unread count for instructor notifications
async function fetchInstructorUnreadCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const instructorTypes = [
    'new_enrollment',
    'student_completed',
    'student_struggling',
    'assessment_submitted',
    'course_review',
    'verification_update',
  ];

  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .in('type', instructorTypes);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }
}

// Get summary of instructor notifications by course
async function fetchNotificationsByCourse(): Promise<Map<string, InstructorNotification[]>> {
  const notifications = await fetchInstructorNotifications(50);
  const byCourse = new Map<string, InstructorNotification[]>();

  for (const notification of notifications) {
    const courseId = notification.data.course_id;
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
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get unread count for instructor notifications
 */
export function useInstructorUnreadCount() {
  return useQuery({
    queryKey: ['instructor-notifications', 'unread-count'],
    queryFn: fetchInstructorUnreadCount,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // 1 minute
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
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', notificationIds);

      if (error) throw error;
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
      const { data: enrollments } = await supabase
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

      const activities: {
        type: 'enrollment' | 'completion';
        studentName: string;
        timestamp: string;
      }[] = [];

      if (enrollments) {
        for (const enrollment of enrollments) {
          const profile = enrollment.profiles as { full_name: string | null } | null;
          const studentName = profile?.full_name || 'A student';

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
