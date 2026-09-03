import { CheckCheck, Clock } from 'lucide-react';
import { cn } from '@/shared/utils/formatting';
import { useNotifications, type NotificationVariant } from '../hooks/useNotifications';

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
  return '';
}

function formatNotificationDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const formattedDate = new Intl.DateTimeFormat('en-KE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  const relative = timeAgo(iso);
  return relative ? `${formattedDate} (${relative})` : formattedDate;
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
 * buyer's Notifications nav section.
 * Notifications are read-only and display the full timestamp (date + time sent).
 */
export function NotificationList({
  variant = 'default',
  scrollClassName = 'max-h-[390px]',
  className,
}: NotificationListProps) {
  const { notifications, unreadCount, isLoading, markAllRead } = useNotifications(variant);

  return (
    <div className={className}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-slate-950 dark:text-white">Notifications</span>
          {notifications.length > 0 && (
            <span className="rounded-full bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-white/60">
              {notifications.length}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllRead()}
            className="text-xs text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 font-medium transition-colors"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>

      <div className={cn('overflow-y-auto divide-y divide-slate-100 dark:divide-white/5', scrollClassName)}>
        {isLoading ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400 dark:text-white/40">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400 dark:text-white/40">No notifications yet</div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className="w-full px-4 py-3.5 select-text transition-colors"
              style={!n.read_at ? { backgroundColor: 'rgba(var(--theme-accent-rgb, 245, 158, 11), 0.08)' } : undefined}
            >
              <div className="flex items-start gap-3">
                {!n.read_at && (
                  <span
                    className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: 'var(--theme-accent, #f5c518)' }}
                    aria-label="Unread notification"
                  />
                )}
                <div className={cn('flex-1 min-w-0', n.read_at && 'pl-3.5')}>
                  <div className="text-sm font-semibold text-slate-950 dark:text-white break-words">
                    {n.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-white/70 whitespace-pre-line leading-relaxed break-words">
                    {n.body}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-white/50">
                    <Clock className="h-3 w-3 shrink-0 text-slate-400 dark:text-white/40" />
                    <span>{formatNotificationDateTime(n.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default NotificationList;
