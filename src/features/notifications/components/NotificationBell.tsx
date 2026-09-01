import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { IconButton } from '@/shared/ui/icon-button';
import { cn } from '@/shared/utils/formatting';
import { useNotifications, type NotificationVariant } from '../hooks/useNotifications';
import { NotificationList } from './NotificationList';

export interface NotificationBellProps {
  variant?: NotificationVariant;
  triggerClassName?: string;
}

export function NotificationBell({ variant = 'default', triggerClassName }: NotificationBellProps) {
  const { unreadCount } = useNotifications(variant);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton variant="ghost" className={cn('relative', triggerClassName)} aria-label="Notifications">
          <Bell className="h-5 w-5" style={{ color: 'var(--theme-accent, #f5c518)' }} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold flex items-center justify-center"
              style={{ backgroundColor: 'var(--theme-accent, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </IconButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 text-slate-950 dark:text-white shadow-2xl rounded-2xl transition-colors duration-200">
        <NotificationList variant={variant} />
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;
