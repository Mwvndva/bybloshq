import { Clock, Link as LinkIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatOrderStatusLabel, getPendingStatusStyles } from '../dashboardUtils';
import type { RecentOrder } from '../types';

interface OverviewTabProps {
  pendingOverviewOrders: RecentOrder[];
  sellerProfile: any;
  onCopyShopLink: () => Promise<void>;
}

export function OverviewTab({ pendingOverviewOrders, sellerProfile, onCopyShopLink }: OverviewTabProps) {
  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="text-center px-2 sm:px-0">
        {sellerProfile?.shopName && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg h-8 px-3 text-xs font-medium"
              onClick={onCopyShopLink}
            >
              <LinkIcon className="h-3 w-3" />
              Copy Shop Link
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Card className="bg-white border border-slate-200 shadow-sm w-full rounded-2xl">
          <CardHeader className="p-4">
            <CardTitle className="text-base sm:text-lg font-black text-slate-950 flex items-center">
              <div className="w-9 h-9 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-center mr-3">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-700" />
              </div>
              Pending Orders
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
                <p className="text-slate-600 text-sm">No service, collection, or delivery pending orders</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
