import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Package, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useBuyerAuth } from '@/features/auth/contexts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAsyncLock } from '@/hooks/useAsyncLock';
import type { ApiOrder } from '@/types/api/order';
import { BuyerOrderCard } from './BuyerOrderCard';
import { BuyerOrderDialogs } from './BuyerOrderDialogs';
import { OrdersLoadingState } from './OrdersLoadingState';
import { isDigitalOrderItem } from './ordersSectionUtils';
import { useBuyerOrdersQuery } from '@/hooks/buyer/queries/useBuyerOrdersQuery';
import { useCancelOrderMutation } from '@/hooks/buyer/mutations/useCancelOrderMutation';
import { useConfirmOrderReceiptMutation } from '@/hooks/buyer/mutations/useConfirmOrderReceiptMutation';
import { useDownloadProductMutation } from '@/hooks/buyer/mutations/useDownloadProductMutation';
import { useLeaveClientMutation } from '@/hooks/buyer/mutations/useLeaveClientMutation';
import { useBecomeClientMutation } from '@/hooks/buyer/mutations/useBecomeClientMutation';
import { buyerQueryKeys, commonQueryKeys } from '@/api/queryKeys';

interface ApiPublicSeller {
  id?: string | number;
  sellerId?: string | number;
  seller_id?: string | number;
  clientCount?: number;
  client_count?: number;
  [key: string]: unknown;
}

