import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { format, isValid, parseISO } from 'date-fns';
import { Order, OrderStatus, PaymentStatus } from '@/types/order';

// Helper function to safely format dates
const formatDate = (dateString: string | Date) => {
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
  return isValid(date) ? format(date, 'MMM d, yyyy') : 'Date not available';
};

// Helper function to safely format currency values
const formatCurrency = (value: number | undefined, currency: string = 'KSH') => {
  if (value === undefined || isNaN(value)) return `${currency} 0.00`;
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
import { Clock, Package, Truck, CheckCircle, RefreshCw, XCircle, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { sellerApi } from '@/api/sellerApi';

export default function SellerOrdersSection() {
  // Force TS re-check
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPickupDialog, setShowPickupDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  const { toast } = useToast();

  // Fetch orders from the API
  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const ordersData = await sellerApi.getOrders();
      setOrders(ordersData);
      console.log('Fetched Orders:', ordersData);
      ordersData.forEach(order => {
        console.log(`Order ${order.orderNumber} status:`, order.status);
        console.log(`Order ${order.orderNumber} metadata:`, order.metadata);
      });
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      toast({
        title: 'Error',
        description: 'Failed to load orders. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchOrders();
  }, []);

  const handleReadyForPickupClick = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowPickupDialog(true);
  };

  const markAsReadyForPickup = async () => {
    if (!selectedOrderId) return;

    try {
      setIsUpdating(true);
      setShowPickupDialog(false);

      // Update order status to DELIVERY_COMPLETE
      const updatedOrder = await sellerApi.updateOrderStatus(selectedOrderId, 'DELIVERY_COMPLETE' as OrderStatus);

      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === selectedOrderId ? {
            ...order,
            status: 'DELIVERY_COMPLETE' as const,
            paymentStatus: (updatedOrder.paymentStatus?.toLowerCase() || 'paid') as PaymentStatus,
            updatedAt: new Date().toISOString()
          } : order
        )
      );

      toast({
        title: 'Order Ready for Pickup',
        description: 'The buyer has been notified that their order is ready for pickup.',
      });
    } catch (err) {
      console.error('Failed to update order status:', err);
      toast({
        title: 'Error',
        description: 'Failed to mark order as ready for pickup. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
      setSelectedOrderId(null);
    }
  };

  const markAsDelivered = async (orderId: string) => {
    try {
      setIsUpdating(true);
      const updatedOrder = await sellerApi.updateOrderStatus(orderId, 'DELIVERY_COMPLETE' as OrderStatus);

      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? {
            ...updatedOrder,
            status: 'DELIVERY_COMPLETE' as const,
            paymentStatus: (updatedOrder.paymentStatus?.toLowerCase() || 'completed') as PaymentStatus
          } : order
        )
      );

      toast({
        title: 'Order Delivered',
        description: 'The order has been marked as delivered.',
      });
    } catch (err) {
      console.error('Failed to update order status:', err);
      toast({
        title: 'Error',
        description: 'Failed to mark order as delivered. Please try again.',
        variant: 'destructive',
      });
      setIsUpdating(false);
    }
  };

  const markAsServiceCompleted = async (orderId: string) => {
    try {
      setIsUpdating(true);
      // Use COMPLETED status for services
      const updatedOrder = await sellerApi.updateOrderStatus(orderId, 'COMPLETED' as OrderStatus);

      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? {
            ...updatedOrder,
            status: 'COMPLETED' as const,
            paymentStatus: (updatedOrder.paymentStatus?.toLowerCase() || 'completed') as PaymentStatus
          } : order
        )
      );

      toast({
        title: 'Service Completed',
        description: 'The service booking has been marked as completed.',
      });
    } catch (err) {
      console.error('Failed to update order status:', err);
      toast({
        title: 'Error',
        description: 'Failed to mark service as completed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelClick = (orderId: string) => {
    setCancellingOrderId(orderId);
    setShowCancelDialog(true);
  };

  const cancelOrder = async () => {
    if (!cancellingOrderId) return;

    setShowCancelDialog(false);

    try {
      setIsUpdating(true);
      const result = await sellerApi.cancelOrder(cancellingOrderId);

      // Update the order status in the list
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === cancellingOrderId ? {
            ...order,
            status: 'CANCELLED' as const,
            paymentStatus: 'reversed' as const
          } : order
        )
      );

      toast({
        title: 'Order Cancelled',
        description: `The order has been cancelled. Buyer will receive a refund of KSh ${result.refundAmount?.toLocaleString() || '0'}.`,
      });
    } catch (err: any) {
      console.error('Failed to cancel order:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to cancel order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {[1, 2].map((i) => (
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

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-yellow-400/20 to-yellow-500/20 rounded-full flex items-center justify-center mb-4">
          <Package className="h-8 w-8 text-yellow-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders yet</h3>
        <p className="text-gray-500 max-w-md mx-auto">Your orders will appear here when customers purchase your products.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        {orders.map((order) => {
          const isService = order.metadata?.product_type === 'service' || order.items?.some(i => i.productType === 'service');
          const isDigital = order.items?.some(i => i.productType === 'digital');

          let cardClasses = "transition-all duration-300 transform hover:-translate-y-1 ";
          let itemClasses = "text-xs sm:text-sm text-gray-700 rounded-lg px-3 py-2 border ";

          if (isService) {
            cardClasses += "bg-gradient-to-br from-purple-50 to-white border border-purple-200 shadow-sm hover:shadow-md";
            itemClasses += "bg-gradient-to-r from-purple-50/50 to-purple-100/50 border-purple-100";
          } else if (isDigital) {
            cardClasses += "bg-gradient-to-br from-red-50 to-white border border-red-200 shadow-sm hover:shadow-md";
            itemClasses += "bg-gradient-to-r from-red-50/50 to-red-100/50 border-red-100";
          } else {
            cardClasses += "bg-gradient-to-br from-white to-gray-50 border-0 shadow hover:shadow-md";
            itemClasses += "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200/50";
          }

          return (
            <Card key={order.id} className={cardClasses}>
              <CardContent className="p-4 sm:p-6">
                {/* Mobile-first responsive layout */}
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0">
                  {/* Order Information Section */}
                  <div className="space-y-3 sm:space-y-4 flex-1">
                    {/* Order Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-base sm:text-lg text-gray-900">Order #{order.orderNumber}</h3>
                        <p className="text-xs sm:text-sm text-gray-500">{formatDate(order.createdAt)}</p>
                      </div>
                      {/* Status Badge - positioned for mobile */}
                      <div className="self-start sm:self-auto">
                        {order.status === 'COMPLETED' ? (
                          <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                            <CheckCircle className="h-3 w-3 mr-1" /> Completed
                          </Badge>
                        ) : order.status === 'DELIVERY_COMPLETE' ? (
                          <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                            <Package className="h-3 w-3 mr-1" /> Delivery Complete
                          </Badge>
                        ) : order.status === 'DELIVERY_PENDING' ? (
                          <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                            <Truck className="h-3 w-3 mr-1" /> Delivery Pending
                          </Badge>
                        ) : order.status === 'FAILED' ? (
                          <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                            <XCircle className="h-3 w-3 mr-1" /> Failed
                          </Badge>
                        ) : order.status === 'CANCELLED' ? (
                          <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                            <XCircle className="h-3 w-3 mr-1" /> Cancelled
                          </Badge>
                        ) : order.status === 'SERVICE_PENDING' ? (
                          <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                            <CheckCircle className="h-3 w-3 mr-1" /> Service Pending
                          </Badge>
                        ) : order.status === 'COLLECTION_PENDING' ? (
                          <Badge className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                            <Package className="h-3 w-3 mr-1" /> Ready for Collection
                          </Badge>
                        ) : (
                          <Badge className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                            <Clock className="h-3 w-3 mr-1" /> Pending
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Products Section */}
                    <div>
                      <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">Products:</h4>
                      <ul className="space-y-2">
                        {order.items && order.items.length > 0 ? (
                          order.items.map((item) => (
                            <li key={item.id} className={itemClasses}>
                              <span className="font-semibold">{item.name}</span>
                              <span className="text-gray-500 ml-2">× {item.quantity}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-xs sm:text-sm text-gray-500 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg px-3 py-2 border border-gray-200/50">No items in this order</li>
                        )}
                      </ul>
                    </div>

                    {/* Service Booking Details */}
                    {(order.metadata?.booking_date || order.metadata?.service_location) && (
                      <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-white rounded-lg border border-purple-100 shadow-sm">
                        <h4 className="flex items-center text-sm font-semibold text-purple-900 mb-2">
                          <Calendar className="h-4 w-4 mr-2 text-purple-600" />
                          Service Booking Details
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div className="bg-white/60 p-2 rounded border border-purple-50">
                            <p className="text-purple-600 text-xs font-medium mb-1">Date & Time</p>
                            <p className="font-semibold text-gray-900">
                              {order.metadata.booking_date ? formatDate(order.metadata.booking_date) : 'N/A'}
                              {order.metadata.booking_time && <span className="text-gray-500 font-normal"> at {order.metadata.booking_time}</span>}
                            </p>
                          </div>
                          <div className="bg-white/60 p-2 rounded border border-purple-50">
                            <p className="text-purple-600 text-xs font-medium mb-1">Location</p>
                            <p className="font-semibold text-gray-900 break-words">
                              {order.metadata.service_location || 'Not specified'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Price and Actions Section */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-0 lg:space-y-3 lg:min-w-[200px]">
                    {/* Total Amount */}
                    <div className="flex-1 sm:flex-none">
                      <p className="font-bold text-lg sm:text-xl text-gray-900">
                        {formatCurrency(order.totalAmount, order.currency)}
                      </p>
                      <p className="text-xs text-gray-500">Total Amount</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="w-full sm:w-auto lg:w-full">
                      {order.status === 'PENDING' && (
                        <div className="space-y-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto lg:w-full justify-center sm:justify-start text-red-600 hover:bg-red-50 border-red-200 hover:border-red-300 text-xs sm:text-sm font-semibold transition-all duration-200"
                            onClick={() => handleCancelClick(order.id)}
                            disabled={isUpdating}
                          >
                            <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                            Cancel Order
                          </Button>
                        </div>
                      )}
                      {order.status === 'DELIVERY_PENDING' &&
                        (['success', 'completed', 'paid'].includes(order.paymentStatus?.toLowerCase() || '')) && (
                          <div className="space-y-2">
                            <Button
                              size="sm"
                              className="w-full sm:w-auto lg:w-full justify-center sm:justify-start bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs sm:text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                              onClick={() => handleReadyForPickupClick(order.id)}
                              disabled={isUpdating}
                            >
                              <Truck className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                              <span className="hidden sm:inline">Mark as Ready for Pickup</span>
                              <span className="sm:hidden">Ready for Pickup</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto lg:w-full justify-center sm:justify-start text-red-600 hover:bg-red-50 border-red-200 hover:border-red-300 text-xs sm:text-sm font-semibold transition-all duration-200"
                              onClick={() => handleCancelClick(order.id)}
                              disabled={isUpdating}
                            >
                              <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                              Cancel Order
                            </Button>
                          </div>
                        )}
                      {order.status === 'SERVICE_PENDING' &&
                        (['success', 'completed', 'paid'].includes(order.paymentStatus?.toLowerCase() || '')) && (
                          <div className="space-y-2">
                            <Button
                              size="sm"
                              className="w-full sm:w-auto lg:w-full justify-center sm:justify-start bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs sm:text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                              onClick={() => {
                                // Reuse delivery complete logic but update status to CONFIRMED
                                const confirmServiceOrder = async () => {
                                  try {
                                    setIsUpdating(true);
                                    const updatedOrder = await sellerApi.updateOrderStatus(order.id, 'CONFIRMED' as OrderStatus);
                                    setOrders(prevOrders =>
                                      prevOrders.map(o =>
                                        o.id === order.id ? {
                                          ...updatedOrder,
                                          status: 'CONFIRMED' as const,
                                          paymentStatus: (updatedOrder.paymentStatus?.toLowerCase() || 'paid') as PaymentStatus
                                        } : o
                                      )
                                    );
                                    toast({
                                      title: 'Order Confirmed',
                                      description: 'The service booking has been confirmed. Waiting for buyer to mark as completed.',
                                    });
                                  } catch (err) {
                                    console.error('Failed to confirm order:', err);
                                    toast({
                                      title: 'Error',
                                      description: 'Failed to confirm order. Please try again.',
                                      variant: 'destructive',
                                    });
                                  } finally {
                                    setIsUpdating(false);
                                  }
                                };
                                confirmServiceOrder();
                              }}
                              disabled={isUpdating}
                            >
                              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                              <span className="hidden sm:inline">Confirm Order</span>
                              <span className="sm:hidden">Confirm</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto lg:w-full justify-center sm:justify-start text-red-600 hover:bg-red-50 border-red-200 hover:border-red-300 text-xs sm:text-sm font-semibold transition-all duration-200"
                              onClick={() => handleCancelClick(order.id)}
                              disabled={isUpdating}
                            >
                              <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                              Cancel Order
                            </Button>
                          </div>
                        )}
                      {order.status === 'CONFIRMED' && (
                        <div className="space-y-2">
                          <Badge className="w-full justify-center bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending Buyer Completion
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div >

      {/* Ready for Pickup Confirmation Dialog */}
      <Dialog open={showPickupDialog} onOpenChange={setShowPickupDialog}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-white to-gray-50 border-0 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                <Truck className="h-4 w-4 text-white" />
              </div>
              Confirm Package Drop-off
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              Have you dropped off the package at the specified location?
            </DialogDescription>
          </DialogHeader>

          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 my-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Package className="h-4 w-4 text-white" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-blue-900 mb-1">Drop-off Location:</p>
                <p className="text-blue-800">
                  <strong>Dynamic Mall</strong><br />
                  Along Tomboya Street<br />
                  Shop Number: <strong>SL 32</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-3 mb-4">
            <p className="text-sm text-yellow-800 font-semibold">
              ⚠️ Please confirm only after the package has been physically dropped off at the specified location.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowPickupDialog(false)}
              disabled={isUpdating}
              className="w-full sm:w-auto border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={markAsReadyForPickup}
              disabled={isUpdating}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Drop-off
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              Are you sure you want to cancel this order?
              <br /><br />
              The buyer will receive a full refund to their account balance.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-3 mb-4">
            <p className="text-sm text-red-800 font-semibold">
              ⚠️ This action cannot be undone. The buyer will be notified of the cancellation.
            </p>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={isUpdating}
              className="border-gray-300 hover:bg-gray-50"
            >
              No, Keep Order
            </Button>
            <Button
              onClick={cancelOrder}
              disabled={isUpdating}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200"
            >
              {isUpdating ? (
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
    </>
  );
}
