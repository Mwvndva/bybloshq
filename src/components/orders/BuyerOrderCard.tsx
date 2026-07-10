import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Loader2, RefreshCw, Users } from 'lucide-react';
import type { ApiOrder } from '@/types/api/order';
import { getImageUrl } from '@/lib/utils';
import { getOrderInstruction } from '@/utils/orderInstructions';
import { OrderLogisticsTracking } from './OrderLogisticsTracking';
import {
  canConfirmOrderReceipt,
  detailPillClass,
  formatOrderCurrency,
  formatOrderDate,
  getConfirmReceiptLabel,
  getBuyerServiceCharge,
  getPaymentStatusBadge,
  getStatusBadge,
  isDigitalOrder,
  isPaidOrder,
  isServiceOrder
} from './ordersSectionUtils';

interface BuyerOrderCardProps {
  order: ApiOrder;
  clientStatus: Record<string, boolean>;
  isBecomingClient: Record<string, boolean>;
  downloadingOrderId: string | null;
  downloadProgress: Record<string, number>;
  onViewDetails: (order: ApiOrder) => void;
  onConfirmReceipt: (orderId: string) => void;
  onDownload: (order: ApiOrder) => void;
  onToggleClientStatus: (sellerId: string, sellerName: string) => void;
}

export function BuyerOrderCard({
  order,
  clientStatus,
  isBecomingClient,
  downloadingOrderId,
  downloadProgress,
  onViewDetails,
  onConfirmReceipt,
  onDownload,
  onToggleClientStatus
}: BuyerOrderCardProps) {
  const mainItem = order.items.find(item => item.imageUrl) || order.items[0];
  const mainImage = mainItem?.imageUrl ? getImageUrl(mainItem.imageUrl) : null;
  const productType = order.items[0]?.productType || 'PHYSICAL';
  const isService = isServiceOrder(order);
  const isDigital = isDigitalOrder(order);
  const canConfirmReceipt = canConfirmOrderReceipt(order);
  const buyerServiceCharge = getBuyerServiceCharge(order);
  const instruction = getOrderInstruction({
    status: order.status,
    userRole: 'buyer',
    orderType: productType.toUpperCase(),
    fulfillmentType: order.fulfillment_type,
  });
  const cardClasses = [
    'overflow-hidden transition-all duration-300 bg-black border shadow-[0_12px_32px_rgba(0,0,0,0.35)] hover:border-yellow-400/40',
    isService ? 'border-purple-400/45' : isDigital ? 'border-red-400/45' : 'border-white/15'
  ].join(' ');
  const itemClasses = [
    'flex items-center justify-between gap-3 sm:gap-4 p-2 sm:p-3 rounded-lg border transition-colors',
    isService ? 'bg-purple-500/10 border-purple-400/25' : isDigital ? 'bg-red-500/10 border-red-400/25' : 'bg-white/8 border-white/12'
  ].join(' ');

  return (
    <Card className={cardClasses}>
      <CardContent className="p-0">
        <div className="p-4 sm:p-6 border-b border-white/10">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <h3 className="text-lg sm:text-xl font-bold text-white">
                  #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}
                </h3>
                <div className="flex gap-1.5 sm:gap-2">
                  {getStatusBadge(order.status)}
                  {getPaymentStatusBadge(order.paymentStatus)}
                </div>
              </div>
              <p className="text-xs sm:text-sm text-white/70">{formatOrderDate(order)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/70 uppercase tracking-wider mb-1">Total</p>
              <p className="text-xl sm:text-2xl font-bold text-white">
                {formatOrderCurrency((order as Record<string, unknown>).total_amount as number || order.totalAmount, order.currency)}
              </p>
              <p className="mt-1 text-[11px] font-medium text-white/60">
                Includes 2% Byblos charge{buyerServiceCharge > 0 ? ` (${formatOrderCurrency(buyerServiceCharge, order.currency)})` : ''}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className={detailPillClass}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Shop</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-white">{order.seller?.shopName || order.seller?.name || 'Store'}</p>
            </div>
            <div className={detailPillClass}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Payment</p>
              <p className="mt-0.5 text-sm font-semibold text-white">{order.paymentStatus || 'Pending'}</p>
            </div>
            <div className={detailPillClass}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Items</p>
              <p className="mt-0.5 text-sm font-semibold text-white">{order.items?.length || 0} item{order.items?.length === 1 ? '' : 's'}</p>
            </div>
            <div className={detailPillClass}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">ApiOrder ID</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-white">{String(order.id).slice(0, 12)}</p>
            </div>
          </div>
        </div>

        {instruction && (
          <div className={`mx-4 sm:mx-6 mt-3 px-4 py-2 rounded-md text-sm font-medium ${instruction.color === 'blue' ? 'bg-blue-500/15 text-blue-100 border border-blue-400/30' :
            instruction.color === 'amber' ? 'bg-yellow-400/15 text-yellow-100 border border-yellow-400/30' :
              instruction.color === 'green' ? 'bg-green-500/15 text-green-100 border border-green-400/30' :
                'bg-red-500/15 text-red-100 border border-red-400/30'
            }`}>
            {instruction.text}
          </div>
        )}

        <div className="mx-4 sm:mx-6">
          <OrderLogisticsTracking
            order={order}
            view="buyer"
            isPhysical={productType.toLowerCase() === 'physical'}
            formatCurrency={(value, currency) => formatOrderCurrency(value || 0, currency || order.currency)}
          />
        </div>

        <div className="p-4 sm:p-6 space-y-2 sm:space-y-3">
          {order.items.slice(0, 2).map((item, idx) => (
            <div key={idx} className={itemClasses}>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-semibold text-white truncate">{item.name}</p>
                <p className="text-xs text-white/70">Qty {item.quantity || 1}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-white">{formatOrderCurrency(item.price || 0, order.currency)}</p>
            </div>
          ))}
          {order.items.length > 2 && (
            <p className="text-xs sm:text-sm text-center text-white/70 py-1 sm:py-2">
              + {order.items.length - 2} more item{order.items.length - 2 > 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="p-4 sm:p-6 pt-0 flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {mainImage && (
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full overflow-hidden border-2 border-white/15">
                <img src={mainImage} alt="Seller" className="h-full w-full object-cover" />
              </div>
            )}
            <div>
              <p className="text-xs text-white/70">Seller</p>
              <p className="text-sm sm:text-base font-semibold text-white">
                {order.seller?.shopName || order.seller?.name || 'Store'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none border-white/20 hover:bg-white/10 text-white text-xs sm:text-sm"
              onClick={() => onViewDetails(order)}
            >
              View Details
            </Button>

            {canConfirmReceipt && (
              <Button
                size="sm"
                className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs sm:text-sm"
                onClick={() => onConfirmReceipt(order.id)}
              >
                {getConfirmReceiptLabel(order)}
              </Button>
            )}

            {isPaidOrder(order) && isDigitalOrder(order) && (
              <Button
                size="sm"
                className="flex-1 sm:flex-none bg-yellow-500 hover:bg-yellow-600 text-black font-semibold text-xs sm:text-sm gap-1.5"
                onClick={() => onDownload(order)}
                disabled={downloadingOrderId === order.id}
              >
                {downloadingOrderId === order.id ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {downloadProgress[order.id] !== undefined
                      ? `Downloading ${downloadProgress[order.id]}%`
                      : 'Preparing...'}
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </>
                )}
              </Button>
            )}

            {order.seller && (
              <Button
                size="sm"
                className={`font-semibold text-xs sm:text-sm ${clientStatus[order.seller.id]
                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50'
                  : 'bg-yellow-500 hover:bg-yellow-600 text-black'
                  }`}
                onClick={() => onToggleClientStatus(order.seller.id, order.seller.name || '')}
                disabled={isBecomingClient[order.seller.id]}
              >
                {isBecomingClient[order.seller.id] ? (
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                  <>
                    <Users className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    {clientStatus[order.seller.id] ? 'Unfollow' : 'Follow'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


