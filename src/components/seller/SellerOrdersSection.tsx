import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

  const markAsReadyForPickup = async (orderId: string) => {
    const confirmationMessage = 'Have you dropped off the package at "Dynamic Mall, along Tomboya Street - shop number SL 32"?\n\nPlease confirm only after the package has been dropped off at the specified location.';
    
    if (!window.confirm(confirmationMessage)) {
      return; // User cancelled the action
    }
    
    try {
      setIsUpdating(true);
      
      // Use uppercase 'READY_FOR_PICKUP' to match database enum
      const updatedOrder = await sellerApi.updateOrderStatus(orderId, 'READY_FOR_PICKUP' as any);
      
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? { 
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
    try {
      setIsUpdating(true);
      const updatedOrder = await sellerApi.updateOrderStatus(orderId, 'CANCELLED' as OrderStatus);
      
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? { 
            ...updatedOrder,
            status: 'CANCELLED' as const,
            paymentStatus: 'cancelled' as const
          } : order
        )
      );
      
      toast({
        title: 'Order Cancelled',
        description: 'The order has been cancelled.',
      });
    } catch (err) {
      console.error('Failed to cancel order:', err);
      toast({
        title: 'Error',
        description: 'Failed to cancel order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-9 w-28" />
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No orders yet</h3>
        <p className="text-gray-500">Your orders will appear here when customers purchase your products.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Card key={order.id} className="p-4">
          <div className="flex justify-between items-start">
            <div className="space-y-3">
              <div>
                <h3 className="font-medium">Order #{order.orderNumber}</h3>
                <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-900">Products:</h4>
                <ul className="mt-1 space-y-1">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item) => (
                      <li key={item.id} className="text-sm text-gray-700">
                        {item.name} × {item.quantity}
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-gray-500">No items in this order</li>
                  )}
                </ul>
              </div>
              
              <div className="mt-2">
                {order.status === 'COMPLETED' ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" /> Completed
                  </Badge>
                ) : order.status === 'READY_FOR_PICKUP' ? (
                  <Badge className="bg-blue-100 text-blue-800">
                    <Truck className="h-3 w-3 mr-1" /> Ready for Pickup
                  </Badge>
                ) : order.status === 'FAILED' ? (
                  <Badge className="bg-red-100 text-red-800">
                    <XCircle className="h-3 w-3 mr-1" /> Failed
                  </Badge>
                ) : order.status === 'CANCELLED' ? (
                  <Badge className="bg-red-100 text-red-800">
                    <XCircle className="h-3 w-3 mr-1" /> Cancelled
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-800">
                    <Clock className="h-3 w-3 mr-1" /> Pending
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end space-y-2 min-w-[180px] pl-4">
              <p className="font-medium text-lg">
                {formatCurrency(order.totalAmount, order.currency)}
              </p>
              
              {order.status === 'PENDING' && (
                <div className="w-full space-y-2 mt-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="w-full justify-start bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                    onClick={() => markAsReadyForPickup(order.id)}
                    disabled={isUpdating}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Mark as Ready for Pickup
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="w-full justify-start text-red-600 hover:bg-red-50 border-red-200"
                    onClick={() => cancelOrder(order.id)}
                    disabled={isUpdating}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Cancel Order
                  </Button>
                </div>
              )}
              {order.status === 'READY_FOR_PICKUP' && 
               (order.paymentStatus?.toLowerCase() === 'completed') && (
                <div className="w-full space-y-2 mt-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="w-full justify-start bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                    onClick={() => markAsDelivered(order.id)}
                    disabled={isUpdating}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Delivered
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="w-full justify-start text-red-600 hover:bg-red-50 border-red-200"
                    onClick={() => cancelOrder(order.id)}
                    disabled={isUpdating}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Cancel Order
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
