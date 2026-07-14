import { BadgeDollarSign, Clock, Heart, Megaphone, MousePointerClick, Package, TrendingUp, UserRoundCheck, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { formatOrderStatusLabel, getPendingStatusStyles } from '../dashboardUtils';
import type { AnalyticsData, RecentOrder } from '../types';

interface OverviewTabProps {
  analytics: AnalyticsData;
  pendingOverviewOrders: RecentOrder[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(m: unknown): string {
  if (!m) return '';
  const s = String(m);
  const match = s.match(/(\d{4})-(\d{2})/);
  if (match) return MONTHS[Number(match[2]) - 1] || s.slice(0, 3);
  return s.slice(0, 3);
}

export function OverviewTab({ analytics, pendingOverviewOrders }: OverviewTabProps) {
  const recentOrders = (analytics.recentOrders || []).slice(0, 5);
  const monthlySales = (analytics.monthlySales || []).slice(-8);
  const latestMonthSales = monthlySales[monthlySales.length - 1]?.sales || 0;
  const prevMonthSales = monthlySales[monthlySales.length - 2]?.sales || 0;
  const maxSales = Math.max(1, ...monthlySales.map((m) => Number(m.sales) || 0));
  const trendPct = prevMonthSales > 0 ? Math.round(((latestMonthSales - prevMonthSales) / prevMonthSales) * 100) : null;

  const overviewCards = [
    { label: 'Balance', value: formatCurrency(analytics.availableBalance ?? analytics.balance ?? 0), icon: Wallet },
    { label: 'Revenue', value: formatCurrency(analytics.totalRevenue || 0), icon: BadgeDollarSign },
    { label: 'Clicks', value: Number(analytics.clickCount || 0).toLocaleString(), icon: MousePointerClick },
    { label: 'Wishlist', value: Number(analytics.wishlistCount || 0).toLocaleString(), icon: Heart },
    { label: 'Live products', value: Number(analytics.totalProducts || 0).toLocaleString(), icon: Package },
    { label: 'Ambassador sales', value: formatCurrency(analytics.creatorGeneratedSales || 0), icon: Megaphone },
    { label: 'Ambassadors', value: Number(analytics.creatorCount || 0).toLocaleString(), icon: UserRoundCheck },
    { label: 'Awaiting fulfillment', value: Number(pendingOverviewOrders.length || 0).toLocaleString(), icon: Clock }
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="px-1 sm:px-0">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white">Overview</h2>
        <p className="mt-1 text-xs sm:text-sm text-white/60 font-medium">What needs attention and how your shop is moving.</p>
      </div>

      {/* Sales graph — highlight coloured by the shop theme */}
      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] p-4 sm:p-5"
        style={{ boxShadow: '0 18px 45px rgba(0,0,0,0.45)' }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl"
          style={{ backgroundColor: 'rgba(var(--theme-accent-rgb, 245, 158, 11), 0.16)' }}
        />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">Latest month sales</p>
            <p className="mt-1 text-2xl sm:text-3xl font-black text-white">{formatCurrency(latestMonthSales)}</p>
            {trendPct !== null && (
              <span
                className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{
                  backgroundColor: trendPct >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: trendPct >= 0 ? '#4ade80' : '#f87171'
                }}
              >
                <TrendingUp className={`h-3 w-3 ${trendPct >= 0 ? '' : 'rotate-180'}`} />
                {trendPct >= 0 ? '+' : ''}{trendPct}% vs last month
              </span>
            )}
          </div>
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'rgba(var(--theme-accent-rgb, 245, 158, 11), 0.16)' }}
          >
            <TrendingUp className="h-5 w-5" style={{ color: 'var(--theme-accent, #f5c518)' }} />
          </span>
        </div>

        {monthlySales.length > 0 ? (
          <div className="relative mt-5">
            <div className="flex h-28 items-end gap-1.5 sm:gap-2.5">
              {monthlySales.map((m, i) => {
                const val = Number(m.sales) || 0;
                const pct = Math.max(4, Math.round((val / maxSales) * 100));
                const isLast = i === monthlySales.length - 1;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t-lg transition-all"
                    title={formatCurrency(val)}
                    style={{
                      height: `${pct}%`,
                      backgroundColor: isLast
                        ? 'var(--theme-accent, #f5c518)'
                        : 'rgba(var(--theme-accent-rgb, 245, 158, 11), 0.30)'
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-1.5 sm:gap-2.5">
              {monthlySales.map((m, i) => (
                <span key={i} className="flex-1 text-center text-[9px] font-semibold uppercase text-white/40">
                  {monthLabel(m.month)}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-6 text-center text-sm text-white/50">
            No sales yet — your monthly trend will appear here.
          </p>
        )}
      </div>

      {/* Stat grid — themed icon chips */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {overviewCards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06] sm:p-4"
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'rgba(var(--theme-accent-rgb, 245, 158, 11), 0.14)' }}
              >
                <Icon className="h-4 w-4" style={{ color: 'var(--theme-accent, #f5c518)' }} />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/50">{label}</p>
            </div>
            <p className="mt-2 truncate text-base font-black text-white sm:text-xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]">
          <div className="flex items-center gap-3 p-4">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(var(--theme-accent-rgb, 245, 158, 11), 0.14)' }}
            >
              <Clock className="h-5 w-5" style={{ color: 'var(--theme-accent, #f5c518)' }} />
            </span>
            <h3 className="text-base font-black text-white sm:text-lg">Action Needed</h3>
          </div>
          <div className="space-y-2 px-4 pb-4">
            {pendingOverviewOrders.length > 0 ? (
              pendingOverviewOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06]">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-white sm:text-base" title={order.orderNumber}>
                          {order.orderNumber}
                        </span>
                        <Badge className={`border text-[10px] font-bold ${getPendingStatusStyles(order.status)}`}>
                          {formatOrderStatusLabel(order.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-white/60">
                        {(order.items || []).map((item) => `${item.quantity}x ${item.product_name}`).join(', ') || 'Order items pending'}
                      </p>
                    </div>
                    <div className="shrink-0 sm:text-right">
                      <p className="text-sm font-black text-white">{formatCurrency(order.totalAmount)}</p>
                      <p className="text-[11px] text-white/40">
                        {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center">
                <p className="text-sm text-white/50">No paid orders need action right now.</p>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]">
          <div className="p-4">
            <h3 className="text-base font-black text-white sm:text-lg">Recent Activity</h3>
          </div>
          <div className="space-y-2 px-4 pb-4">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-black text-white">{order.orderNumber}</p>
                    <p className="shrink-0 text-xs font-black text-white">{formatCurrency(order.totalAmount)}</p>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <Badge className={`border text-[9px] font-bold ${getPendingStatusStyles(order.status)}`}>
                      {formatOrderStatusLabel(order.status)}
                    </Badge>
                    <p className="shrink-0 text-[10px] text-white/40">
                      {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-center text-sm text-white/50">
                No paid order activity yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
