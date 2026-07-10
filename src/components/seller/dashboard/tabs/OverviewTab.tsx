import { BadgeDollarSign, Clock, Link as LinkIcon, Package, ShoppingBag, UserRoundCheck } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getShopUrl, getShopUsername } from '@/lib/shopLinks';
import { formatOrderStatusLabel, getPendingStatusStyles } from '../dashboardUtils';
import type { AnalyticsData, RecentOrder } from '../types';

interface OverviewTabProps {
  analytics: AnalyticsData;
  pendingOverviewOrders: RecentOrder[];
  sellerProfile: import('@/features/auth/types/authTypes').SellerProfile;
  onCopyShopLink: () => Promise<void>;
}

export function OverviewTab({ analytics, pendingOverviewOrders, sellerProfile, onCopyShopLink }: OverviewTabProps) {
  const recentOrders = (analytics.recentOrders || []).slice(0, 5);
  const monthlySales = analytics.monthlySales || [];
  const latestMonthSales = monthlySales[monthlySales.length - 1]?.sales || 0;
  const shopUsername = getShopUsername(sellerProfile?.shopName);
  const shopUrl = getShopUrl(sellerProfile?.shopName);
  const overviewCards = [
    { label: 'Live products', value: Number(analytics.totalProducts || 0).toLocaleString(), icon: Package },
    { label: 'Order value', value: formatCurrency(analytics.totalSales || 0), icon: ShoppingBag },
    { label: 'Creator sales', value: formatCurrency(analytics.creatorGeneratedSales || 0), icon: BadgeDollarSign },
    { label: 'Creators', value: Number(analytics.creatorCount || 0).toLocaleString(), icon: UserRoundCheck }
  ];

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between sm:px-0">
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-950">Overview</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-700 font-medium">What needs attention and how your shop is moving.</p>
        </div>
        {shopUsername && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <a
              href={shopUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-950 hover:bg-slate-50 sm:w-auto"
              title={shopUrl}
            >
              <LinkIcon className="h-3 w-3" />
              {shopUsername}
            </a>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg h-9 px-3 text-xs font-medium w-full sm:w-auto"
              onClick={onCopyShopLink}
            >
              Copy link
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {overviewCards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="bg-white border border-slate-200 shadow-sm rounded-2xl">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                <Icon className="h-4 w-4 text-yellow-600" />
              </div>
              <p className="mt-2 text-base sm:text-xl font-black text-slate-950 truncate">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <Card className="bg-white border border-slate-200 shadow-sm w-full rounded-2xl overflow-hidden">
          <CardHeader className="p-4">
            <CardTitle className="text-base sm:text-lg font-black text-slate-950 flex items-center">
              <div className="w-9 h-9 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-center mr-3">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-700" />
              </div>
              Action Needed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            {pendingOverviewOrders.length > 0 ? (
              <div className="space-y-2 mt-2">
                {pendingOverviewOrders.map((order) => (
                  <div key={order.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm sm:text-base text-slate-950 truncate" title={order.orderNumber}>
                            {order.orderNumber}
                          </span>
                          <Badge className={`border text-[10px] font-bold ${getPendingStatusStyles(order.status)}`}>
                            {formatOrderStatusLabel(order.status)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-700 truncate">
                          {(order.items || []).map(item => `${item.quantity}x ${item.product_name}`).join(', ') || 'Order items pending'}
                        </p>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <p className="text-sm font-black text-slate-950">{formatCurrency(order.totalAmount)}</p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center">
                <p className="text-slate-600 text-sm">No paid orders need action right now.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200 shadow-sm w-full rounded-2xl overflow-hidden">
          <CardHeader className="p-4">
            <CardTitle className="text-base sm:text-lg font-black text-slate-950">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Latest month sales</p>
              <p className="mt-1 text-lg font-black text-slate-950">{formatCurrency(latestMonthSales)}</p>
            </div>
            {recentOrders.length > 0 ? (
              <div className="space-y-2">
                {recentOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-black text-slate-950">{order.orderNumber}</p>
                      <p className="shrink-0 text-xs font-black text-slate-950">{formatCurrency(order.totalAmount)}</p>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <Badge className={`border text-[9px] font-bold ${getPendingStatusStyles(order.status)}`}>
                        {formatOrderStatusLabel(order.status)}
                      </Badge>
                      <p className="shrink-0 text-[10px] text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-600">
                No paid order activity yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