const updateSellerClientCountInCache = (queryClient: ReturnType<typeof useQueryClient>, sellerId: string, clientCount: number) => {
  queryClient.setQueriesData({ queryKey: ['public-sellers'] }, (current: { sellers: ApiPublicSeller[] } | undefined) => {
      if (!current) return current;
    if (!current?.sellers) return current;
    return {
      ...current,
      sellers: current.sellers.map((seller: ApiPublicSeller) => (
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

  const [searchQuery, setSearchQuery] = useState('');
  const [isConfirming, setIsConfirming] = useState<string | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<ApiOrder | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [clientStatus, setClientStatus] = useState<Record<string, boolean>>({});
  const [isBecomingClient, setIsBecomingClient] = useState<Record<string, boolean>>({});

  // React Query: fetch orders
  const { data: orders = [], isLoading, error, refetch } = useBuyerOrdersQuery(!!user);

  // Mutations
  const cancelOrderMutation = useCancelOrderMutation();
  const confirmReceiptMutation = useConfirmOrderReceiptMutation();
  const downloadProductMutation = useDownloadProductMutation();
  const leaveClientMutation = useLeaveClientMutation();
  const becomeClientMutation = useBecomeClientMutation();

  // Sync clientStatus from orders data
  const initialClientStatus = useMemo(() => {
    const statusMap: Record<string, boolean> = {};
    orders.forEach(order => {
      if (order.seller?.id) {
        statusMap[order.seller.id] = !!order.seller.isClient;
      }
    });
    return statusMap;
  }, [orders]);

  // Merge server-provided status with optimistic updates
  const mergedClientStatus = useMemo(() => ({
    ...initialClientStatus,
    ...clientStatus,
  }), [initialClientStatus, clientStatus]);

  const handleDownload = useCallback(async (order: ApiOrder) => {
    const digitalItem = order.items?.find(isDigitalOrderItem);
    if (!digitalItem?.productId) {
      toast.error('Could not find digital product to download.');
      return;
    }

    try {
      setDownloadingOrderId(order.id);
      setDownloadProgress(prev => ({ ...prev, [order.id]: 0 }));

      await downloadProductMutation.mutateAsync({
        orderId: String(order.id),
        productId: String(digitalItem.productId),
        onProgress: (percent) => setDownloadProgress(prev => ({ ...prev, [order.id]: percent }))
      });

      toast.success('Download Complete!');
    } catch {
      // Error is handled in mutation's onError
    } finally {
      setDownloadingOrderId(null);
      setDownloadProgress(prev => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
    }
  }, [downloadProductMutation]);

  const handleConfirmReceiptClick = (orderId: string) => {
    setCurrentOrderId(orderId);
    setShowReceiptDialog(true);
  };

  const handleCancelOrder = async () => {
    if (!currentOrderId) return;
    setShowCancelDialog(false);

    try {
      await cancelOrderMutation.mutateAsync(currentOrderId);
    } catch {
      // Error is handled in mutation's onError
    }
  };

  const handleConfirmReceipt = async () => {
    if (!currentOrderId) return;
    setShowReceiptDialog(false);

    await runWithLock(async () => {
      setIsConfirming(currentOrderId);
      const loadingToast = toast.loading('Confirming order receipt...');

      try {
        await confirmReceiptMutation.mutateAsync(currentOrderId);
        toast.dismiss(loadingToast);
      } catch (err) {
        const error = err as { code?: string; message?: string; response?: { data?: { message?: string } } };
        const errorMessage = error.response?.data?.message || error.message || 'An error occurred while confirming order receipt';
        toast.error(error.code === 'ECONNABORTED'
          ? 'Request timed out. Please check your internet connection and try again.'
          : `Error: ${errorMessage}`, { id: loadingToast });
      } finally {
        setIsConfirming(null);
      }
    });
  };

  const handleToggleClientStatus = async (sellerId: string, sellerName: string) => {
    if (!sellerId) return;

    const isClient = mergedClientStatus[sellerId];
    setIsBecomingClient(prev => ({ ...prev, [sellerId]: true }));

    try {
      if (isClient) {
        const result = await leaveClientMutation.mutateAsync(sellerId);
        setClientStatus(prev => ({ ...prev, [sellerId]: false }));
        if (typeof (result as { clientCount?: number })?.clientCount === 'number') {
          updateSellerClientCountInCache(queryClient, sellerId, (result as { clientCount: number }).clientCount);
        }
        queryClient.invalidateQueries({ queryKey: buyerQueryKeys.shops() });
        toast.success(`You have unfollowed ${sellerName}`);
      } else {
        const result = await becomeClientMutation.mutateAsync(sellerId);
        setClientStatus(prev => ({ ...prev, [sellerId]: true }));
        const data = (result as { data?: { clientCount?: number; alreadyClient?: boolean } })?.data;
        if (typeof data?.clientCount === 'number') {
          updateSellerClientCountInCache(queryClient, sellerId, data.clientCount);
        }
        queryClient.invalidateQueries({ queryKey: buyerQueryKeys.shops() });

        if (data?.alreadyClient) {
          toast.info(`You are already following ${sellerName}`);
        } else {
          toast.success(`You are now following ${sellerName}!`);
        }
      }
    } catch {
      // Error is handled in mutation's onError
    } finally {
      setIsBecomingClient(prev => ({ ...prev, [sellerId]: false }));
    }
  };

  const filteredOrders = useMemo(() => orders.filter(order => {
    const query = searchQuery.toLowerCase();
    const orderNum = (order.orderNumber || order.id || '').toLowerCase();
    const shopName = (order.seller?.shopName || order.seller?.name || '').toLowerCase();
    const itemMatch = order.items.some(item => item.name.toLowerCase().includes(query));

    return orderNum.includes(query) || shopName.includes(query) || itemMatch;
  }), [orders, searchQuery]);

  if (isLoading) {
    return <OrdersLoadingState />;
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-200 mb-4">{(error as Error).message || 'Failed to load orders. Please try again later.'}</p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          type="text"
          placeholder="Search orders by item, shop, or order number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-stone-200 bg-stone-50 pl-9 focus-visible:ring-stone-400"
        />
      </div>

      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="mb-4 h-16 w-16 text-stone-300" />
          <h3 className="mb-2 text-lg font-semibold text-stone-900">No orders found</h3>
          <p className="mb-6 text-stone-500">
            {searchQuery ? 'No orders match your search. Try different keywords.' : "You haven't placed any orders yet. Start shopping!"}
          </p>
          {!searchQuery && (
            <Button
              variant="outline"
              className="border-stone-300 text-stone-600 hover:bg-stone-50"
              onClick={() => window.location.href = '/'}
            >
              Browse Products
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <BuyerOrderCard
              key={order.id}
              order={order}
              clientStatus={mergedClientStatus}
              isBecomingClient={isBecomingClient}
              downloadingOrderId={downloadingOrderId}
              downloadProgress={downloadProgress}
              onViewDetails={(o) => setSelectedOrderForDetails(o)}
              onConfirmReceipt={handleConfirmReceiptClick}
              onDownload={handleDownload}
              onToggleClientStatus={handleToggleClientStatus}
            />
          ))}
        </div>
      )}

      <BuyerOrderDialogs
        orders={filteredOrders}
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


