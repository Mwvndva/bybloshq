import { useEffect, useState, useCallback } from 'react';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isValid, parseISO } from 'date-fns';

// Type for objects that might have date properties
type DateLike = string | Date | { createdAt?: string | Date; created_at?: string | Date };

// Helper function to safely format dates
const formatDate = (dateInput: DateLike | null | undefined): string => {
  if (!dateInput) return 'Date not available';

  try {
    // Extract the date string/object from the input
    let dateValue: string | Date;

    if (dateInput instanceof Date) {
      dateValue = dateInput;
    } else if (typeof dateInput === 'string') {
      dateValue = dateInput;
    } else {
      // Handle object with either createdAt or created_at
      const dateObj = dateInput as { createdAt?: string | Date; created_at?: string | Date };
      dateValue = dateObj.createdAt || dateObj.created_at || '';
    }

    if (!dateValue) return 'Date not available';

    // Convert to Date object if it's a string
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;

    if (!isValid(date)) {
      console.warn('Invalid date:', dateValue);
      return 'Date not available';
    }

    return format(date, 'MMM d, yyyy h:mm a');
  } catch (error) {
    console.error('Error formatting date:', error, 'Input:', dateInput);
    return 'Date not available';
  }
};

// Helper function to safely format currency values
const formatCurrency = (value: number | undefined, currency: string = 'KSH') => {
  if (value === undefined || isNaN(value)) return `${currency} 0`;
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

import { ArrowRight, Clock, CheckCircle, XCircle, Truck, Package, RefreshCw, Handshake, FileText } from 'lucide-react';
import { Order, OrderStatus, PaymentStatus } from '@/types/order';
import buyerApi from '@/api/buyerApi';
import { toast } from 'sonner';

const getStatusBadge = (status: string) => {
  // Convert to uppercase for comparison, default to 'PENDING' if status is falsy
  const statusValue = status?.toUpperCase() || 'PENDING';
  switch (statusValue) {
    case 'PENDING':
      return (
        <Badge className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'DELIVERY_PENDING':
      return (
        <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
          <Truck className="h-3 w-3 mr-1" />
          Delivery Pending
        </Badge>
      );
    case 'DELIVERY_COMPLETE':
      return (
        <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
          <Package className="h-3 w-3 mr-1" />
          Delivery Complete
        </Badge>
      );
    case 'COMPLETED':
      return (
        <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case 'CANCELLED':
      return (
        <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
          <XCircle className="h-3 w-3 mr-1" />
          Cancelled
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case 'SERVICE_PENDING':
      return (
        <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
          <CheckCircle className="h-3 w-3 mr-1" />
          Service Pending
        </Badge>
      );
    case 'CONFIRMED':
      return (
        <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
          <CheckCircle className="h-3 w-3 mr-1" />
          Confirmed
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gradient-to-r from-gray-500 to-gray-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
          <Package className="h-3 w-3 mr-1" />
          {status}
        </Badge>
      );
  }
};

const getPaymentStatusBadge = (status?: string) => {
  // Convert to lowercase for comparison, default to 'pending' if status is falsy
  const statusValue = (status?.toLowerCase() || 'pending') as PaymentStatus;
  switch (statusValue) {
    case 'pending':
      return (
        <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'success':
    case 'completed':
    case 'paid':
      return (
        <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
          <CheckCircle className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    case 'failed':
      return (
        <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case 'reversed':
      return (
        <Badge className="bg-gradient-to-r from-gray-500 to-gray-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
          <XCircle className="h-3 w-3 mr-1" />
          Reversed
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gradient-to-r from-gray-500 to-gray-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
          {status}
        </Badge>
      );
  }
};

export default function OrdersSection() {
  const { user } = useBuyerAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user) {

      return;
    }


    setIsLoading(true);
    setError(null);

    try {

      const orders = await buyerApi.getOrders();

      setOrders(orders);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load orders. Please try again later.';
      console.error('Error details:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);



  const [isConfirming, setIsConfirming] = useState<string | null>(null);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  const getConfirmationContent = () => {
    const order = orders.find(o => o.id === currentOrderId);
    if (!order) return null;

    // Check if it's a service order (either by status or items)
    const isService = order.status === 'CONFIRMED' || order.items.some((i: any) => i.productType === 'service' || i.isService);

    if (isService) {
      return (
        <div className="space-y-4">
          <p>By clicking <strong>"Confirm Receipt"</strong>, you agree that you have received the service satisfactorily.</p>
          <p className="text-sm text-muted-foreground">
            This will release the funds to the seller.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p>Have you picked up and inspected your package from <strong>"Dynamic Mall, along Tomboya Street - shop number SL 32"</strong>?</p>
        <p className="text-sm text-muted-foreground">
          Please only confirm after you have physically received and inspected your package.
        </p>
      </div>
    );
  };

  const handleConfirmReceiptClick = (orderId: string) => {
    setCurrentOrderId(orderId);
    setShowReceiptDialog(true);
  };

  const handleCancelOrderClick = (orderId: string) => {
    setCurrentOrderId(orderId);
    setShowCancelDialog(true);
  };

  const handleCancelOrder = async () => {
    if (!currentOrderId) return;

    setShowCancelDialog(false);

    try {
      const result = await buyerApi.cancelOrder(currentOrderId);
      if (result.success) {
        toast.success('Order cancelled successfully');
        fetchOrders();
      } else {
        toast.error(result.message || 'Failed to cancel order');
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('An error occurred while cancelling the order');
    }
  };

  const handleConfirmReceipt = async () => {
    if (!currentOrderId) return;




    setShowReceiptDialog(false);

    setIsConfirming(currentOrderId);
    const loadingToast = toast.loading('Confirming order receipt...');

    try {

      const result = await buyerApi.confirmOrderReceipt(currentOrderId);


      if (result.success) {
        toast.success('Order marked as received. Thank you for your purchase!', { id: loadingToast });

        // Optimistically update the UI
        setOrders(prevOrders => {

          const updatedOrders = prevOrders.map(order => {
            if (order.id === currentOrderId) {

              // Create a new order object with the updated properties
              const updatedOrder: Order = {
                id: order.id,
                orderNumber: order.orderNumber,
                status: 'COMPLETED',
                totalAmount: order.totalAmount,
                currency: order.currency,
                createdAt: order.createdAt,
                updatedAt: new Date().toISOString(),
                paymentStatus: 'success',
                items: [...order.items],
                customer: { ...order.customer },
                seller: { ...order.seller },
                shippingAddress: order.shippingAddress ? { ...order.shippingAddress } : undefined
              };
              return updatedOrder;
            }
            return order;
          });

          return updatedOrders;
        });

        // Fetch fresh data from the server to ensure consistency

        try {
          await fetchOrders();

        } catch (fetchError) {
          console.error('Error refreshing orders:', fetchError);
          // Don't show error to user since we've already updated optimistically
        }
      } else {
        const errorMsg = result.message || 'Failed to confirm order receipt';
        console.error('Failed to confirm order receipt:', errorMsg);
        toast.error(errorMsg, { id: loadingToast });
      }
    } catch (error: any) {
      console.error('Error in handleConfirmReceipt:', error);
      const errorMsg = error.response?.data?.message || error.message || 'An error occurred while confirming order receipt';
      console.error('Error details:', errorMsg);

      // More specific error handling
      if (error.code === 'ECONNABORTED') {
        toast.error('Request timed out. Please check your internet connection and try again.', { id: loadingToast });
      } else if (error.response) {
        // Server responded with an error status code
        toast.error(`Server error: ${errorMsg}`, { id: loadingToast });
      } else if (error.request) {
        // No response received
        toast.error('No response from server. Please check your internet connection.', { id: loadingToast });
      } else {
        // Something else went wrong
        toast.error(`Error: ${errorMsg}`, { id: loadingToast });
      }
    } finally {
      setIsConfirming(null);

    }
  };

  // Always use real data from the API
  const displayOrders = orders;

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-gradient-to-br from-white to-gray-50 border-0 shadow hover:shadow-md transition-all duration-300">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0">
                <div className="space-y-3 sm:space-y-4 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <Skeleton className="h-5 sm:h-6 w-32 sm:w-40 mb-2" />
                      <Skeleton className="h-3 sm:h-4 w-24 sm:w-32" />
                    </div>
                    <Skeleton className="h-6 w-20 sm:w-24 self-start sm:self-auto" />
                  </div>
                  <div>
                    <Skeleton className="h-4 sm:h-5 w-16 sm:w-20 mb-2" />
                    <div className="space-y-2">
                      <Skeleton className="h-8 sm:h-10 w-full rounded-lg" />
                      <Skeleton className="h-8 sm:h-10 w-3/4 rounded-lg" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-0 lg:space-y-3 lg:min-w-[200px]">
                  <div className="flex-1 sm:flex-none">
                    <Skeleton className="h-6 sm:h-7 w-24 sm:w-32 mb-1" />
                    <Skeleton className="h-3 w-16 sm:w-20" />
                  </div>
                  <div className="w-full sm:w-auto lg:w-full space-y-2">
                    <Skeleton className="h-8 sm:h-9 w-full rounded-md" />
                    <Skeleton className="h-8 sm:h-9 w-full rounded-md" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={fetchOrders} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  if (displayOrders.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-yellow-400/20 to-yellow-500/20 rounded-full flex items-center justify-center mb-4">
          <Package className="h-8 w-8 text-yellow-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders yet</h3>
        <p className="text-gray-500 max-w-md mx-auto mb-6">Your orders will appear here once you make a purchase.</p>
        <Button
          onClick={() => (window.location.href = '/shop')}
          className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200"
        >
          Start Shopping
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {displayOrders.map((order) => (
        <Card key={order.id} className="bg-gradient-to-br from-white to-gray-50 border-0 shadow hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0">
              {/* Order Information Section */}
              <div className="space-y-3 sm:space-y-4 flex-1">
                {/* Order Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-base sm:text-lg text-gray-900">Order #{order.orderNumber || order.id}</h3>
                    <p className="text-xs sm:text-sm text-gray-500">{formatDate(order)}</p>
                  </div>
                  {/* Status Badges */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 self-start sm:self-auto">
                    {getStatusBadge(order.status)}
                    {getPaymentStatusBadge(order.paymentStatus)}
                  </div>
                </div>

                {/* Products Section */}
                <div>
                  <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">Products:</h4>
                  <ul className="space-y-2">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs sm:text-sm text-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg px-3 py-2 border border-gray-200/50">
                        <div className="flex items-center">
                          <span className="font-semibold">{item.name}</span>
                          <span className="text-gray-500 ml-2">× {item.quantity}</span>
                          {(item.isDigital || item.productType === 'digital' || (item as any).is_digital) && (
                            <Badge variant="outline" className="ml-2 text-xs border-gray-400 text-gray-900 bg-gray-100">
                              <FileText className="h-3 w-3 mr-1" />
                              Digital
                            </Badge>
                          )}
                          {(item.productType === 'service' || (item as any).isService) && (
                            <Badge variant="outline" className="ml-2 text-xs border-purple-200 text-purple-600 bg-purple-50">
                              <Handshake className="h-3 w-3 mr-1" />
                              Service
                            </Badge>
                          )}
                        </div>
                        {item.isDigital && (['success', 'completed', 'paid'].includes(order.paymentStatus?.toLowerCase() || '') || order.status === 'COMPLETED') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 sm:mt-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8"
                            onClick={async () => {
                              try {
                                toast.loading('Starting download...', { id: 'download-toast' });
                                await buyerApi.downloadDigitalProduct(order.id, item.productId);
                                toast.success('Download started', { id: 'download-toast' });
                              } catch (error) {
                                console.error('Download failed:', error);
                                toast.error('Failed to download file', { id: 'download-toast' });
                              }
                            }}
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Price and Actions Section */}
              <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-0 lg:space-y-3 lg:min-w-[200px]">
                {/* Total Amount */}
                <div className="flex-1 sm:flex-none">
                  <p className="font-bold text-lg sm:text-xl text-gray-900">
                    {formatCurrency(
                      // Handle both snake_case and camelCase
                      (order as any).total_amount !== undefined
                        ? (order as any).total_amount
                        : order.totalAmount,
                      order.currency || 'KSH'
                    )}
                  </p>
                  <p className="text-xs text-gray-500">Total Amount</p>
                </div>

                {/* Action Buttons */}
                <div className="w-full sm:w-auto lg:w-full space-y-2">
                  {order.status === 'PENDING' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto lg:w-full justify-center sm:justify-start text-red-600 hover:bg-red-50 border-red-200 hover:border-red-300 text-xs sm:text-sm font-semibold transition-all duration-200"
                      onClick={() => handleCancelOrderClick(order.id)}
                    >
                      <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      Cancel Order
                    </Button>
                  )}
                  {order.status === 'DELIVERY_COMPLETE' && (
                    <Button
                      size="sm"
                      className="w-full sm:w-auto lg:w-full justify-center sm:justify-start bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-xs sm:text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                      onClick={() => handleConfirmReceiptClick(order.id)}
                    >
                      <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      <span className="hidden sm:inline">Confirm Receipt</span>
                      <span className="sm:hidden">Confirm Receipt</span>
                    </Button>
                  )}
                  {order.status === 'CONFIRMED' && (
                    <Button
                      size="sm"
                      className="w-full sm:w-auto lg:w-full justify-center sm:justify-start bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-xs sm:text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                      onClick={() => handleConfirmReceiptClick(order.id)}
                    >
                      <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      <span className="hidden sm:inline">Mark as Completed</span>
                      <span className="sm:hidden">Done</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Cancel Order Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-[425px] bg-gradient-to-br from-white to-gray-50 border-0 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center">
                <XCircle className="h-4 w-4 text-white" />
              </div>
              Cancel Order
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              Are you sure you want to cancel this order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-3 mb-4">
            <p className="text-sm text-red-800 font-semibold">
              ⚠️ This action cannot be undone. You will receive a refund to your account balance.
            </p>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={isConfirming === currentOrderId}
              className="border-gray-300 hover:bg-gray-50"
            >
              No, Keep Order
            </Button>
            <Button
              onClick={handleCancelOrder}
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

      {/* Confirm Receipt Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="sm:max-w-[425px] bg-gradient-to-br from-white to-gray-50 border-0 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
              Confirm Package Receipt
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              {getConfirmationContent()}
            </DialogDescription>
          </DialogHeader>

          {(!orders.find(o => o.id === currentOrderId)?.items.some((i: any) => i.productType === 'service' || i.isService) &&
            orders.find(o => o.id === currentOrderId)?.status !== 'CONFIRMED') && (
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 my-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Package className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-blue-900 mb-1">Pickup Location:</p>
                    <p className="text-blue-800">
                      <strong>Dynamic Mall</strong><br />
                      Along Tomboya Street<br />
                      Shop Number: <strong>SL 32</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}

          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-3 mb-4">
            <p className="text-sm text-yellow-800 font-semibold">
              {(orders.find(o => o.id === currentOrderId)?.items.some((i: any) => i.productType === 'service' || i.isService) ||
                orders.find(o => o.id === currentOrderId)?.status === 'CONFIRMED')
                ? "⚠️ Please confirm only after the service has been delivered satisfactorily."
                : "⚠️ Please confirm only after you have physically received and inspected your package."}
            </p>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setShowReceiptDialog(false)}
              disabled={isConfirming === currentOrderId}
              className="border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmReceipt}
              disabled={isConfirming === currentOrderId}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200"
            >
              {isConfirming === currentOrderId ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm Receipt
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
