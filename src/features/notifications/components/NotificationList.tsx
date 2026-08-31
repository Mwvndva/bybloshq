import { useNavigate } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { cn } from '@/shared/utils/formatting';
import { useNotifications, type AppNotification, type NotificationVariant } from '../hooks/useNotifications';

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

interface NotificationListProps {
  variant?: NotificationVariant;
  /** Height class for the scroll region — popover uses a capped height, the full page section can grow. */
  scrollClassName?: string;
  className?: string;
}

/**
 * The single source of notification rendering: header (title + mark-all-read) and
 * the scrollable list. Shared by the header popover (NotificationBell) and the
 * buyer's Notifications nav section so both use the same useNotifications state —
 * no duplicated API/state (spec §5).
 */
export function NotificationList({ variant = 'default', scrollClassName = 'max-h-96', className }: NotificationListProps) {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications(variant);

  const handleItem = (n: AppNotification) => {
    if (!n.read_at) markRead(n.id);
    const path = typeof n.data?.path === 'string' ? (n.data.path as string) : null;
    if (path && path.startsWith('/')) navigate(path);
  };

  return (
    <div className={className}>
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
      <div className={cn('overflow-y-auto', scrollClassName)}>
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
    </div>
  );
}

export default NotificationList;
