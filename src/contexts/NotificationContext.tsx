import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface RealtimeNotification {
  id: string;
  type: "job_match" | "application_status" | "project_update" | "competency_verified" | "generation_complete";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: Record<string, any>;
}

interface NotificationContextType {
  notifications: RealtimeNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<RealtimeNotification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);

  const addNotification = useCallback(
    (notification: Omit<RealtimeNotification, "id" | "timestamp" | "read">) => {
      const newNotification: RealtimeNotification = {
        ...notification,
        id: crypto.randomUUID(),
        timestamp: new Date(),
        read: false,
      };
      setNotifications((prev) => [newNotification, ...prev].slice(0, 50));
    },
    []
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useRealtimeNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useRealtimeNotificationContext must be used within a NotificationProvider");
  }
  return context;
}
