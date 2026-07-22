import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Users } from 'lucide-react';
import type { ApiOrder } from '@/types/api/order';
import { getImageUrl } from '@/lib/utils';
import { canConfirmOrderReceipt, formatOrderCurrency, formatOrderDate, getConfirmReceiptLabel, getPaymentStatusBadge, getStatusBadge } from './ordersSectionUtils';

interface OrderDetailsDialogProps {
  order: ApiOrder | null;
  serviceCharge: number;
  onClose: () => void;
  onViewImage: (image: string | null) => void;
  onConfirmReceiptClick: (orderId: string) => void;
}

export function OrderDetailsDialog({ order, serviceCharge, onClose, onViewImage, onConfirmReceiptClick }: OrderDetailsDialogProps) {
  return (
      <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[92vw] sm:max-w-xl bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/10 text-slate-950 dark:text-white rounded-3xl p-5 sm:p-6 shadow-2xl transition-colors duration-200">
          {order && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-slate-950 dark:text-white">
                  Order Details
                </DialogTitle>
                <DialogDescription className="text-slate-500 dark:text-white/70">
                  {formatOrderDate(order)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 max-h-[60dvh] overflow-y-auto pr-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-start">
                    <div
                      className="h-20 w-20 rounded-xl bg-slate-100 dark:bg-white/5 overflow-hidden border border-slate-200 dark:border-white/15 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => item.imageUrl && onViewImage(getImageUrl(item.imageUrl))}
                    >
                      {item.imageUrl ? (
                        <img
                          src={getImageUrl(item.imageUrl)}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-slate-400 dark:text-white/60" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-bold text-slate-950 dark:text-white leading-tight mb-1">{item.name}</h4>
                      <div className="flex items-center text-sm text-slate-600 dark:text-white/70 gap-3">
                        <span>Qty: {item.quantity}</span>
                        <span className="w-1 h-1 bg-slate-300 dark:bg-white/40 rounded-full" />
                        <span className="text-slate-950 dark:text-white font-semibold">{formatOrderCurrency(item.price * item.quantity, order.currency)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="border-t border-slate-200 dark:border-white/10 my-4" />

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs text-slate-500 dark:text-white/60 uppercase tracking-wider font-semibold">Shop Details</p>
                  </div>

                  <div className="space-y-1">
                    {order.seller?.shopName && (
                      <p className="font-bold text-slate-950 dark:text-white text-lg">
                        {order.seller.shopName}
                      </p>
                    )}

                    {order.seller?.location && (
                      <a
                        href={order.seller.location.startsWith('http') ? order.seller.location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.seller.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 text-sm text-slate-700 dark:text-white/80 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors group"
                      >
                        <span>
                          {order.seller.city ? `${order.seller.city} - ` : ''}
                          {order.seller.location}
                        </span>
                      </a>
                    )}
                  </div>

                  {order.shippingAddress && (
                    <div className="pt-2 border-t border-slate-200 dark:border-white/10 mt-2">
                      <p className="text-xs text-slate-500 dark:text-white/60 mb-1">Shipping To:</p>
                      <p className="text-sm text-slate-800 dark:text-white/80">
                        {order.shippingAddress.address}
                        {order.shippingAddress.city && `, ${order.shippingAddress.city}`}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-400/30">
                  <div>
                    <span className="text-lg font-bold text-slate-950 dark:text-white">Total</span>
                    <p className="mt-1 text-xs font-medium text-slate-600 dark:text-white/60">
                      Includes 2% Byblos service charge{serviceCharge > 0 ? ` (${formatOrderCurrency(serviceCharge, order.currency)})` : ''}
                    </p>
                  </div>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-200 text-right">
                    {formatOrderCurrency((order as unknown as Record<string, unknown>).total_amount as number || order.totalAmount, order.currency)}
                  </span>
                </div>

                <div className="flex gap-2">
                  {getStatusBadge(order.status)}
                  {getPaymentStatusBadge(order.paymentStatus)}
                </div>
              </div>

              <DialogFooter className="gap-2">
                {canConfirmOrderReceipt(order) && (
                  <Button
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                    onClick={() => {
                      onConfirmReceiptClick(order.id);
                      onClose();
                    }}
                  >
                    {getConfirmReceiptLabel(order)}
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="border-slate-300 dark:border-white/20 bg-white dark:bg-transparent text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                  onClick={() => onClose()}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
  );
}
