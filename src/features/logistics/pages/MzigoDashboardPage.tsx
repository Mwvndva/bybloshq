import { ArrowLeft, CalendarClock, CheckCircle2, LogOut, PackageCheck, Radio, RefreshCw, Truck } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { SORT_OPTIONS } from '../utils/mzigoDashboard.constants';
import { DashboardStat, RequestCard } from '../components/mzigoDashboard.components';
import { useMzigoDashboard } from '../hooks/useMzigoDashboard';
import { MzigoActivityPanel } from '../components/MzigoActivityPanel';
import { isRequestTrackable } from '../utils/mzigoJourney';
import { useCourierBroadcast } from '../hooks/useCourierBroadcast';

// Buttons are always yellow (primary) or outlined-white (secondary), never a
// dark fill, so every action reads clearly on the black theme.
const BTN_PRIMARY = 'bg-yellow-400 text-black font-semibold hover:bg-yellow-300';
const BTN_SECONDARY = 'border border-black/10 dark:border-white/15 bg-black/[0.04] dark:bg-white/[0.05] text-slate-800 dark:text-white hover:bg-black/[0.08] dark:hover:bg-white/10';

const MzigoDashboardPage = () => {
  const navigate = useNavigate();
  const {
    sort,
    setSort,
    now,
    updatingStatusKey,
    partner,
    dashboard,
    grouped,
    activeCount,
    overdueCount,
    handleLogout,
    handleStatusUpdate,
    requestsQuery,
  } = useMzigoDashboard();

  // Two buckets only: everything still moving ("To do") and history ("Done").
  // The flat `requests` list keeps the server's global sort across old groups.
  const todo = useMemo(
    () => (dashboard?.requests || []).filter(
      (request) => !(request.isCompleted || request.status === 'completed' || request.group === 'completed'),
    ),
    [dashboard?.requests],
  );
  const done = grouped.completed;

  // Live location: broadcast the courier's position to every delivery currently
  // in motion, but only while the courier opts in (web geolocation, phase-scoped
  // on the viewer side).
  const [shareLocation, setShareLocation] = useState(false);
  const trackableIds = useMemo(() => todo.filter(isRequestTrackable).map((request) => request.id), [todo]);
  const broadcast = useCourierBroadcast(trackableIds, shareLocation);

  return (
    <main className="dashboard-layout mzigo-light-dashboard min-h-[100svh] overflow-x-hidden bg-[var(--byblos-bg,#000000)] text-[var(--byblos-text,#f5f5f5)] transition-colors duration-200" style={{ height: '100svh', overflowY: 'auto', overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(4rem + var(--sab, 16px))' } as React.CSSProperties}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-black/80 px-4 pb-3 pt-safe-top backdrop-blur">

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex justify-start">
            {!isNativeApp() && (
              <button
                type="button"
                onClick={() => navigate('/')}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ${BTN_SECONDARY}`}
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Home</span>
              </button>
            )}
          </div>

          <div className="text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-yellow-500 dark:text-yellow-400">Mzigo Ego</p>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white sm:text-xl">Deliveries</h1>
            <p className="text-[11px] text-slate-500 dark:text-white/50">{partner?.name || 'Logistics partner'}</p>
          </div>

          <div className="flex justify-end">
            <NotificationBell variant="logistics" />
          </div>
        </div>
      </header>

      <section className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <MzigoActivityPanel />

        {/* ── Overview stats flex strip ────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-2.5 shadow-sm">
          <div className="flex items-center gap-2 rounded-xl border border-yellow-500/25 bg-yellow-500/[0.08] px-3 py-1.5 text-xs">
            <Truck size={14} className="text-yellow-500 dark:text-yellow-400" />
            <span className="font-medium text-slate-700 dark:text-white/70">To do:</span>
            <span className="font-black text-yellow-600 dark:text-yellow-300">{activeCount}</span>
          </div>

          <div className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs ${
            overdueCount > 0 ? 'border-red-400/30 bg-red-400/10' : 'border-black/10 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]'
          }`}>
            <CalendarClock size={14} className={overdueCount > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-white/40'} />
            <span className="font-medium text-slate-700 dark:text-white/70">Late:</span>
            <span className={`font-black ${overdueCount > 0 ? 'text-red-500 dark:text-red-300' : 'text-slate-900 dark:text-white'}`}>{overdueCount}</span>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-1.5 text-xs">
            <CheckCircle2 size={14} className="text-emerald-500 dark:text-emerald-400" />
            <span className="font-medium text-slate-700 dark:text-white/70">Done:</span>
            <span className="font-black text-emerald-600 dark:text-emerald-300">{done.length}</span>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] px-3 py-1.5 text-xs">
            <PackageCheck size={14} className="text-slate-400 dark:text-white/40" />
            <span className="font-medium text-slate-700 dark:text-white/70">All:</span>
            <span className="font-black text-slate-900 dark:text-white">{dashboard?.count || 0}</span>
          </div>
        </div>

        {/* ── Sort & Live Location controls ───────────────────── */}
        <div className="mb-6 flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 shadow-sm sm:flex-row sm:items-center">
          <div>
            <p className="text-xs text-slate-600 dark:text-white/60">Finished deliveries move to Done below.</p>

            {/* Live location sharing — lets buyers/sellers watch active deliveries. */}
            <button
              type="button"
              onClick={() => { setShareLocation((v) => !v); }}
              aria-pressed={shareLocation}
              className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                shareLocation
                  ? 'border border-yellow-500/40 bg-yellow-500/15 text-yellow-700 dark:text-yellow-200'
                  : 'border border-black/10 dark:border-white/15 bg-black/[0.04] dark:bg-white/[0.05] text-slate-800 dark:text-white/80 hover:bg-black/[0.08] dark:hover:bg-white/10'
              }`}
            >
              <Radio size={13} className={shareLocation && broadcast.active ? 'animate-pulse text-yellow-500 dark:text-yellow-400' : ''} />
              {shareLocation
                ? `Sharing live location (${trackableIds.length})`
                : 'Share my live location'}
            </button>
            {shareLocation && broadcast.error && (
              <p className="mt-1 text-[11px] text-red-500 dark:text-red-300">{broadcast.error}</p>
            )}
            {shareLocation && !broadcast.error && trackableIds.length === 0 && (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-white/40">
                Starts automatically once a delivery is picked up or out for delivery.
              </p>
            )}
          </div>

          <div className="w-full overflow-x-auto pb-1 sm:w-auto">
            <div className="flex min-w-max items-center gap-2">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSort(option.value)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${
                    sort === option.value ? BTN_PRIMARY : BTN_SECONDARY
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => requestsQuery.refetch()}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition ${BTN_SECONDARY}`}
              >
                <RefreshCw size={15} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ── Buckets ──────────────────────────────────────────── */}
        {requestsQuery.isLoading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-64 animate-pulse rounded-2xl border border-black/10 dark:border-white/10 bg-slate-100 dark:bg-white/[0.03]" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">To do</h2>
                  <p className="text-sm text-slate-500 dark:text-white/50">Deliveries still on the move, most urgent first.</p>
                </div>
                <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-black">
                  {todo.length} {todo.length === 1 ? 'delivery' : 'deliveries'}
                </span>
              </div>

              {todo.length === 0 ? (
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6 text-sm text-slate-500 dark:text-white/50 shadow-sm">
                  Nothing to do right now. New deliveries appear here automatically.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {todo.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      tone="border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] shadow-sm"
                      now={now}
                      onStatusUpdate={handleStatusUpdate}
                      updatingStatusKey={updatingStatusKey}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Done</h2>
                  <p className="text-sm text-slate-500 dark:text-white/50">Completed deliveries, kept for your records.</p>
                </div>
                <span className="rounded-full border border-black/10 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-1 text-xs font-bold text-slate-800 dark:text-white">
                  {done.length} {done.length === 1 ? 'delivery' : 'deliveries'}
                </span>
              </div>

              {done.length === 0 ? (
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6 text-sm text-slate-500 dark:text-white/50 shadow-sm">
                  No completed deliveries yet.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {done.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      tone="border-emerald-500/20 bg-emerald-50/30 dark:bg-white/[0.02] shadow-sm"
                      now={now}
                      onStatusUpdate={handleStatusUpdate}
                      updatingStatusKey={updatingStatusKey}
                      readOnly
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>

      {/* ── Account ──────────────────────────────────────────── */}
      <section className="w-full px-4 pb-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-white/50">Account</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-white/60">Sign out of your logistics workspace on this device.</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-300 transition hover:bg-red-500/20"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </section>

      <footer
        className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 dark:border-white/10 bg-white/95 dark:bg-black/95 px-4 py-3 text-center text-xs text-slate-500 dark:text-white/50 backdrop-blur shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.55)] transition-colors duration-200"
        style={{ paddingBottom: 'var(--sab, 16px)' }}
      >
        <CalendarClock size={14} className="mr-1 inline-block text-yellow-500 dark:text-yellow-400" />
        Every delivery has a 24 hour window.
      </footer>
    </main>
  );
};

export default MzigoDashboardPage;
