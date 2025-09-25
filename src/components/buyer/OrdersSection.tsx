import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchBuyerOrders, Order, confirmOrder, OrderStatus } from '@/api/orderApi';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';

interface OrderWithConfirmation extends Order {
  shouldAutoConfirm?: boolean;
  _isConfirming?: boolean;
}

const useOrderConfirmation = (order: OrderWithConfirmation, onConfirm: (orderId: number) => void) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (order.status === 'delivered' && !order.metadata?.autoConfirmSet) {
      const orderTime = new Date(order.updated_at).getTime();
      const currentTime = new Date().getTime();
      const hoursSinceDelivery = (currentTime - orderTime) / (1000 * 60 * 60);
      
      if (hoursSinceDelivery >= 24) {
        // Auto-confirm if 24 hours have passed
        onConfirm(order.id);
      } else {
        // Set timeout for auto-confirmation
        const timeRemaining = (24 * 60 * 60 * 1000) - (currentTime - orderTime);
        timerRef.current = setTimeout(() => {
          if (isMounted.current) {
            onConfirm(order.id);
          }
        }, timeRemaining);
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [order, onConfirm]);

  return { isConfirming, setIsConfirming };
};

const OrderRow = ({ order, onConfirm }: { order: OrderWithConfirmation, onConfirm: (orderId: number) => void }) => {
  const { isConfirming, setIsConfirming } = useOrderConfirmation(order, onConfirm);

  // Ensure total_amount is a number before calling toFixed
  const totalAmount = typeof order.total_amount === 'number' 
    ? order.total_amount 
    : parseFloat(order.total_amount) || 0;

  return (
    <TableRow key={order.id}>
      <TableCell>{order.order_number}</TableCell>
      <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
      <TableCell>{order.items.length} items</TableCell>
      <TableCell>${totalAmount.toFixed(2)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={order.status === 'confirmed' ? 'default' : 'outline'}>
            {order.status}
          </Badge>
          {order.status === 'confirmed' ? (
            <div className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-green-100 text-green-800 ml-2">
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Confirmed
            </div>
          ) : order.status === 'delivered' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsConfirming(true);
                onConfirm(order.id);
              }}
              disabled={isConfirming}
              className="ml-2"
            >
              {order._isConfirming || isConfirming ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirm Order
                </>
              )}
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
};

const OrdersSection = () => {
  console.log('OrdersSection component rendered');
  const { user } = useBuyerAuth();
  console.log('Current user:', user);
  const [orders, setOrders] = useState<OrderWithConfirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const handleConfirmOrder = useCallback(async (orderId: number) => {
    if (!user) return;
    
    try {
      // Set the specific order to loading state
      setOrders(prev => 
        prev.map(order => 
          order.id === orderId 
            ? { ...order, _isConfirming: true }
            : order
        )
      );
      
      const response = await confirmOrder(orderId, user.id);
      
      if (response.data) {
        // First update with the confirmed status
        setOrders(prev => 
          prev.map(order => 
            order.id === orderId 
              ? { 
                  ...order, 
                  status: 'confirmed' as OrderStatus,
                  shouldAutoConfirm: false,
                  _isConfirming: false
                }
              : order
          )
        );
        
        // Then refresh the orders list to ensure we have the latest data
        try {
          const updatedOrders = await fetchBuyerOrders({
            page: 1,
            limit: 10,
            sortBy: 'created_at',
            sortOrder: 'desc'
          });
          
          if (updatedOrders.data) {
            setOrders(updatedOrders.data);
          }
        } catch (refreshError) {
          console.error('Error refreshing orders:', refreshError);
          // Even if refresh fails, the local state is already updated
        }
        
        toast({
          title: 'Order Confirmed',
          description: 'Your order has been confirmed successfully.',
        });
      }
    } catch (err) {
      console.error('Error confirming order:', err);
      
      // Reset the loading state on error
      setOrders(prev => 
        prev.map(order => 
          order.id === orderId 
            ? { ...order, _isConfirming: false }
            : order
        )
      );
      
      toast({
        title: 'Error',
        description: 'Failed to confirm order. Please try again.',
        variant: 'destructive',
      });
    }
  }, [user]);

  // Fetch orders when user changes
  useEffect(() => {
    isMounted.current = true;
    
    const fetchOrders = async () => {
      if (!user) {
        console.log('No user found - cannot fetch orders');
        return;
      }
      
      console.log('Starting to fetch orders for user:', user.id);
      setLoading(true);
      setError(null);
      
      try {
        console.log('Calling fetchBuyerOrders()...');
        const response = await fetchBuyerOrders({
          page: 1,
          limit: 10,
          sortBy: 'created_at',
          sortOrder: 'desc'
        });
        
        if (!isMounted.current) return;
        
        console.log('fetchBuyerOrders response:', response);
        
        if (!response) {
          throw new Error('No response from server');
        }
        
        if (response.success === false) {
          throw new Error(response.message || 'Failed to fetch orders');
        }
        
        const ordersData = Array.isArray(response) ? response : (response.data || []);
        console.log(`Received ${ordersData.length} orders`);
        
        if (ordersData.length === 0) {
          console.log('No orders found for the current user');
          setOrders([]);
        } else {
          // Mark orders for auto-confirmation if needed
          const processedOrders = ordersData.map(order => ({
            ...order,
            shouldAutoConfirm: order.status === 'delivered' && !order.metadata?.autoConfirmSet
          }));
          
          console.log('Setting orders:', processedOrders);
          setOrders(processedOrders);
        }
      } catch (err) {
        if (!isMounted.current) return;
        
        const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
        console.error('Error in fetchOrders:', {
          error: errorMessage,
          status: err.response?.status,
          data: err.response?.data
        });
        setError(`Failed to load orders: ${errorMessage}`);
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    // Add a small debounce to prevent rapid successive calls
    const timer = setTimeout(fetchOrders, 100);
    
    // Cleanup function
    return () => {
      isMounted.current = false;
      clearTimeout(timer);
    };
  }, [user?.id]);

  // Show loading state
  if (loading) {
    return <div className="p-4">Loading orders...</div>;
  }
  
  // Show error state
  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }





  return (
    <Card>
      <CardHeader>
        <CardTitle>My Orders</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p>You have no orders yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <OrderRow 
                  key={order.id} 
                  order={order} 
                  onConfirm={handleConfirmOrder} 
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default OrdersSection;
