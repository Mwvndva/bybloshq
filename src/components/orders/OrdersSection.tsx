import { useEffect, useState, useCallback } from 'react';
import { useBuyerAuth } from '@/contexts/GlobalAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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

import { Search, ArrowRight, Clock, CheckCircle, XCircle, Truck, Package, RefreshCw, Handshake, FileText, Users, UserCheck } from 'lucide-react';
import { Order, OrderStatus, PaymentStatus } from '@/types/order';
import buyerApi from '@/api/buyerApi';
import { publicApiService } from '@/api/publicApi';
import { toast } from 'sonner';
import DirectBybxViewer from '@/components/DirectBybxViewer';
import { getImageUrl, cn } from '@/lib/utils';

const glassCardStyle: React.CSSProperties = {
  background: 'rgba(20, 20, 20, 0.7)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.6)'
};

const badgeGlow = 'shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_10px_20px_rgba(0,0,0,0.35)]';

const getStatusBadge = (status: string) => {
  // Convert to uppercase for comparison, default to 'PENDING' if status is falsy
  const statusValue = status?.toUpperCase() || 'PENDING';
  switch (statusValue) {
    case 'PENDING':
      return (
        <Badge className={`bg-gradient-to-r from-yellow-500/90 to-yellow-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'DELIVERY_PENDING':
      return (
        <Badge className={`bg-gradient-to-r from-blue-500/90 to-blue-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <Truck className="h-3 w-3 mr-1" />
          Delivery Pending
        </Badge>
      );
    case 'DELIVERY_COMPLETE':
      return (
        <Badge className={`bg-gradient-to-r from-purple-500/90 to-purple-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <Package className="h-3 w-3 mr-1" />
          Delivery Complete
        </Badge>
      );
    case 'COMPLETED':
      return (
        <Badge className={`bg-gradient-to-r from-green-500/90 to-emerald-500/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case 'CANCELLED':
      return (
        <Badge className={`bg-gradient-to-r from-red-500/90 to-red-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <XCircle className="h-3 w-3 mr-1" />
          Cancelled
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge className={`bg-gradient-to-r from-red-500/90 to-red-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case 'SERVICE_PENDING':
      return (
        <Badge className={`bg-gradient-to-r from-purple-500/90 to-purple-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <CheckCircle className="h-3 w-3 mr-1" />
          Service Pending
        </Badge>
      );
    case 'COLLECTION_PENDING':
      return (
        <Badge className={`bg-gradient-to-r from-indigo-500/90 to-blue-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <Package className="h-3 w-3 mr-1" />
          Ready for Collection
        </Badge>
      );
    case 'CONFIRMED':
      return (
        <Badge className={`bg-gradient-to-r from-blue-500/90 to-blue-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <CheckCircle className="h-3 w-3 mr-1" />
          Confirmed
        </Badge>
      );
    default:
      return (
        <Badge className={`bg-gradient-to-r from-gray-500/90 to-gray-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
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
        <Badge className={`bg-gradient-to-r from-amber-500/90 to-amber-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'success':
    case 'completed':
    case 'paid':
      return (
        <Badge className={`bg-gradient-to-r from-green-500/90 to-emerald-500/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <CheckCircle className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    case 'failed':
      return (
        <Badge className={`bg-gradient-to-r from-red-500/90 to-red-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case 'reversed':
      return (
        <Badge className={`bg-gradient-to-r from-gray-500/90 to-gray-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <XCircle className="h-3 w-3 mr-1" />
          Reversed
        </Badge>
      );
    default:
      return (
        <Badge className={`bg-gradient-to-r from-gray-500/90 to-gray-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          {status}
        </Badge>
      );
  }
};

export default function OrdersSection() {
  const { user } = useBuyerAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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

      // Initialize client status from orders
      const statusMap: Record<string, boolean> = {};
      orders.forEach(order => {
        if (order.seller && order.seller.id) {
          statusMap[order.seller.id] = !!order.seller.isClient;
        }
      });
      setClientStatus(statusMap);

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
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null);

  // Direct View State
  const [viewingFile, setViewingFile] = useState<{
    orderId: string;
    productId: string;
    fileName: string;
  } | null>(null);

  const [viewingImage, setViewingImage] = useState<string | null>(null);


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

  const handleCollectionClick = (orderId: string) => {
    setCurrentOrderId(orderId);
    setShowCollectionDialog(true);
  };

  const handleMarkAsCollected = async () => {
    if (!currentOrderId) return;

    setShowCollectionDialog(false);
    setIsConfirming(currentOrderId);
    const loadingToast = toast.loading('Marking as collected...');

    try {
      await buyerApi.markOrderAsCollected(currentOrderId);
      toast.success('Order completed! Funds released to seller.', { id: loadingToast });

      // Refresh orders
      await fetchOrders();
    } catch (error: any) {
      console.error('Error marking as collected:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to mark as collected';
      toast.error(errorMsg, { id: loadingToast });
    } finally {
      setIsConfirming(null);
    }
  };

  const [clientStatus, setClientStatus] = useState<Record<string, boolean>>({});
  const [isBecomingClient, setIsBecomingClient] = useState<Record<string, boolean>>({});

  const handleToggleClientStatus = async (sellerId: string, sellerName: string) => {
    if (!sellerId) return;

    const isClient = clientStatus[sellerId];
    setIsBecomingClient(prev => ({ ...prev, [sellerId]: true }));

    try {
      if (isClient) {
        // Leave client
        const result = await buyerApi.leaveClient(sellerId);
        if (result.success) {
          setClientStatus(prev => ({ ...prev, [sellerId]: false }));
          toast.success(`You have left ${sellerName}'s clientele`);
        } else {
          toast.error(result.message || 'Failed to leave clientele');
        }
      } else {
        // Join client
        // @ts-ignore
        const result = await publicApiService.becomeClient(sellerId);
        setClientStatus(prev => ({ ...prev, [sellerId]: true }));

        if (result.data?.alreadyClient) {
          toast.info(`You are already a client of ${sellerName}`);
        } else {
          toast.success(`You have successfully joined ${sellerName}'s clientele!`);
        }
      }
    } catch (error: any) {
      console.error('Error toggling client status:', error);
      toast.error(error.message || 'Failed to update client status');
    } finally {
      setIsBecomingClient(prev => ({ ...prev, [sellerId]: false }));
    }
  };



  // Always use real data from the API
  // Filter orders based on search query
  const filteredOrders = orders.filter(order => {
    const query = searchQuery.toLowerCase();
    const orderNum = (order.orderNumber || order.id || '').toLowerCase();
    const shopName = (order.seller?.shopName || order.seller?.name || '').toLowerCase();
    const itemMatch = order.items.some(item => item.name.toLowerCase().includes(query));

    return orderNum.includes(query) || shopName.includes(query) || itemMatch;
  });

  const displayOrders = filteredOrders;

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-0" style={glassCardStyle}>
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
        <p className="text-red-200 mb-4">{error}</p>
        <Button onClick={fetchOrders} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative w-full max-w-md mx-auto mb-6">
        <Input
          type="text"
          placeholder="Search orders, shops, or products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-white/5 border-white/10 text-white placeholder-gray-500 rounded-xl pl-10 h-10"
        />
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-500" />
      </div>

      {displayOrders.length === 0 && searchQuery ? (
        <div className="text-center py-12 px-4 bg-white/5 rounded-2xl border border-white/10">
          <p className="text-gray-400">No orders found matching "{searchQuery}"</p>
          <Button
            variant="link"
            onClick={() => setSearchQuery('')}
            className="text-yellow-500 mt-2"
          >
            Clear search
          </Button>
        </div>
      ) : displayOrders.length === 0 ? (
        <div className="text-center py-12 px-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-yellow-400/20 to-yellow-500/20 rounded-full flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-yellow-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No orders yet</h3>
          <p className="text-gray-300 max-w-md mx-auto mb-6">Your orders will appear here once you make a purchase.</p>
          <Button
            onClick={() => (window.location.href = '/shop')}
            className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200"
          >
            Start Shopping
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      ) : (
        displayOrders.map((order) => {
          const mainItem = order.items.find(item => item.imageUrl) || order.items[0];
          const mainImage = mainItem?.imageUrl ? getImageUrl(mainItem.imageUrl) : null;

          return (
            <Card key={order.id} className="border-0 overflow-hidden" style={glassCardStyle}>
              <CardContent className="p-0">
                {/* Header Section */}
                <div className="p-4 sm:p-6 border-b border-white/5">
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
                      <p className="text-xs sm:text-sm text-gray-400">{formatDate(order)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total</p>
                      <p className="text-xl sm:text-2xl font-bold text-white">
                        {formatCurrency((order as any).total_amount || order.totalAmount, order.currency)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Items Section */}
                <div className="p-4 sm:p-6 space-y-2 sm:space-y-3">
                  {order.items.slice(0, 2).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 sm:gap-4 p-2 sm:p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                      {/* Image removed as per request */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-semibold text-white truncate">{item.name}</p>
                      </div>
                    </div>
                  ))}
                  {order.items.length > 2 && (
                    <p className="text-xs sm:text-sm text-center text-gray-400 py-1 sm:py-2">
                      + {order.items.length - 2} more item{order.items.length - 2 > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Footer Section */}
                <div className="p-4 sm:p-6 pt-0 flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
                  {/* Seller Info */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    {mainImage && (
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full overflow-hidden border-2 border-white/10">
                        <img src={mainImage} alt="Seller" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-400">Seller</p>
                      <p className="text-sm sm:text-base font-semibold text-white">
                        {order.seller?.shopName || order.seller?.name || "Store"}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 sm:gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none border-white/20 hover:bg-white/10 text-white text-xs sm:text-sm"
                      onClick={() => setSelectedOrderForDetails(order)}
                    >
                      View Details
                    </Button>

                    {order.status === 'DELIVERY_COMPLETE' && (
                      <Button
                        size="sm"
                        className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs sm:text-sm"
                        onClick={() => handleConfirmReceiptClick(order.id)}
                      >
                        Confirm Receipt
                      </Button>
                    )}

                    {order.seller && (
                      <Button
                        size="sm"
                        className={`font-semibold text-xs sm:text-sm ${clientStatus[order.seller.id]
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50'
                          : 'bg-yellow-500 hover:bg-yellow-600 text-black'
                          }`}
                        onClick={() => handleToggleClientStatus(order.seller.id, order.seller.name || '')}
                        disabled={isBecomingClient[order.seller.id]}
                      >
                        {isBecomingClient[order.seller.id] ? (
                          <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                        ) : clientStatus[order.seller.id] ? (
                          <>
                            <Users className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            Leave
                          </>
                        ) : (
                          <>
                            <Users className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            Join
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Direct Viewer */}
      {viewingFile && (
        <DirectBybxViewer
          orderId={viewingFile.orderId}
          productId={viewingFile.productId}
          fileName={viewingFile.fileName}
          isOpen={true}
          onClose={() => setViewingFile(null)}
        />
      )}

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

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrderForDetails} onOpenChange={(open) => !open && setSelectedOrderForDetails(null)}>
        <DialogContent className="sm:max-w-2xl bg-black/95 border border-white/10 text-white">
          {selectedOrderForDetails && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">
                  Order Details
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  {formatDate(selectedOrderForDetails)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                {/* Items */}
                {selectedOrderForDetails.items.map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-start">
                    {/* Product Image */}
                    <div className="h-20 w-20 rounded-lg bg-black/40 overflow-hidden border border-white/10 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => item.imageUrl && setViewingImage(getImageUrl(item.imageUrl))}>
                      {item.imageUrl ? (
                        <img
                          src={getImageUrl(item.imageUrl)}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-gray-600" />
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-bold text-white leading-tight mb-1">{item.name}</h4>
                      <div className="flex items-center text-sm text-gray-400 gap-3">
                        <span>Qty: {item.quantity}</span>
                        <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                        <span className="text-white font-medium">{formatCurrency(item.price * item.quantity, selectedOrderForDetails.currency)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="border-t border-white/10 my-4" />

                {/* Shop Information */}
                <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400" />
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Shop Details</p>
                  </div>

                  <div className="space-y-1">
                    {selectedOrderForDetails.seller?.shopName && (
                      <p className="font-bold text-white text-lg">
                        {selectedOrderForDetails.seller.shopName}
                      </p>
                    )}

                    {/* Shop Address / Location - NEW */}
                    {selectedOrderForDetails.seller?.location && (
                      <a
                        href={selectedOrderForDetails.seller.location.startsWith('http') ? selectedOrderForDetails.seller.location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedOrderForDetails.seller.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 text-sm text-gray-300 hover:text-emerald-400 transition-colors group"
                      >
                        <div className="mt-0.5"><i className="fas fa-map-marker-alt" /></div>
                        <span>
                          {selectedOrderForDetails.seller.city ? `${selectedOrderForDetails.seller.city} - ` : ''}
                          {selectedOrderForDetails.seller.location}
                        </span>
                      </a>
                    )}
                  </div>

                  {selectedOrderForDetails.shippingAddress && (
                    <div className="pt-2 border-t border-white/5 mt-2">
                      <p className="text-xs text-gray-500 mb-1">Shipping To:</p>
                      <p className="text-sm text-gray-300">
                        {selectedOrderForDetails.shippingAddress.address}
                        {selectedOrderForDetails.shippingAddress.city && `, ${selectedOrderForDetails.shippingAddress.city}`}
                      </p>
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-lg font-semibold text-white">Total</span>
                  <span className="text-2xl font-bold text-emerald-400">
                    {formatCurrency((selectedOrderForDetails as any).total_amount || selectedOrderForDetails.totalAmount, selectedOrderForDetails.currency)}
                  </span>
                </div>

                {/* Status Badges */}
                <div className="flex gap-2">
                  {getStatusBadge(selectedOrderForDetails.status)}
                  {getPaymentStatusBadge(selectedOrderForDetails.paymentStatus)}
                </div>
              </div>

              <DialogFooter className="gap-2">
                {selectedOrderForDetails.status === 'DELIVERY_COMPLETE' && (
                  <Button
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                    onClick={() => {
                      handleConfirmReceiptClick(selectedOrderForDetails.id);
                      setSelectedOrderForDetails(null);
                    }}
                  >
                    Confirm Receipt
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="border-white/20 hover:bg-white/10 text-white"
                  onClick={() => setSelectedOrderForDetails(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
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

      {/* Collection Confirmation Dialog */}
      <Dialog open={showCollectionDialog} onOpenChange={setShowCollectionDialog}>
        <DialogContent className="sm:max-w-[425px] bg-gradient-to-br from-white to-gray-50 border-0 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                <Package className="h-4 w-4 text-white" />
              </div>
              Confirm Collection
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              Please confirm that you have physically collected this item from the seller's shop.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 my-4">
            <p className="text-sm text-blue-900 font-semibold mb-2">
              📍 Collection Location
            </p>
            <p className="text-sm text-blue-800">
              Please verify you picked up from the seller's shop as indicated in your order details.
            </p>
          </div>

          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-3 mb-4">
            <p className="text-sm text-yellow-800 font-semibold">
              ⚠️ Funds will be immediately released to the seller once you confirm collection.
            </p>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCollectionDialog(false)}
              disabled={isConfirming === currentOrderId}
              className="border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkAsCollected}
              disabled={isConfirming === currentOrderId}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200"
            >
              {isConfirming === currentOrderId ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Yes, I Collected It
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Image Viewer Dialog */}
      <Dialog open={!!viewingImage} onOpenChange={(open) => !open && setViewingImage(null)}>
        <DialogContent className="sm:max-w-3xl bg-transparent border-0 shadow-none p-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-full h-full flex items-center justify-center pointer-events-auto">
            <button
              onClick={() => setViewingImage(null)}
              className="absolute -top-10 right-0 sm:-right-10 z-50 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors border border-white/20"
            >
              <XCircle className="h-6 w-6" />
            </button>
            {viewingImage && (
              <img
                src={viewingImage}
                alt="Full View"
                className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
