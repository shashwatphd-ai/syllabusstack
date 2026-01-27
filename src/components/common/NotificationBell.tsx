import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { NotificationDrawer } from './NotificationDrawer';

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: unreadCount = 0, isLoading } = useUnreadNotificationCount();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn('relative', className)}
        onClick={() => setIsOpen(true)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            className={cn(
              'absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs',
              'bg-destructive text-destructive-foreground',
              'animate-in fade-in zoom-in duration-200'
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      <NotificationDrawer open={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
