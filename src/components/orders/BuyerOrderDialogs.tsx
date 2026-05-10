import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Package, RefreshCw, Users, XCircle } from 'lucide-react';
import type { Order } from '@/types/order';
import { getImageUrl } from '@/lib/utils';
import {
  canConfirmOrderReceipt,
  formatOrderCurrency,
  formatOrderDate,
  getConfirmReceiptLabel,
  getPaymentStatusBadge,
  getStatusBadge,
  isServiceOrder
} from './ordersSectionUtils';

interface BuyerOrderDialogsProps {
  orders: Order[];
  currentOrderId: string | null;
  isConfirming: string | null;
  showCancelDialog: boolean;
  showReceiptDialog: boolean;
  selectedOrderForDetails: Order | null;
  viewingImage: string | null;
  onCancelDialogChange: (open: boolean) => void;
  onReceiptDialogChange: (open: boolean) => void;
  onSelectedOrderChange: (order: Order | null) => void;
  onViewingImageChange: (image: string | null) => void;
  onCancelOrder: () => void;
  onConfirmReceipt: () => void;
  onConfirmReceiptClick: (orderId: string) => void;
}

export function BuyerOrderDialogs({
  orders,
  currentOrderId,
  isConfirming,
  showCancelDialog,
  showReceiptDialog,
  selectedOrderForDetails,
  viewingImage,
  onCancelDialogChange,
  onReceiptDialogChange,
  onSelectedOrderChange,
  onViewingImageChange,
  onCancelOrder,
  onConfirmReceipt,
  onConfirmReceiptClick
}: BuyerOrderDialogsProps) {
  const currentOrder = orders.find(order => order.id === currentOrderId) || null;
  const currentIsService = isServiceOrder(currentOrder);
  const currentFulfillmentType = currentOrder?.fulfillment_type?.toUpperCase() || '';
  const currentIsHubCollection = currentOrder && !currentIsService && ['COURIER', 'SELLER_TO_HUB'].includes(currentFulfillmentType);
  const showPhysicalReceiptLocation = Boolean(currentIsHubCollection);

  const confirmationContent = currentIsService ? (
    <div className="space-y-4">
      <p>By clicking <strong>"Mark as Done"</strong>, you agree that the service has been completed to your satisfaction.</p>
      <p className="text-sm text-white/70">
        Once confirmed, funds will be released to the provider.
      </p>
    </div>
  ) : (
    <div className="space-y-4">
      <p>
        Have you picked up and inspected your package from{' '}
        <strong>
          "{currentIsHubCollection ? 'Dynamic Mall, Tom Mboya St, Nairobi | Shop SL 32' : currentOrder?.seller?.physicalAddress || currentOrder?.seller?.shopName || 'the seller'}"
        </strong>?
      </p>
      <p className="text-sm text-white/70">
        Please only confirm after you have physically received and inspected your package.
      </p>
    </div>
  );

  return (
    <>
      <Dialog open={showCancelDialog} onOpenChange={onCancelDialogChange}>
        <DialogContent className="sm:max-w-[425px] bg-black border border-white/15 text-white shadow-xl shadow-black/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-white">
              <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center">
                <XCircle className="h-4 w-4 text-white" />
              </div>
              Cancel Order
            </DialogTitle>
            <DialogDescription className="text-sm text-white/70 leading-relaxed">
              Are you sure you want to cancel this order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-red-500/15 border border-red-400/30 rounded-xl p-3 mb-4">
            <p className="text-sm text-red-100 font-semibold">
              This action cannot be undone. You will receive a refund to your account balance.
            </p>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => onCancelDialogChange(false)}
              disabled={isConfirming === currentOrderId}
              className="border-white/20 text-white hover:bg-white/10"
            >
              No, Keep Order
            </Button>
            <Button
              onClick={onCancelOrder}
              disabled={isConfirming === currentOrderId}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200"
            >
              {isConfirming === currentOrderId ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Yes, Cancel Order'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedOrderForDetails} onOpenChange={(open) => !open && onSelectedOrderChange(null)}>
        <DialogContent className="sm:max-w-2xl bg-black border border-white/15 text-white">
          {selectedOrderForDetails && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">
                  Order Details
                </DialogTitle>
                <DialogDescription className="text-white/70">
                  {formatOrderDate(selectedOrderForDetails)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 max-h-[60dvh] overflow-y-auto pr-2">
                {selectedOrderForDetails.items.map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-start">
                    <div
                      className="h-20 w-20 rounded-lg bg-white/5 overflow-hidden border border-white/15 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => item.imageUrl && onViewingImageChange(getImageUrl(item.imageUrl))}
                    >
                      {item.imageUrl ? (
                        <img
                          src={getImageUrl(item.imageUrl)}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-white/60" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-bold text-white leading-tight mb-1">{item.name}</h4>
                      <div className="flex items-center text-sm text-white/70 gap-3">
                        <span>Qty: {item.quantity}</span>
                        <span className="w-1 h-1 bg-white/40 rounded-full" />
                        <span className="text-white font-medium">{formatOrderCurrency(item.price * item.quantity, selectedOrderForDetails.currency)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="border-t border-white/10 my-4" />

                <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400" />
                    <p className="text-xs text-white/60 uppercase tracking-wider font-semibold">Shop Details</p>
                  </div>

                  <div className="space-y-1">
                    {selectedOrderForDetails.seller?.shopName && (
                      <p className="font-bold text-white text-lg">
                        {selectedOrderForDetails.seller.shopName}
                      </p>
                    )}

                    {selectedOrderForDetails.seller?.location && (
                      <a
                        href={selectedOrderForDetails.seller.location.startsWith('http') ? selectedOrderForDetails.seller.location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedOrderForDetails.seller.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 text-sm text-white/80 hover:text-emerald-300 transition-colors group"
                      >
                        <span>
                          {selectedOrderForDetails.seller.city ? `${selectedOrderForDetails.seller.city} - ` : ''}
                          {selectedOrderForDetails.seller.location}
                        </span>
                      </a>
                    )}
                  </div>

                  {selectedOrderForDetails.shippingAddress && (
                    <div className="pt-2 border-t border-white/10 mt-2">
                      <p className="text-xs text-white/60 mb-1">Shipping To:</p>
                      <p className="text-sm text-white/80">
                        {selectedOrderForDetails.shippingAddress.address}
                        {selectedOrderForDetails.shippingAddress.city && `, ${selectedOrderForDetails.shippingAddress.city}`}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-500/15 border border-emerald-400/30">
                  <span className="text-lg font-semibold text-white">Total</span>
                  <span className="text-2xl font-bold text-emerald-200">
                    {formatOrderCurrency((selectedOrderForDetails as any).total_amount || selectedOrderForDetails.totalAmount, selectedOrderForDetails.currency)}
                  </span>
                </div>

                <div className="flex gap-2">
                  {getStatusBadge(selectedOrderForDetails.status)}
                  {getPaymentStatusBadge(selectedOrderForDetails.paymentStatus)}
                </div>
              </div>

              <DialogFooter className="gap-2">
                {canConfirmOrderReceipt(selectedOrderForDetails) && (
                  <Button
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                    onClick={() => {
                      onConfirmReceiptClick(selectedOrderForDetails.id);
                      onSelectedOrderChange(null);
                    }}
                  >
                    {getConfirmReceiptLabel(selectedOrderForDetails)}
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="border-white/20 hover:bg-white/10 text-white"
                  onClick={() => onSelectedOrderChange(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showReceiptDialog} onOpenChange={onReceiptDialogChange}>
        <DialogContent className="sm:max-w-[425px] bg-black border border-white/15 text-white shadow-xl shadow-black/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-white">
              <div className={`w-8 h-8 bg-gradient-to-r ${currentIsService ? 'from-purple-500 to-indigo-500' : 'from-green-500 to-emerald-500'} rounded-full flex items-center justify-center`}>
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
              {currentIsService ? 'Confirm Service Completion' : 'Confirm Package Receipt'}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/70 leading-relaxed">
              {confirmationContent}
            </DialogDescription>
          </DialogHeader>

          {showPhysicalReceiptLocation && (
            <div className="bg-blue-500/15 border border-blue-400/30 rounded-xl p-4 my-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Package className="h-4 w-4 text-white" />
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-blue-100 mb-1">Pickup Location:</p>
                  <p className="text-blue-100/85">
                    <strong>Dynamic Mall</strong><br />
                    Along Tomboya Street<br />
                    Shop Number: <strong>SL 32</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-yellow-500/15 border border-yellow-400/30 rounded-xl p-3 mb-4">
            <p className="text-sm text-yellow-100 font-semibold">
              {currentIsService
                ? 'Please confirm only after the service has been delivered satisfactorily.'
                : 'Please confirm only after you have physically received and inspected your package.'}
            </p>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => onReceiptDialogChange(false)}
              disabled={isConfirming === currentOrderId}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirmReceipt}
              disabled={isConfirming === currentOrderId}
              className={`bg-gradient-to-r ${currentIsService ? 'from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600' : 'from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'} text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200`}
            >
              {isConfirming === currentOrderId ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {getConfirmReceiptLabel(currentOrder)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingImage} onOpenChange={(open) => !open && onViewingImageChange(null)}>
        <DialogContent className="sm:max-w-3xl bg-transparent border-0 shadow-none p-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-full h-full flex items-center justify-center pointer-events-auto">
            <button
              onClick={() => onViewingImageChange(null)}
              className="absolute -top-10 right-0 sm:-right-10 z-50 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors border border-white/20"
            >
              <XCircle className="h-6 w-6" />
            </button>
            {viewingImage && (
              <img
                src={viewingImage}
                alt="Full View"
                className="max-h-[85dvh] max-w-full object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
