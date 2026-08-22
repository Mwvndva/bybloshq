import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useBuyerAuth } from '@/features/auth/contexts';
import { useAsyncLock } from '@/shared/hooks/useAsyncLock';
import type { ApiOrder } from '@/shared/types';
import { isDigitalOrderItem } from '@/features/orders/utils/ordersSectionUtils';
import { useBuyerOrdersQuery } from '@/features/buyer/hooks/queries/useBuyerOrdersQuery';
import { useCancelOrderMutation } from '@/features/buyer/hooks/mutations/useCancelOrderMutation';
import { useConfirmOrderReceiptMutation } from '@/features/buyer/hooks/mutations/useConfirmOrderReceiptMutation';
import { useDownloadProductMutation } from '@/features/buyer/hooks/mutations/useDownloadProductMutation';
import { useLeaveClientMutation } from '@/features/buyer/hooks/mutations/useLeaveClientMutation';
import { useBecomeClientMutation } from '@/features/buyer/hooks/mutations/useBecomeClientMutation';
import { buyerQueryKeys } from '@/features/buyer/api/queryKeys';
import { OrdersSectionView } from '@/components/orders/OrdersSectionView';

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

export function OrdersSectionContainer() {
  const { user } = useBuyerAuth();
  const queryClient = useQueryClient();
  const { runWithLock } = useAsyncLock();

  const [isConfirming, setIsConfirming] = useState<string | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [currentConfirmOrderId, setCurrentConfirmOrderId] = useState<string | null>(null);
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
      // Error handled in mutation's onError
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
    setCurrentConfirmOrderId(orderId);
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await cancelOrderMutation.mutateAsync(orderId);
    } catch {
      // Error handled in mutation's onError
    }
  };

  const handleConfirmReceipt = async (orderId: string) => {
    const targetOrderId = orderId || currentConfirmOrderId;
    if (!targetOrderId) return;

    await runWithLock(async () => {
      setIsConfirming(targetOrderId);
      const loadingToast = toast.loading('Confirming order receipt...');

      try {
        await confirmReceiptMutation.mutateAsync(targetOrderId);
        toast.dismiss(loadingToast);
      } catch (err) {
        const errorObj = err as { code?: string; message?: string; response?: { data?: { message?: string } } };
        const errorMessage = errorObj.response?.data?.message || errorObj.message || 'An error occurred while confirming order receipt';
        toast.error(errorObj.code === 'ECONNABORTED'
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
      // Error handled in mutation's onError
    } finally {
      setIsBecomingClient(prev => ({ ...prev, [sellerId]: false }));
    }
  };

  return (
    <OrdersSectionView
      orders={orders}
      isLoading={isLoading}
      error={error as Error | null}
      refetch={refetch}
      clientStatus={mergedClientStatus}
      isBecomingClient={isBecomingClient}
      downloadingOrderId={downloadingOrderId}
      downloadProgress={downloadProgress}
      isConfirming={isConfirming}
      onConfirmReceiptClick={handleConfirmReceiptClick}
      onCancelOrder={handleCancelOrder}
      onConfirmReceipt={handleConfirmReceipt}
      onDownload={handleDownload}
      onToggleClientStatus={handleToggleClientStatus}
    />
  );
}

export default OrdersSectionContainer;
