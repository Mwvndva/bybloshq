import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNotifications, type AppNotification, type NotificationVariant } from './useNotifications';

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export interface NotificationBellProps {
  variant?: NotificationVariant;
  triggerClassName?: string;
}

export function NotificationBell({ variant = 'default', triggerClassName }: NotificationBellProps) {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications(variant);

  const handleItem = (n: AppNotification) => {
    if (!n.read_at) markRead(n.id);
    const path = typeof n.data?.path === 'string' ? (n.data.path as string) : null;
    if (path && path.startsWith('/')) navigate(path);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('relative', triggerClassName)} aria-label="Notifications">
          <Bell className="h-5 w-5" style={{ color: 'var(--theme-accent, #f5c518)' }} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold flex items-center justify-center"
              style={{ backgroundColor: 'var(--theme-accent, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 text-slate-950 dark:text-white shadow-2xl rounded-2xl transition-colors duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
          <span className="font-bold text-sm text-slate-950 dark:text-white">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead()}
              className="text-xs text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 font-medium"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400 dark:text-white/40">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400 dark:text-white/40">No notifications yet</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleItem(n)}
                className="w-full text-left px-4 py-3 border-b border-slate-100 dark:border-white/5 last:border-b-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                style={!n.read_at ? { backgroundColor: 'rgba(var(--theme-accent-rgb, 245, 158, 11), 0.10)' } : undefined}
              >
                <div className="flex items-start gap-2">
                  {!n.read_at && (
                    <span
                      className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: 'var(--theme-accent, #f5c518)' }}
                    />
                  )}
                  <div className={cn('flex-1 min-w-0', n.read_at && 'pl-4')}>
                    <div className="text-sm font-semibold text-slate-950 dark:text-white truncate">{n.title}</div>
                    <div className="text-xs text-slate-600 dark:text-white/60 line-clamp-2">{n.body}</div>
                    <div className="text-[11px] text-slate-400 dark:text-white/40 mt-0.5">{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;
