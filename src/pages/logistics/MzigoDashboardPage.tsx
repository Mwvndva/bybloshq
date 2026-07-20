import { ArrowLeft, CalendarClock, CheckCircle2, LogOut, PackageCheck, Radio, RefreshCw, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isNativeApp } from '@/lib/mobileApp';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { SORT_OPTIONS } from './mzigoDashboard.constants';
import { DashboardStat, RequestCard } from './mzigoDashboard.components';
import { useMzigoDashboard } from './useMzigoDashboard';
import { MzigoActivityPanel } from './MzigoActivityPanel';
import { isRequestTrackable } from './mzigoJourney';
import { useCourierBroadcast } from './useCourierBroadcast';

// Buttons are always yellow (primary) or outlined-white (secondary), never a
// dark fill, so every action reads clearly on the black theme.
const BTN_PRIMARY = 'bg-yellow-400 text-black font-semibold hover:bg-yellow-300';
const BTN_SECONDARY = 'border border-white/15 bg-white/[0.05] text-white hover:bg-white/10';

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
    <main className="min-h-[100svh] overflow-x-hidden bg-[#050505] text-white">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/95 px-4 py-3 backdrop-blur">
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
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-yellow-400">Mzigo Ego</p>
            <h1 className="text-lg font-black tracking-tight text-white sm:text-xl">Deliveries</h1>
            <p className="text-[11px] text-white/50">{partner?.name || 'Logistics partner'}</p>
          </div>

          <div className="flex justify-end">
            <NotificationBell variant="logistics" />
          </div>
        </div>
      </header>

      <section className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <MzigoActivityPanel />

        {/* ── Overview stats ───────────────────────────────────── */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStat
            label="To do"
            value={activeCount}
            icon={<Truck size={18} />}
            tone="border-yellow-400/25 bg-yellow-400/[0.08]"
          />
          <DashboardStat
            label="Running late"
            value={overdueCount}
            icon={<CalendarClock size={18} />}
            tone={overdueCount > 0 ? 'border-red-400/30 bg-red-400/10' : 'border-white/10 bg-white/[0.03]'}
          />
          <DashboardStat
            label="Done"
            value={done.length}
            icon={<CheckCircle2 size={18} />}
            tone="border-emerald-400/25 bg-emerald-400/[0.08]"
          />
          <DashboardStat
            label="All visible"
            value={dashboard?.count || 0}
            icon={<PackageCheck size={18} />}
          />
        </div>

        {/* ── Sort controls ────────────────────────────────────── */}
        <div className="mb-6 flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-white">
              <Truck size={16} className="text-yellow-400" />
              {activeCount} {activeCount === 1 ? 'delivery' : 'deliveries'} to do
            </p>
            <p className="mt-1 text-xs text-white/50">Finished deliveries move to Done below.</p>

            {/* Live location sharing — lets buyers/sellers watch active deliveries. */}
            <button
              type="button"
              onClick={() => setShareLocation((v) => !v)}
              aria-pressed={shareLocation}
              className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                shareLocation
                  ? 'border border-yellow-400/40 bg-yellow-400/15 text-yellow-200'
                  : 'border border-white/15 bg-white/[0.05] text-white/80 hover:bg-white/10'
              }`}
            >
              <Radio size={13} className={shareLocation && broadcast.active ? 'animate-pulse' : ''} />
              {shareLocation
                ? `Sharing live location (${trackableIds.length})`
                : 'Share my live location'}
            </button>
            {shareLocation && broadcast.error && (
              <p className="mt-1 text-[11px] text-red-300">{broadcast.error}</p>
            )}
            {shareLocation && !broadcast.error && trackableIds.length === 0 && (
              <p className="mt-1 text-[11px] text-white/40">
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
              <div key={item} className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white">To do</h2>
                  <p className="text-sm text-white/50">Deliveries still on the move, most urgent first.</p>
                </div>
                <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-black">
                  {todo.length} {todo.length === 1 ? 'delivery' : 'deliveries'}
                </span>
              </div>

              {todo.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/50">
                  Nothing to do right now. New deliveries appear here automatically.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {todo.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      tone="border-white/10 bg-white/[0.03]"
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
                  <h2 className="text-lg font-bold text-white">Done</h2>
                  <p className="text-sm text-white/50">Completed deliveries, kept for your records.</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">
                  {done.length} {done.length === 1 ? 'delivery' : 'deliveries'}
                </span>
              </div>

              {done.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/50">
                  No completed deliveries yet.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {done.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      tone="border-emerald-400/20 bg-white/[0.02]"
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">Account</p>
          <p className="mt-1 text-sm text-white/60">Sign out of your logistics workspace on this device.</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-400/20"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/40">
        <CalendarClock size={14} className="mr-1 inline-block" />
        Every delivery has a 24 hour window.
      </footer>
    </main>
  );
};

export default MzigoDashboardPage;
