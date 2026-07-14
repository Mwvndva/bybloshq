import { ArrowLeft, CalendarClock, CheckCircle2, LogOut, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isNativeApp } from '@/lib/mobileApp';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { ACTIVE_GROUPS, COMPLETED_GROUP, SORT_OPTIONS } from './mzigoDashboard.constants';
import { DashboardStat, RequestCard } from './mzigoDashboard.components';
import { useMzigoDashboard } from './useMzigoDashboard';
import { MzigoActivityPanel } from './MzigoActivityPanel';

// Shared button styles — buttons are always yellow (primary) or white (secondary),
// never a dark/black fill, so every action reads clearly on the black theme.
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

  return (
    <main className="mzigo-light-dashboard min-h-[100svh] overflow-x-hidden bg-black text-white">
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
            <h1 className="text-lg font-black tracking-tight text-white sm:text-xl">Delivery Orders</h1>
            <p className="text-[11px] text-white/50">{partner?.name || 'Logistics partner'} workspace</p>
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
            label="Active"
            value={activeCount}
            icon={<Truck size={18} />}
            tone="border-yellow-400/25 bg-yellow-400/[0.08]"
          />
          <DashboardStat
            label="Overdue"
            value={overdueCount}
            icon={<CalendarClock size={18} />}
            tone={overdueCount > 0 ? 'border-red-400/30 bg-red-400/10' : 'border-white/10 bg-white/[0.03]'}
          />
          <DashboardStat
            label="Completed"
            value={grouped.completed.length}
            icon={<CheckCircle2 size={18} />}
            tone="border-emerald-400/25 bg-emerald-400/[0.08]"
          />
          <DashboardStat
            label="Total Visible"
            value={dashboard?.count || 0}
            icon={<PackageCheck size={18} />}
          />
        </div>

        {/* ── Controls: what's active + how it's sorted ────────── */}
        <div className="mb-6 flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-white">
              <Truck size={16} className="text-yellow-400" />
              {activeCount} active logistics orders
            </p>
            <p className="mt-1 text-xs text-white/50">
              Completed orders are separated below so dispatch can focus on open movement.
            </p>
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

        {/* ── Order groups ─────────────────────────────────────── */}
        {requestsQuery.isLoading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {ACTIVE_GROUPS.map((group) => {
              const cards = grouped[group.key];
              return (
                <section key={group.key}>
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-white">{group.title}</h2>
                      <p className="text-sm text-white/50">{group.description}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${group.pill}`}>
                      {cards.length} orders
                    </span>
                  </div>

                  {cards.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/50">
                      No {group.title.toLowerCase()} orders right now.
                    </div>
                  ) : (
                    <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                      {cards.map((request) => (
                        <RequestCard
                          key={request.id}
                          request={request}
                          tone={group.tone}
                          now={now}
                          onStatusUpdate={handleStatusUpdate}
                          updatingStatusKey={updatingStatusKey}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white">{COMPLETED_GROUP.title}</h2>
                  <p className="text-sm text-white/50">{COMPLETED_GROUP.description}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${COMPLETED_GROUP.pill}`}>
                  {grouped.completed.length} orders
                </span>
              </div>

              {grouped.completed.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/50">
                  No completed deliveries yet.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {grouped.completed.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      tone={COMPLETED_GROUP.tone}
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
        Deliveries are organized against the 24 hour logistics window.
      </footer>
    </main>
  );
};

export default MzigoDashboardPage;
