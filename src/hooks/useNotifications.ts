import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { useToast } from '@/hooks/use-toast';

export type NotificationType =
  | 'gap_analysis_ready'
  | 'recommendation_added'
  | 'skill_verified'
  | 'course_completed'
  | 'assessment_passed'
  | 'dream_job_match'
  | 'new_content'
  | 'system_announcement'
  | 'instructor_message'
  | 'achievement_unlocked';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  related_dream_job_id: string | null;
  related_course_id: string | null;
  related_skill_id: string | null;
}

export interface NotificationSummary {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
}

// Fetch notifications
async function fetchNotifications(limit: number = 50): Promise<Notification[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    // Table might not exist yet - return empty
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []) as Notification[];
}

// Fetch unread count
async function fetchUnreadCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) {
    if (error.code === '42P01') return 0;
    throw error;
  }

  return count || 0;
}

// Mark notifications as read
async function markAsRead(notificationIds: string[]): Promise<number> {
  if (notificationIds.length === 0) return 0;

  const { data, error } = await supabase.rpc('mark_notifications_read', {
    p_notification_ids: notificationIds,
  });

  if (error) {
    // Fallback to direct update if function doesn't exist
    if (error.message.includes('does not exist')) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', notificationIds)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
      return notificationIds.length;
    }
    throw error;
  }

  return data || 0;
}

// Mark all as read
async function markAllAsRead(): Promise<number> {
  const { data, error } = await supabase.rpc('mark_all_notifications_read');

  if (error) {
    // Fallback if function doesn't exist
    if (error.message.includes('does not exist')) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { error: updateError, count } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .select('*', { count: 'exact', head: true });

      if (updateError) throw updateError;
      return count || 0;
    }
    throw error;
  }

  return data || 0;
}

// Create notification (for client-side creation)
async function createNotification(params: {
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  relatedDreamJobId?: string;
  relatedCourseId?: string;
  relatedSkillId?: string;
}): Promise<Notification> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: user.id,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data || {},
      related_dream_job_id: params.relatedDreamJobId || null,
      related_course_id: params.relatedCourseId || null,
      related_skill_id: params.relatedSkillId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Notification;
}

// Hooks

/**
 * Fetch all notifications
 */
export function useNotifications(limit: number = 50) {
  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: () => fetchNotifications(limit),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}

/**
 * Fetch unread notification count
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}

/**
 * Mark specific notifications as read
 */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Mark all notifications as read
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (count > 0) {
        toast({
          title: 'Notifications cleared',
          description: `Marked ${count} notification${count !== 1 ? 's' : ''} as read`,
        });
      }
    },
  });
}

/**
 * Create a new notification
 */
export function useCreateNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Get notification summary
 */
export function useNotificationSummary() {
  const { data: notifications = [], isLoading } = useNotifications();

  const summary: NotificationSummary = {
    total: notifications.length,
    unread: notifications.filter((n) => !n.is_read).length,
    byType: {} as Record<NotificationType, number>,
  };

  notifications.forEach((n) => {
    summary.byType[n.type] = (summary.byType[n.type] || 0) + 1;
  });

  return { summary, isLoading };
}

/**
 * Get unread notifications only
 */
export function useUnreadNotifications() {
  const { data: notifications = [], isLoading } = useNotifications();
  return {
    notifications: notifications.filter((n) => !n.is_read),
    isLoading,
  };
}

// Notification type configuration for display
export const NOTIFICATION_CONFIG: Record<NotificationType, {
  icon: string;
  color: string;
  bgColor: string;
}> = {
  gap_analysis_ready: { icon: 'BarChart2', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  recommendation_added: { icon: 'Sparkles', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  skill_verified: { icon: 'Award', color: 'text-green-600', bgColor: 'bg-green-100' },
  course_completed: { icon: 'GraduationCap', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  assessment_passed: { icon: 'CheckCircle', color: 'text-green-600', bgColor: 'bg-green-100' },
  dream_job_match: { icon: 'Target', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  new_content: { icon: 'BookOpen', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  system_announcement: { icon: 'Bell', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  instructor_message: { icon: 'MessageSquare', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  achievement_unlocked: { icon: 'Trophy', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
};

// Helper to get link for notification
export function getNotificationLink(notification: Notification): string | null {
  switch (notification.type) {
    case 'gap_analysis_ready':
    case 'dream_job_match':
      return notification.related_dream_job_id
        ? `/dream-jobs/${notification.related_dream_job_id}`
        : '/career-path';
    case 'skill_verified':
      return '/profile?tab=skills';
    case 'course_completed':
    case 'new_content':
      return notification.related_course_id
        ? `/courses/${notification.related_course_id}`
        : '/learn';
    case 'assessment_passed':
      return '/progress';
    case 'recommendation_added':
      return notification.related_dream_job_id
        ? `/dream-jobs/${notification.related_dream_job_id}`
        : '/career-path';
    case 'achievement_unlocked':
      return '/profile?tab=achievements';
    default:
      return null;
  }
}
