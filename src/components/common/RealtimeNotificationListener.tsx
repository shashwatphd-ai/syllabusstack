import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

/**
 * Invisible component that initializes realtime notification subscriptions.
 * Must be rendered inside NotificationProvider.
 */
export function RealtimeNotificationListener() {
  useRealtimeNotifications();
  return null;
}
