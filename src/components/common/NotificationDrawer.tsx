import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Award,
  BarChart2,
  BookOpen,
  CheckCircle,
  GraduationCap,
  MessageSquare,
  Sparkles,
  Target,
  Trophy,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  useNotifications,
  useMarkNotificationsRead,
  useMarkAllNotificationsRead,
  Notification,
  NotificationType,
  NOTIFICATION_CONFIG,
  getNotificationLink,
} from '@/hooks/useNotifications';

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
}

// Icon mapping
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  BarChart2,
  Sparkles,
  Award,
  GraduationCap,
  CheckCircle,
  Target,
  BookOpen,
  Bell,
  MessageSquare,
  Trophy,
};

export function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useNotifications();
  const markAsRead = useMarkNotificationsRead();
  const markAllAsRead = useMarkAllNotificationsRead();

  const unreadNotifications = notifications.filter((n) => !n.is_read);
  const readNotifications = notifications.filter((n) => n.is_read);

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      markAsRead.mutate([notification.id]);
    }

    // Navigate if there's a link
    const link = getNotificationLink(notification);
    if (link) {
      onClose();
      navigate(link);
    }
  };

  const handleMarkAllRead = () => {
    markAllAsRead.mutate();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
              {unreadNotifications.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadNotifications.length}
                </Badge>
              )}
            </SheetTitle>
            {unreadNotifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={markAllAsRead.isPending}
                className="text-xs"
              >
                {markAllAsRead.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Mark all read
                  </>
                )}
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No notifications yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                We'll notify you about important updates
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {/* Unread section */}
              {unreadNotifications.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                    New
                  </div>
                  {unreadNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => handleNotificationClick(notification)}
                    />
                  ))}
                </div>
              )}

              {/* Read section */}
              {readNotifications.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground">
                    Earlier
                  </div>
                  {readNotifications.slice(0, 20).map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => handleNotificationClick(notification)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const config = NOTIFICATION_CONFIG[notification.type];
  const Icon = ICONS[config.icon] || Bell;

  const timeAgo = getTimeAgo(notification.created_at);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50',
        !notification.is_read && 'bg-primary/5'
      )}
    >
      <div className={cn('p-2 rounded-full flex-shrink-0', config.bgColor)}>
        <Icon className={cn('h-4 w-4', config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm line-clamp-1',
              !notification.is_read ? 'font-medium' : 'text-muted-foreground'
            )}
          >
            {notification.title}
          </p>
          {!notification.is_read && (
            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">{timeAgo}</p>
      </div>
    </button>
  );
}

// Helper to format time ago
function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
