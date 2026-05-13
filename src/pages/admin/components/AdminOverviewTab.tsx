import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Package, Store, WalletCards } from 'lucide-react';
import {
  ChartContainer,
  GeoDistributionChart,
  ProductStatusChart,
  RevenueChart,
  SalesChart,
  UserGrowthChart
} from './AdminDashboardCharts';

interface AdminOverviewTabProps {
  dashboardState: any;
  safeFormatDate: (dateString: string | null | undefined, formatStr?: string) => string;
  onShowSellers: () => void;
}

export function AdminOverviewTab({ dashboardState, safeFormatDate, onShowSellers }: AdminOverviewTabProps) {
  const operatingCards = [
    {
      label: 'Open paid orders',
      value: dashboardState.analytics.activeOrders || 0,
      detail: 'Needs fulfillment or buyer confirmation',
      icon: <Package className="h-4 w-4 text-blue-400" />
    },
    {
      label: 'Pending withdrawals',
      value: dashboardState.analytics.pendingWithdrawals || 0,
      detail: 'Needs payout monitoring',
      icon: <WalletCards className="h-4 w-4 text-emerald-400" />
    },
    {
      label: 'Low stock products',
      value: dashboardState.analytics.lowStockProducts || 0,
      detail: 'Inventory attention',
      icon: <AlertTriangle className="h-4 w-4 text-amber-400" />
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="col-span-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {operatingCards.map(card => (
          <Card key={card.label} className="rounded-2xl border border-white/10 bg-[#0A0A0A]/70 shadow-xl">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
                <p className="mt-2 text-3xl font-black tabular-nums text-white">{Number(card.value).toLocaleString()}</p>
                <p className="mt-1 text-xs font-medium text-gray-500">{card.detail}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                {card.icon}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <SalesChart data={dashboardState.analytics.salesTrends || []} />
      <RevenueChart data={dashboardState.analytics.revenueTrends || []} />
      <UserGrowthChart data={dashboardState.analytics.userGrowth || []} />
      <GeoDistributionChart data={dashboardState.analytics.geoDistribution || []} />
      <ProductStatusChart data={dashboardState.analytics.productStatus || []} />

      <ChartContainer title="Top Shops" description="Highest client conversion" className="col-span-4 lg:col-span-2">
        <div className="space-y-4 h-full flex flex-col justify-center">
          {dashboardState.topShops?.length ? dashboardState.topShops.slice(0, 3).map((shop: any, index: number) => (
            <div key={shop.id} className="flex items-center justify-between p-5 bg-white/[0.03] rounded-[1.5rem] border border-white/5 hover:bg-white/10 transition-all duration-500 group/shop">
              <div className="flex items-center gap-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black italic shadow-inner transition-transform group-hover/shop:scale-110 ${index === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                  index === 1 ? 'bg-gray-400/20 text-gray-400 border border-gray-400/30' :
                    'bg-orange-800/20 text-orange-600 border border-orange-800/30'
                  }`}
                >
                  {index + 1}
                </div>
                <div>
                  <p className="text-lg font-bold text-white tracking-tight">{shop.shopName || shop.name}</p>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1 opacity-50">{shop.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-white tracking-tighter tabular-nums group-hover/shop:text-yellow-500 transition-colors">{shop.clientCount}</p>
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest opacity-50">Pulse</p>
              </div>
            </div>
          )) : (
            <p className="text-center text-sm font-semibold text-gray-500">No shop conversion data yet</p>
          )}
        </div>
      </ChartContainer>

      <Card className="lg:col-span-4 bg-[#0A0A0A]/70 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 md:p-8 border-b border-white/5 bg-white/[0.01] gap-4">
          <div>
            <CardTitle className="text-xl md:text-2xl font-black text-white tracking-tighter">Velocity Stream</CardTitle>
            <CardDescription className="text-xs md:text-sm text-gray-400 font-medium">Recently authenticated merchants</CardDescription>
          </div>
          <Button variant="outline" className="border-white/10 text-yellow-500 hover:bg-yellow-500 hover:text-black rounded-xl font-black uppercase tracking-widest h-12 px-8 transition-all" onClick={onShowSellers}>
            Archive
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                <tr>
                  <th className="px-5 md:px-10 py-4 md:py-6">Operator</th>
                  <th className="px-5 md:px-10 py-4 md:py-6 text-center hidden sm:table-cell">Protocol Status</th>
                  <th className="px-5 md:px-10 py-4 md:py-6 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dashboardState.sellers.slice(0, 5).map((seller: any) => (
                  <tr key={seller.id} className="hover:bg-white/[0.02] transition-all group">
                    <td className="px-5 md:px-10 py-4 md:py-6">
                      <div className="flex items-center gap-3 md:gap-5">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-yellow-500/30 transition-all">
                          <Store className="w-4 h-4 md:w-5 md:h-5 text-gray-500 group-hover:text-yellow-500 transition-all" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm md:text-base font-bold text-white tracking-tight truncate">{seller.name}</p>
                          <p className="text-[10px] md:text-xs text-gray-500 font-medium italic opacity-60 truncate">{seller.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 md:px-10 py-4 md:py-6 text-center hidden sm:table-cell">
                      <Badge className={`px-3 md:px-5 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border-none ${seller.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                        {seller.status}
                      </Badge>
                    </td>
                    <td className="px-5 md:px-10 py-4 md:py-6 text-right text-[10px] md:text-sm font-bold text-gray-400 tabular-nums">
                      {safeFormatDate(seller.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
