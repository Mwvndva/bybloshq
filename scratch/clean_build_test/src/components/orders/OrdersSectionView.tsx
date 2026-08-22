import { useMemo, useState } from 'react';
import { ArrowRight, Package, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { EmptyState } from '@/shared/ui/empty-state';
import type { ApiOrder } from '@/shared/types';
import { BuyerOrderCard } from './BuyerOrderCard';
import { BuyerOrderDialogs } from './BuyerOrderDialogs';
import { OrdersLoadingState } from '@/shared/ui/OrdersLoadingState';

export interface OrdersSectionViewProps {
  orders: ApiOrder[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  clientStatus: Record<string, boolean>;
  isBecomingClient: Record<string, boolean>;
  downloadingOrderId: string | null;
  downloadProgress: Record<string, number>;
  isConfirming: string | null;
  onConfirmReceiptClick: (orderId: string) => void;
  onCancelOrder: (orderId: string) => Promise<void>;
  onConfirmReceipt: (orderId: string) => Promise<void>;
  onDownload: (order: ApiOrder) => Promise<void>;
  onToggleClientStatus: (sellerId: string, sellerName: string) => Promise<void>;
}

export function OrdersSectionView({
  orders,
  isLoading,
  error,
  refetch,
  clientStatus,
  isBecomingClient,
  downloadingOrderId,
  downloadProgress,
  isConfirming,
  onConfirmReceiptClick,
  onCancelOrder,
  onConfirmReceipt,
  onDownload,
  onToggleClientStatus,
}: OrdersSectionViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<ApiOrder | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const handleConfirmClick = (orderId: string) => {
    setCurrentOrderId(orderId);
    onConfirmReceiptClick(orderId);
    setShowReceiptDialog(true);
  };

  const handleCancelSubmit = async () => {
    if (!currentOrderId) return;
    setShowCancelDialog(false);
    await onCancelOrder(currentOrderId);
  };

  const handleReceiptSubmit = async () => {
    if (!currentOrderId) return;
    setShowReceiptDialog(false);
    await onConfirmReceipt(currentOrderId);
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
        <p className="text-red-200 mb-4">{error.message || 'Failed to load orders. Please try again later.'}</p>
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
          aria-label="Search orders"
          placeholder="Search orders by item, shop, or order number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-stone-200 bg-stone-50 pl-9 focus-visible:ring-stone-400"
        />
      </div>

      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={<Package className="h-7 w-7" />}
          title="No orders found"
          description={searchQuery ? 'No orders match your search. Try different keywords.' : "You haven't placed any orders yet. Start shopping!"}
          action={
            !searchQuery ? (
              <Button
                variant="outline"
                className="border-slate-300 dark:border-white/20 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/10"
                onClick={() => window.location.href = '/'}
              >
                Browse Products
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <BuyerOrderCard
              key={order.id}
              order={order}
              clientStatus={clientStatus}
              isBecomingClient={isBecomingClient}
              downloadingOrderId={downloadingOrderId}
              downloadProgress={downloadProgress}
              onViewDetails={(o) => setSelectedOrderForDetails(o)}
              onConfirmReceipt={handleConfirmClick}
              onDownload={onDownload}
              onToggleClientStatus={onToggleClientStatus}
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
        onCancelOrder={handleCancelSubmit}
        onConfirmReceipt={handleReceiptSubmit}
        onConfirmReceiptClick={handleConfirmClick}
      />
    </div>
  );
}
