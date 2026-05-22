import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Package, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useBuyerAuth } from '@/contexts/GlobalAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import buyerApi from '@/api/buyerApi';
import { publicApiService } from '@/api/publicApi';
import { useAsyncLock } from '@/hooks/useAsyncLock';
import type { Order } from '@/types/order';
import { BuyerOrderCard } from './BuyerOrderCard';
import { BuyerOrderDialogs } from './BuyerOrderDialogs';
import { OrdersLoadingState } from './OrdersLoadingState';
import { isDigitalOrder, isDigitalOrderItem } from './ordersSectionUtils';

const updateSellerClientCountInCache = (queryClient: ReturnType<typeof useQueryClient>, sellerId: string, clientCount: number) => {
  queryClient.setQueriesData({ queryKey: ['public-sellers'] }, (current: any) => {
    if (!current?.sellers) return current;
    return {
      ...current,
      sellers: current.sellers.map((seller: any) => (
        String(seller.id || seller.sellerId || seller.seller_id || '') === String(sellerId)
          ? { ...seller, clientCount, client_count: clientCount }
          : seller
      ))
    };
  });
};

export default function OrdersSection() {
  const { user } = useBuyerAuth();
  const queryClient = useQueryClient();
  const { runWithLock } = useAsyncLock();

  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState<string | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [clientStatus, setClientStatus] = useState<Record<string, boolean>>({});
  const [isBecomingClient, setIsBecomingClient] = useState<Record<string, boolean>>({});

  const fetchOrders = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const buyerOrders = await buyerApi.getOrders();
      setOrders(buyerOrders);

      const statusMap: Record<string, boolean> = {};
      buyerOrders.forEach(order => {
        if (order.seller?.id) {
          statusMap[order.seller.id] = !!order.seller.isClient;
        }
      });
      setClientStatus(statusMap);
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load orders. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleDownload = async (order: Order) => {
    const digitalItem = order.items?.find(isDigitalOrderItem);
    if (!digitalItem?.productId) {
      toast.error('Could not find digital product to download.');
      return;
    }

    try {
      setDownloadingOrderId(order.id);
      setDownloadProgress(prev => ({ ...prev, [order.id]: 0 }));

      await buyerApi.downloadDigitalProduct(
        String(order.id),
        String(digitalItem.productId),
        (percent) => setDownloadProgress(prev => ({ ...prev, [order.id]: percent }))
      );

      toast.success('Download Complete!');
    } catch (err: any) {
      toast.error(err.message || 'Could not download the file. Please try again.');
    } finally {
      setDownloadingOrderId(null);
      setDownloadProgress(prev => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
    }
  };

  const handleConfirmReceiptClick = (orderId: string) => {
    setCurrentOrderId(orderId);
    setShowReceiptDialog(true);
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
    } catch (err) {
      console.error('Error cancelling order:', err);
      toast.error('An error occurred while cancelling the order');
    }
  };

  const handleConfirmReceipt = async () => {
    if (!currentOrderId) return;
    setShowReceiptDialog(false);

    await runWithLock(async () => {
      setIsConfirming(currentOrderId);
      const loadingToast = toast.loading('Confirming order receipt...');

      try {
        const result = await buyerApi.confirmOrderReceipt(currentOrderId);
        if (result.success) {
          toast.success('Order marked as received. Thank you for your purchase!', { id: loadingToast });
          await fetchOrders();
        } else {
          toast.error(result.message || 'Failed to confirm order receipt', { id: loadingToast });
        }
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || err.message || 'An error occurred while confirming order receipt';
        toast.error(err.code === 'ECONNABORTED'
          ? 'Request timed out. Please check your internet connection and try again.'
          : `Error: ${errorMessage}`, { id: loadingToast });
      } finally {
        setIsConfirming(null);
      }
    });
  };

  const handleToggleClientStatus = async (sellerId: string, sellerName: string) => {
    if (!sellerId) return;

    const isClient = clientStatus[sellerId];
    setIsBecomingClient(prev => ({ ...prev, [sellerId]: true }));

    try {
      if (isClient) {
        const result = await buyerApi.leaveClient(sellerId);
        if (result.success) {
          setClientStatus(prev => ({ ...prev, [sellerId]: false }));
          if (typeof result.clientCount === 'number') {
            updateSellerClientCountInCache(queryClient, sellerId, result.clientCount);
          }
          queryClient.invalidateQueries({ queryKey: ['buyer-followed-shops'] });
          queryClient.invalidateQueries({ queryKey: ['public-sellers'] });
          toast.success(`You have unfollowed ${sellerName}`);
        } else {
          toast.error(result.message || 'Failed to unfollow');
        }
      } else {
        const result = await publicApiService.becomeClient(sellerId);
        setClientStatus(prev => ({ ...prev, [sellerId]: true }));
        if (typeof result.data?.clientCount === 'number') {
          updateSellerClientCountInCache(queryClient, sellerId, result.data.clientCount);
        }
        queryClient.invalidateQueries({ queryKey: ['buyer-followed-shops'] });
        queryClient.invalidateQueries({ queryKey: ['public-sellers'] });

        if (result.data?.alreadyClient) {
          toast.info(`You are already following ${sellerName}`);
        } else {
          toast.success(`You are now following ${sellerName}!`);
        }
      }
    } catch (err: any) {
      console.error('Error toggling client status:', err);
      toast.error(err.message || 'Failed to update client status');
    } finally {
      setIsBecomingClient(prev => ({ ...prev, [sellerId]: false }));
    }
  };

  const filteredOrders = orders.filter(order => {
    const query = searchQuery.toLowerCase();
    const orderNum = (order.orderNumber || order.id || '').toLowerCase();
    const shopName = (order.seller?.shopName || order.seller?.name || '').toLowerCase();
    const itemMatch = order.items.some(item => item.name.toLowerCase().includes(query));

    return orderNum.includes(query) || shopName.includes(query) || itemMatch;
  });

  if (isLoading) {
    return <OrdersLoadingState />;
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70 pointer-events-none z-10" />
        <Input
          type="text"
          placeholder="Search orders, shops, or products..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="bg-white/5 border-white/15 text-white placeholder:text-white/60 rounded-xl pl-10 h-10"
        />
      </div>

      {filteredOrders.length === 0 && searchQuery ? (
        <div className="text-center py-12 px-4 bg-white/5 rounded-2xl border border-white/15">
          <p className="text-white">No orders found matching "{searchQuery}"</p>
          <Button
            variant="link"
            onClick={() => setSearchQuery('')}
            className="text-yellow-500 mt-2"
          >
            Clear search
          </Button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 px-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-yellow-400/20 to-yellow-500/20 rounded-full flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-yellow-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No orders yet</h3>
          <p className="text-white/75 max-w-md mx-auto mb-6">Your orders will appear here once you make a purchase.</p>
          <Button
            onClick={() => (window.location.href = '/shop')}
            className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200"
          >
            Start Shopping
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      ) : (
        filteredOrders.map((order) => (
          <BuyerOrderCard
            key={order.id}
            order={order}
            clientStatus={clientStatus}
            isBecomingClient={isBecomingClient}
            downloadingOrderId={downloadingOrderId}
            downloadProgress={downloadProgress}
            onViewDetails={setSelectedOrderForDetails}
            onConfirmReceipt={handleConfirmReceiptClick}
            onDownload={(orderToDownload) => {
              if (isDigitalOrder(orderToDownload)) handleDownload(orderToDownload);
            }}
            onToggleClientStatus={handleToggleClientStatus}
          />
        ))
      )}

      <BuyerOrderDialogs
        orders={orders}
        currentOrderId={currentOrderId}
        isConfirming={isConfirming}
        showCancelDialog={showCancelDialog}
        showReceiptDialog={showReceiptDialog}
        selectedOrderForDetails={selectedOrderForDetails}
        viewingImage={viewingImage}
        onCancelDialogChange={setShowCancelDialog}
        onReceiptDialogChange={setShowReceiptDialog}
        onSelectedOrderChange={setSelectedOrderForDetails}
        onViewingImageChange={setViewingImage}
        onCancelOrder={handleCancelOrder}
        onConfirmReceipt={handleConfirmReceipt}
        onConfirmReceiptClick={handleConfirmReceiptClick}
      />
    </div>
  );
}
