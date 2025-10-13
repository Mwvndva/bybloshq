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

import { ArrowRight, Clock, CheckCircle, XCircle, Truck, Package, RefreshCw } from 'lucide-react';
import { Order, OrderStatus, PaymentStatus } from '@/types/order';
import buyerApi from '@/api/buyerApi';
import { toast } from 'sonner';

const getStatusBadge = (status: string) => {
  // Convert to uppercase for comparison, default to 'PENDING' if status is falsy
  const statusValue = status?.toUpperCase() || 'PENDING';
  switch (statusValue) {
    case 'PENDING':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'READY_FOR_PICKUP':
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          <Truck className="h-3 w-3 mr-1" />
          Ready for Pickup
        </Badge>
      );
    case 'COMPLETED':
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case 'CANCELLED':
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          <XCircle className="h-3 w-3 mr-1" />
          Cancelled
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
          <Package className="h-3 w-3 mr-1" />
          {status}
        </Badge>
      );
  }
};

const getPaymentStatusBadge = (status?: string) => {
  // Convert to lowercase for comparison, default to 'pending' if status is falsy
  const statusValue = status?.toLowerCase() || 'pending';
  switch (statusValue) {
    case 'pending':
      return (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'paid':
      return (
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-800">
          <XCircle className="h-3 w-3 mr-1" />
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
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
      console.log('No user found, skipping orders fetch');
      return;
    }
    
    console.log('Fetching orders for user:', user.id);
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Calling buyerApi.getOrders()');
      const orders = await buyerApi.getOrders();
      console.log('Received orders:', orders);
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

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) {
      return;
    }

    try {
      const result = await buyerApi.cancelOrder(orderId);
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

  const [isConfirming, setIsConfirming] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  const confirmationMessage = (
    <div className="space-y-4">
      <p>Have you picked up and inspected your package from <strong>"Dynamic Mall, along Tomboya Street - shop number SL 32"</strong>?</p>
      <p className="text-sm text-muted-foreground">
        Please only confirm after you have physically received and inspected your package. 
        This will release the payment to the seller after deducting our 9% service fee.
      </p>
    </div>
  );

  const handleConfirmReceiptClick = (orderId: string) => {
    setCurrentOrderId(orderId);
    setShowConfirmDialog(true);
  };

  const handleConfirmReceipt = async () => {
    if (!currentOrderId) return;
    
    console.log('=== START handleConfirmReceipt ===');
    console.log('Order ID:', currentOrderId);
    
    setShowConfirmDialog(false);

    setIsConfirming(currentOrderId);
    const loadingToast = toast.loading('Confirming order receipt...');
    
    try {
      console.log('Calling buyerApi.confirmOrderReceipt...');
      const result = await buyerApi.confirmOrderReceipt(currentOrderId);
      console.log('buyerApi.confirmOrderReceipt result:', result);
      
      if (result.success) {
        toast.success('Order marked as received. Thank you for your purchase!', { id: loadingToast });
        
        // Optimistically update the UI
        setOrders(prevOrders => {
          console.log('Previous orders state:', prevOrders);
          const updatedOrders = prevOrders.map(order => {
            if (order.id === currentOrderId) {
              console.log('Updating order in state:', currentOrderId);
              // Create a new order object with the updated properties
              const updatedOrder: Order = {
                id: order.id,
                orderNumber: order.orderNumber,
                status: 'COMPLETED',
                totalAmount: order.totalAmount,
                currency: order.currency,
                createdAt: order.createdAt,
                updatedAt: new Date().toISOString(),
                paymentStatus: 'completed',
                items: [...order.items],
                customer: { ...order.customer },
                seller: { ...order.seller },
                shippingAddress: order.shippingAddress ? { ...order.shippingAddress } : undefined
              };
              return updatedOrder;
            }
            return order;
          });
          console.log('Updated orders state:', updatedOrders);
          return updatedOrders;
        });
        
        // Fetch fresh data from the server to ensure consistency
        console.log('Fetching fresh data from server...');
        try {
          await fetchOrders();
          console.log('Successfully refreshed orders from server');
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
      console.log('=== END handleConfirmReceipt ===');
    }
  };

  // Always use real data from the API
  const displayOrders = orders;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
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
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No orders yet</h3>
        <p className="text-gray-500 mb-6">Your orders will appear here once you make a purchase.</p>
        <Button onClick={() => (window.location.href = '/shop')}>
          Start Shopping
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {displayOrders.map((order) => (
        <Card key={order.id} className="p-4">
          <div className="flex justify-between items-start">
            <div className="space-y-3">
              <div>
                <h3 className="font-medium">Order #{order.id}</h3>
                <p className="text-sm text-gray-500">{formatDate(order)}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-900">Products:</h4>
                <ul className="mt-1 space-y-1">
                  {order.items.map((item) => (
                    <li key={item.id} className="text-sm text-gray-700">
                      {item.name} × {item.quantity}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="flex items-center space-x-2">
                {getStatusBadge(order.status)}
                {getPaymentStatusBadge(order.paymentStatus)}
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-lg font-semibold">
                {formatCurrency(
                  // Handle both snake_case and camelCase
                  (order as any).total_amount !== undefined 
                    ? (order as any).total_amount 
                    : order.totalAmount,
                  order.currency || 'KSH'
                )}
              </p>
              
              <div className="mt-3 space-y-2">
                {(order.status === 'PENDING' || order.status === 'READY_FOR_PICKUP') && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => handleCancelOrder(order.id)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Order
                  </Button>
                )}
                {order.status === 'READY_FOR_PICKUP' && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => handleConfirmReceiptClick(order.id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Receipt
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
      
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Package Receipt</DialogTitle>
            <DialogDescription>
              {confirmationMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
              disabled={isConfirming === currentOrderId}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmReceipt}
              disabled={isConfirming === currentOrderId}
              className="bg-green-600 hover:bg-green-700"
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