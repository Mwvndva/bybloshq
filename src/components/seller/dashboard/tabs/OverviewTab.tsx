import { useMemo, useState } from 'react';
import { ArrowUpRight, BadgeDollarSign, Clock, Heart, Megaphone, MousePointerClick, Package, PackagePlus, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { formatOrderStatusLabel, getPendingStatusStyles } from '../dashboardUtils';
import { SellerReminders } from '../widgets/SellerReminders';
import type { SellerProfile } from '@/features/auth/types/authTypes';
import type { AnalyticsData, RecentOrder, SellerTabId } from '../types';

interface OverviewTabProps {
  analytics: AnalyticsData;
  pendingOverviewOrders: RecentOrder[];
  sellerProfile?: SellerProfile | null;
  onSelectTab: (tab: SellerTabId) => void;
}

export function OverviewTab({ analytics, pendingOverviewOrders, sellerProfile, onSelectTab }: OverviewTabProps) {
  const recentOrders = (analytics.recentOrders || []).slice(0, 5);

  const balance = analytics.availableBalance ?? analytics.balance ?? 0;
  const revenue = analytics.totalRevenue || 0;
  const clicks = Number(analytics.clickCount || 0);
  const wishlist = Number(analytics.wishlistCount || 0);
  const liveProducts = Number(analytics.totalProducts || 0);
  const ambassadorSales = analytics.creatorGeneratedSales || 0;

  // "Nothing yet" — a brand-new shop with no numbers to show. We greet them and
  // point at the next action instead of a wall of zeros, but keep the metrics
  // one tap away behind a show/hide toggle.
  const hasActivity = revenue > 0 || balance > 0 || liveProducts > 0 || clicks > 0 || wishlist > 0 || pendingOverviewOrders.length > 0;
  const [showMetrics, setShowMetrics] = useState(false);

  const greeting = useMemo(() => {
    if (revenue > 0) {
      return { title: `Your shop is live! You've made ${formatCurrency(revenue)} so far 🎉`, sub: 'Keep the momentum going.' };
    }
    return { title: 'Your shop is live! 🎉', sub: 'Your first sale is on its way — here is what to do next.' };
  }, [revenue]);

  const metricsBlock = (
    <div className="space-y-3 sm:space-y-4">
      {/* Balance hero + Revenue companion — the number and the action that
          spends it sit together, and clearly outrank everything below. */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="seller-balance-hero relative overflow-hidden rounded-3xl border border-white/10 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/25">
              <Wallet className="h-5 w-5" style={{ color: 'var(--theme-accent, #f5c518)' }} />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Available balance</p>
          </div>
          <p className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{formatCurrency(balance)}</p>
          <button
            type="button"
            onClick={() => onSelectTab('withdrawals')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-black shadow-[0_12px_28px_rgba(0,0,0,0.45)] transition-transform active:scale-95"
            style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
          >
            <Wallet className="h-4 w-4" />
            Withdraw
          </button>
        </div>

        <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(var(--theme-accent-rgb, 245, 158, 11), 0.14)' }}
            >
              <BadgeDollarSign className="h-4 w-4" style={{ color: 'var(--theme-accent, #f5c518)' }} />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/50">Total revenue</p>
          </div>
          <p className="mt-2 truncate text-2xl font-black text-white sm:text-3xl">{formatCurrency(revenue)}</p>
        </div>
      </div>

      {/* Shop activity — lighter-weight secondary stats. */}
      <div>
        <p className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-white/40">Shop activity</p>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {[
            { label: 'Clicks', value: clicks.toLocaleString(), icon: MousePointerClick },
            { label: 'Wishlist', value: wishlist.toLocaleString(), icon: Heart },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-white/45">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
              </div>
              <p className="mt-1 text-lg font-black tabular-nums text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Status chips — Live products is a state, not a KPI. Ambassador sales
          only appears once there is something to show. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-white/80">
          <Package className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent, #f5c518)' }} />
          {liveProducts.toLocaleString()} live {liveProducts === 1 ? 'product' : 'products'}
        </span>
        {ambassadorSales > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-white/80">
            <Megaphone className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent, #f5c518)' }} />
            {formatCurrency(ambassadorSales)} ambassador sales
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="px-1 sm:px-0">
        <h2 className="text-lg font-black text-white sm:text-xl lg:text-2xl">{greeting.title}</h2>
        <p className="mt-1 text-xs font-medium text-white/60 sm:text-sm">{greeting.sub}</p>
      </div>

      <SellerReminders sellerProfile={sellerProfile} totalProducts={liveProducts} onSelectTab={onSelectTab} />

      {hasActivity ? (
        metricsBlock
      ) : (
        <>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center sm:p-8">
            <span
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'rgba(var(--theme-accent-rgb, 245, 158, 11), 0.16)' }}
            >
              <PackagePlus className="h-6 w-6" style={{ color: 'var(--theme-accent, #f5c518)' }} />
            </span>
            <p className="mt-3 text-base font-black text-white sm:text-lg">Add your first product to start getting clicks</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-white/60 sm:text-sm">
              Once buyers start engaging, your balance, revenue and activity will show up right here.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onSelectTab('products')}
                className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-black shadow-[0_12px_28px_rgba(0,0,0,0.45)] transition-transform active:scale-95"
                style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
              >
                <PackagePlus className="h-4 w-4" />
                Add a product
              </button>
              <button
                type="button"
                onClick={() => setShowMetrics((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2.5 text-xs font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:text-sm"
              >
                {showMetrics ? 'Hide metrics' : 'Show metrics'}
                <ArrowUpRight className={`h-3.5 w-3.5 transition-transform ${showMetrics ? 'rotate-90' : ''}`} />
              </button>
            </div>
          </div>
          {showMetrics && metricsBlock}
        </>
      )}

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
