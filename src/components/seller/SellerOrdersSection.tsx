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
import { Clock, Package, Truck, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { sellerApi } from '@/api/sellerApi';

export default function SellerOrdersSection() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPickupDialog, setShowPickupDialog] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Debug log for order statuses
  useEffect(() => {
    if (orders.length > 0) {
      console.log('Orders data:', orders.map(order => ({
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.totalAmount
      })));
    }
  }, [orders]);
  const { toast } = useToast();

  // Fetch orders from the API
  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const ordersData = await sellerApi.getOrders();
      setOrders(ordersData);
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

  const markAsShipped = async (orderId: string) => {
    try {
      setIsUpdating(true);
      // Update order status in the database
      const updatedOrder = await sellerApi.updateOrderStatus(orderId, 'READY_FOR_PICKUP' as OrderStatus);
      
      // Update local state with proper typing
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? { 
            ...updatedOrder,
            status: 'READY_FOR_PICKUP' as const,
            paymentStatus: (updatedOrder.paymentStatus?.toLowerCase() || 'pending') as PaymentStatus
          } : order
        )
      );
      
      toast({
        title: 'Order Updated',
        description: 'Order has been marked as ready for pickup.',
      });
    } catch (err) {
      console.error('Failed to update order status:', err);
      toast({
        title: 'Error',
        description: 'Failed to update order status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReadyForPickupClick = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowPickupDialog(true);
  };

  const markAsReadyForPickup = async () => {
    if (!selectedOrderId) return;
    
    try {
      setIsUpdating(true);
      setShowPickupDialog(false);
      
      // Use uppercase 'READY_FOR_PICKUP' to match database enum
      const updatedOrder = await sellerApi.updateOrderStatus(selectedOrderId, 'READY_FOR_PICKUP' as any);
      
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === selectedOrderId ? { 
            ...order, // Keep all existing order properties
            status: 'READY_FOR_PICKUP' as const,
            paymentStatus: (updatedOrder.paymentStatus?.toLowerCase() || 'pending') as PaymentStatus,
            updatedAt: new Date().toISOString() // Update the updatedAt timestamp
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
        description: 'Failed to update order status. Please try again.',
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
    } finally {
      setIsUpdating(false);
    }
  };
  
  const cancelOrder = async (orderId: string) => {
    const confirmationMessage = 'Are you sure you want to cancel this order?\n\nThe buyer will receive a full refund to their account balance.';
    
    if (!window.confirm(confirmationMessage)) {
      return; // User cancelled the action
    }
    
    try {
      setIsUpdating(true);
      const result = await sellerApi.cancelOrder(orderId);
      
      // Remove the order from the list or update its status
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? { 
            ...order,
            status: 'CANCELLED' as const,
            paymentStatus: 'cancelled' as const
          } : order
        )
      );
      
      toast({
        title: 'Order Cancelled',
        description: `The order has been cancelled. Buyer will receive a refund of KSh ${result.refundAmount.toLocaleString()}.`,
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
          <Card key={i} className="p-4 sm:p-6">
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
          </Card>
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12 px-4">
        <Package className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-gray-400 mb-3 sm:mb-4" />
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1 sm:mb-2">No orders yet</h3>
        <p className="text-sm sm:text-base text-gray-500 max-w-md mx-auto">Your orders will appear here when customers purchase your products.</p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4 sm:space-y-6">
      {orders.map((order) => (
        <Card key={order.id} className="p-4 sm:p-6">
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
                    <Badge className="bg-green-100 text-green-800 text-xs sm:text-sm">
                      <CheckCircle className="h-3 w-3 mr-1" /> Completed
                    </Badge>
                  ) : order.status === 'READY_FOR_PICKUP' ? (
                    <Badge className="bg-blue-100 text-blue-800 text-xs sm:text-sm">
                      <Truck className="h-3 w-3 mr-1" /> Ready for Pickup
                    </Badge>
                  ) : order.status === 'FAILED' ? (
                    <Badge className="bg-red-100 text-red-800 text-xs sm:text-sm">
                      <XCircle className="h-3 w-3 mr-1" /> Failed
                    </Badge>
                  ) : order.status === 'CANCELLED' ? (
                    <Badge className="bg-red-100 text-red-800 text-xs sm:text-sm">
                      <XCircle className="h-3 w-3 mr-1" /> Cancelled
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs sm:text-sm">
                      <Clock className="h-3 w-3 mr-1" /> Pending
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Products Section */}
              <div>
                <h4 className="text-sm sm:text-base font-medium text-gray-900 mb-2">Products:</h4>
                <ul className="space-y-1 sm:space-y-2">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item) => (
                      <li key={item.id} className="text-xs sm:text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-gray-500 ml-2">× {item.quantity}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-xs sm:text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">No items in this order</li>
                  )}
                </ul>
              </div>
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
                      className="w-full sm:w-auto lg:w-full justify-center sm:justify-start bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 text-xs sm:text-sm"
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
                      className="w-full sm:w-auto lg:w-full justify-center sm:justify-start text-red-600 hover:bg-red-50 border-red-200 text-xs sm:text-sm"
                    onClick={() => cancelOrder(order.id)}
                    disabled={isUpdating}
                  >
                      <Package className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    Cancel Order
                  </Button>
                </div>
              )}
              {order.status === 'READY_FOR_PICKUP' && 
               (order.paymentStatus?.toLowerCase() === 'completed') && (
                  <div className="space-y-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                      className="w-full sm:w-auto lg:w-full justify-center sm:justify-start bg-green-50 hover:bg-green-100 text-green-700 border-green-200 text-xs sm:text-sm"
                    onClick={() => markAsDelivered(order.id)}
                    disabled={isUpdating}
                  >
                      <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      <span className="hidden sm:inline">Mark as Delivered</span>
                      <span className="sm:hidden">Mark Delivered</span>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                      className="w-full sm:w-auto lg:w-full justify-center sm:justify-start text-red-600 hover:bg-red-50 border-red-200 text-xs sm:text-sm"
                    onClick={() => cancelOrder(order.id)}
                    disabled={isUpdating}
                  >
                      <Package className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    Cancel Order
                  </Button>
                </div>
              )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>

    {/* Ready for Pickup Confirmation Dialog */}
    <Dialog open={showPickupDialog} onOpenChange={setShowPickupDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Truck className="h-5 w-5 text-blue-600" />
            Confirm Package Drop-off
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 leading-relaxed">
            Have you dropped off the package at the specified location?
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
          <div className="flex items-start gap-3">
            <Package className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 mb-1">Drop-off Location:</p>
              <p className="text-blue-800">
                <strong>Dynamic Mall</strong><br />
                Along Tomboya Street<br />
                Shop Number: <strong>SL 32</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-yellow-800 font-medium">
            ⚠️ Please confirm only after the package has been physically dropped off at the specified location.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setShowPickupDialog(false)}
            disabled={isUpdating}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={markAsReadyForPickup}
            disabled={isUpdating}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
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
    </>
  );
}
