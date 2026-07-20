import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications, type AppNotification } from '@/features/notifications/useNotifications';

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

/**
 * Prominent live activity feed for the Mzigo (logistics) web console — the
 * primary alert surface for a business partner who may not run the phone app.
 * New-pickup and milestone notifications land here in real time (45s poll).
 */
export function MzigoActivityPanel() {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications('logistics');

  const handleItem = (n: AppNotification) => {
    if (!n.read_at) markRead(n.id);
    const path = typeof n.data?.path === 'string' ? (n.data.path as string) : null;
    if (path && path.startsWith('/')) navigate(path);
  };

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex">
            <Bell className="h-4 w-4 text-yellow-400" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-yellow-400" />
            )}
          </span>
          <h2 className="text-sm font-semibold text-white">Activity</h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-yellow-400/15 px-2 py-0.5 text-[11px] font-bold text-yellow-300">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllRead()}
            className="inline-flex items-center gap-1 text-xs text-white/50 transition hover:text-white"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>
      <div className="max-h-72 divide-y divide-white/5 overflow-y-auto">
        {isLoading ? (
          <div className="px-5 py-8 text-center text-sm text-white/40">Loading activity…</div>
        ) : notifications.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-white/40">No new pickups or updates yet</div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleItem(n)}
              className={`flex w-full items-start gap-3 px-5 py-3 text-left transition hover:bg-white/[0.04] ${n.read_at ? '' : 'bg-yellow-400/[0.06]'}`}
            >
              <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-yellow-400'}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">{n.title}</span>
                <span className="block text-xs text-white/60 line-clamp-2">{n.body}</span>
                <span className="mt-0.5 block text-[11px] text-white/40">{timeAgo(n.created_at)}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default MzigoActivityPanel;
