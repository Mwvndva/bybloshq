import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Package, RefreshCw, XCircle } from 'lucide-react';
import type { ApiOrder } from '@/types/api/order';
import { getImageUrl } from '@/lib/utils';
import { getBuyerServiceCharge, getConfirmReceiptLabel, isServiceOrder } from './ordersSectionUtils';
import { OrderDetailsDialog } from './OrderDetailsDialog';

interface BuyerOrderDialogsProps {
  orders: ApiOrder[];
  currentOrderId: string | null;
  isConfirming: string | null;
  showCancelDialog: boolean;
  showReceiptDialog: boolean;
  selectedOrderForDetails: ApiOrder | null;
  viewingImage: string | null;
  onCancelDialogChange: (open: boolean) => void;
  onReceiptDialogChange: (open: boolean) => void;
  onSelectedOrderChange: (order: ApiOrder | null) => void;
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
  const selectedOrderServiceCharge = getBuyerServiceCharge(selectedOrderForDetails);

  const confirmationContent = currentIsService ? (
    <div className="space-y-4">
      <p>By clicking <strong>"Mark Service Completed"</strong>, you agree that the service has been completed to your satisfaction.</p>
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
        <DialogContent className="w-[92vw] sm:max-w-[420px] bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/10 text-slate-950 dark:text-white rounded-3xl p-5 sm:p-6 shadow-2xl transition-colors duration-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white">
              <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center">
                <XCircle className="h-4 w-4 text-white" />
              </div>
              Cancel Order
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 dark:text-white/70 leading-relaxed">
              Are you sure you want to cancel this order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-400/30 rounded-xl p-3 my-2">
            <p className="text-sm text-red-800 dark:text-red-100 font-semibold">
              This action cannot be undone. You will receive a refund to your account balance.
            </p>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => onCancelDialogChange(false)}
              disabled={isConfirming === currentOrderId}
              className="border-slate-300 dark:border-white/20 bg-white dark:bg-transparent text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
            >
              No, Keep Order
            </Button>
            <Button
              onClick={onCancelOrder}
              disabled={isConfirming === currentOrderId}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold shadow-sm hover:shadow-md transition-all duration-200"
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

      <OrderDetailsDialog order={selectedOrderForDetails} serviceCharge={selectedOrderServiceCharge} onClose={() => onSelectedOrderChange(null)} onViewImage={onViewingImageChange} onConfirmReceiptClick={onConfirmReceiptClick} />

      <Dialog open={showReceiptDialog} onOpenChange={onReceiptDialogChange}>
        <DialogContent className="w-[92vw] sm:max-w-[420px] bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/10 text-slate-950 dark:text-white rounded-3xl p-5 sm:p-6 shadow-2xl transition-colors duration-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white">
              <div className={`w-8 h-8 bg-gradient-to-r ${currentIsService ? 'from-purple-500 to-indigo-500' : 'from-green-500 to-emerald-500'} rounded-full flex items-center justify-center`}>
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
              {currentIsService ? 'Confirm Service Completion' : 'Confirm Package Receipt'}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 dark:text-white/70 leading-relaxed">
              {confirmationContent}
            </DialogDescription>
          </DialogHeader>

          {showPhysicalReceiptLocation && (
            <div className="bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-400/30 rounded-xl p-4 my-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Package className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-blue-900 dark:text-blue-100">Delivery Confirmation</h5>
                  <p className="text-xs text-blue-700 dark:text-blue-200/80 mt-1 leading-relaxed">
                    By clicking confirm below, you verify that you have physically inspected your order and received it in good condition.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => onReceiptDialogChange(false)}
              disabled={isConfirming === currentOrderId}
              className="border-slate-300 dark:border-white/20 bg-white dark:bg-transparent text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
            >
              Not Yet
            </Button>
            <Button
              onClick={onConfirmReceipt}
              disabled={isConfirming === currentOrderId}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-sm hover:shadow-md transition-all duration-200"
            >
              {isConfirming === currentOrderId ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                'Yes, I Have Received It'
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


