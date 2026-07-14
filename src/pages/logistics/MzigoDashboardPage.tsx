import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, CheckCircle2, LogOut, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logisticsQueryKeys } from '@/api/queryKeys';
import {
  clearLogisticsSession,
  fetchLogisticsMe,
  fetchLogisticsRequests,
  getLogisticsToken,
  getStoredLogisticsPartner,
  LogisticsLeg,
  LogisticsLegType,
  LogisticsRequestCard,
  LogisticsSort,
  LogisticsStatusUpdate,
  updateLogisticsLegStatus,
} from '@/api/logistics';
import { toast } from 'sonner';
import { isNativeApp } from '@/lib/mobileApp';
import { ACTIVE_GROUPS, COMPLETED_GROUP, SORT_OPTIONS } from './mzigoDashboard.constants';
import { DashboardStat, RequestCard } from './mzigoDashboard.components';
import { useMzigoDashboard } from './useMzigoDashboard';
import { MzigoActivityPanel } from './MzigoActivityPanel';
import { NotificationBell } from '@/features/notifications/NotificationBell';

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
    <main className="mzigo-light-dashboard min-h-[100svh] overflow-x-hidden bg-[#f8f7f2] text-stone-950">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!isNativeApp() && (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-yellow-300 hover:bg-yellow-50 hover:text-black"
          >
            <ArrowLeft size={16} />
            Home
          </button>
          )}

          <div className="order-first text-center sm:order-none">
            <p className="text-xs font-semibold text-yellow-600">Mzigo Ego</p>
            <h1 className="text-xl font-semibold text-stone-950">Delivery Orders</h1>
            <p className="text-xs text-stone-500">{partner?.name || 'Logistics partner'} workspace</p>
          </div>

          <div className="flex items-center justify-center sm:justify-end">
            <NotificationBell variant="logistics" />
          </div>

        </div>
      </header>

      <section className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <MzigoActivityPanel />
        <div className="mb-6 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <Truck size={16} />
              {activeCount} active logistics orders
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Completed orders are separated from active work so dispatch can focus on open movement.
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
                    sort === option.value
                      ? 'bg-yellow-300 text-black'
                      : 'border border-stone-200 bg-white text-stone-700 hover:bg-yellow-50 hover:text-black'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => requestsQuery.refetch()}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-yellow-50 hover:text-black"
              >
                <RefreshCw size={15} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStat
            label="Active"
            value={activeCount}
            icon={<Truck size={18} />}
            tone="border-yellow-300/25 bg-yellow-300/10"
          />
          <DashboardStat
            label="Overdue"
            value={overdueCount}
            icon={<CalendarClock size={18} />}
            tone={overdueCount > 0 ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-white'}
          />
          <DashboardStat
            label="Completed"
            value={grouped.completed.length}
            icon={<CheckCircle2 size={18} />}
            tone="border-emerald-300/25 bg-emerald-300/10"
          />
          <DashboardStat
            label="Total Visible"
            value={dashboard?.count || 0}
            icon={<PackageCheck size={18} />}
          />
        </div>

        {requestsQuery.isLoading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-64 animate-pulse rounded-2xl border border-white/10 bg-[#0a0a0a]" />
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
                      <h2 className="text-lg font-semibold text-stone-950">{group.title}</h2>
                      <p className="text-sm text-stone-500">{group.description}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${group.pill}`}>
                      {cards.length} orders
                    </span>
                  </div>

                  {cards.length === 0 ? (
                    <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
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
                  <h2 className="text-lg font-semibold text-stone-950">{COMPLETED_GROUP.title}</h2>
                  <p className="text-sm text-stone-500">{COMPLETED_GROUP.description}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${COMPLETED_GROUP.pill}`}>
                  {grouped.completed.length} orders
                </span>
              </div>

              {grouped.completed.length === 0 ? (
                <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
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

      <section className="w-full px-4 pb-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-semibold text-stone-500">Account</p>
          <p className="mt-1 text-sm text-stone-600">Sign out of your logistics workspace on this device.</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </section>

      <footer className="border-t border-stone-200 px-4 py-4 text-center text-xs text-stone-500">
        <CalendarClock size={14} className="mr-1 inline-block" />
        Deliveries are organized against the 24 hour logistics window.
      </footer>
    </main>
  );
};

export default MzigoDashboardPage;


