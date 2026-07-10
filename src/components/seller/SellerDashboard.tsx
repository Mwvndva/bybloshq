import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDeleteProductMutation, useUpdateProductMutation } from '@/hooks/seller/useSellerProducts';
import { useToast } from '@/hooks/use-toast';
import { useSellerAuth } from '@/features/auth/contexts';
import { UnifiedAnalyticsHub } from './UnifiedAnalyticsHub';
import { pendingOverviewStatuses } from './dashboard/dashboardUtils';
import { useSellerDashboardData } from './dashboard/hooks/useSellerDashboardData';
import { useSellerOrders } from './dashboard/hooks/useSellerOrders';
import { useSellerSettingsForm } from './dashboard/hooks/useSellerSettingsForm';
import { useSellerWithdrawals } from './dashboard/hooks/useSellerWithdrawals';
import { OrdersTab } from './dashboard/tabs/OrdersTab';
import { OverviewTab } from './dashboard/tabs/OverviewTab';
import { ProductsTab } from './dashboard/tabs/ProductsTab';
import { SettingsTab } from './dashboard/tabs/SettingsTab';
import { WithdrawalsTab } from './dashboard/tabs/WithdrawalsTab';
import { SellerDashboardHeader } from './dashboard/widgets/SellerDashboardHeader';
import { SellerDashboardErrorState, SellerDashboardLoadingState } from './dashboard/widgets/SellerDashboardState';
import { SellerDashboardTabs } from './dashboard/widgets/SellerDashboardTabs';
import { copyLinkedTextToClipboard, getShopUrl, getShopUsername } from '@/lib/shopLinks';
import type { SellerDashboardProps, SellerTabId } from './dashboard/types';

export default function SellerDashboard({ children }: SellerDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { seller: sellerProfile, isLoading: isAuthLoading, updateSellerProfile, logout } = useSellerAuth();

  const [activeTab, setActiveTab] = useState<SellerTabId>('overview');
  const [hasUnreadOrders, setHasUnreadOrders] = useState(false);
  const [lastViewedOrdersTime, setLastViewedOrdersTime] = useState<string | null>(
    localStorage.getItem('seller_last_viewed_orders')
  );
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);

  const sellerFirstName = useMemo(
    () => sellerProfile?.fullName?.trim().split(/\s+/)[0] || sellerProfile?.shopName?.trim().split(/\s+/)[0] || 'Seller',
    [sellerProfile?.fullName, sellerProfile?.shopName]
  );

  const {
    analytics,
    error,
    fetchData,
    fetchProducts,
    isLoading,
    products
  } = useSellerDashboardData({
    navigate,
    locationPathname: location.pathname,
    toast
  });

  const settingsForm = useSellerSettingsForm({
    sellerProfile: sellerProfile as unknown as import("@/types").ApiSeller,
    toast,
    updateSellerProfile
  });

  const withdrawals = useSellerWithdrawals({
    balance: analytics?.balance || 0,
    enabled: activeTab === 'withdrawals',
    toast
  });
  const ordersQuery = useSellerOrders();

  const pendingOverviewOrders = useMemo(() => {
    return (analytics?.recentOrders || [])
      .filter(order => pendingOverviewStatuses.has(order.status))
      .slice(0, 8);
  }, [analytics?.recentOrders]);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const handleCopyShopLink = useCallback(async () => {
    if (!sellerProfile?.shopName) return;

    const shopUrl = getShopUrl(sellerProfile.shopName);
    const shopUsername = getShopUsername(sellerProfile.shopName);
    try {
      const copyMode = await copyLinkedTextToClipboard(shopUsername, shopUrl);
      toast({
        title: 'Shop link copied',
        description: copyMode === 'rich'
          ? `${shopUsername} was copied as linked text.`
          : `${shopUrl} was copied.`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to copy link. Please try again.',
        variant: 'destructive',
      });
    }
  }, [sellerProfile?.shopName, toast]);

  const handleSelectTab = useCallback((tab: SellerTabId) => {
    setActiveTab(tab);

    if (tab === 'orders') {
      const now = new Date().toISOString();
      setLastViewedOrdersTime(now);
      localStorage.setItem('seller_last_viewed_orders', now);
      setHasUnreadOrders(false);
    }
  }, []);

  const deleteProductMutation = useDeleteProductMutation();
  const updateProductMutation = useUpdateProductMutation();

  const handleDeleteProduct = useCallback(async (id: string) => {
    await deleteProductMutation.mutateAsync(id);
  }, [deleteProductMutation]);

  const handleStatusUpdate = useCallback(async (productId: string, newStatus: 'available' | 'sold') => {
    try {
      const isSold = newStatus === 'sold';
      const soldAt = isSold ? new Date().toISOString() : null;

      await updateProductMutation.mutateAsync({
        id: productId,
        updates: {
          status: newStatus,
          soldAt
        }
      });

      toast({
        title: 'Success',
        description: `Product marked as ${newStatus}`,
      });
    } catch (error) {
      console.error('Failed to update product status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update product status',
        variant: 'destructive',
      });
    }
  }, [toast, updateProductMutation]);

  useEffect(() => {
    const orders = ordersQuery.data || [];
    if (orders.length > 0) {
      const latestOrderTime = new Date(orders[0].createdAt).getTime();
      const lastViewed = lastViewedOrdersTime
        ? new Date(lastViewedOrdersTime).getTime()
        : 0;

      setHasUnreadOrders(latestOrderTime > lastViewed);
    } else {
      setHasUnreadOrders(false);
    }
  }, [lastViewedOrdersTime, ordersQuery.data]);

  if (children) {
    return (
      <div className="space-y-6">
        {children({ fetchData })}
      </div>
    );
  }

  if (isAuthLoading || isLoading) {
    return <SellerDashboardLoadingState />;
  }

  if (!analytics || error) {
    return <SellerDashboardErrorState error={error} onRetry={fetchData} />;
  }

  return (
    <>
      <SellerDashboardHeader
        sellerFirstName={sellerFirstName}
        onBackHome={() => navigate('/')}
        onLogout={handleLogout}
      />

      <div className="mx-auto w-full max-w-[1480px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
        <div className="mb-6 sm:mb-7 md:mb-8">
          <UnifiedAnalyticsHub analytics={analytics} />
        </div>

        <SellerDashboardTabs
          activeTab={activeTab}
          hasUnreadOrders={hasUnreadOrders}
          onSelectTab={handleSelectTab}
        />

        {activeTab === 'orders' && <OrdersTab />}

        {activeTab === 'withdrawals' && (
          <WithdrawalsTab
            balance={analytics.balance}
            {...withdrawals}
          />
        )}

        {activeTab === 'overview' && (
          <OverviewTab
            analytics={analytics}
            pendingOverviewOrders={pendingOverviewOrders}
            sellerProfile={sellerProfile}
            onCopyShopLink={handleCopyShopLink}
          />
        )}

        {activeTab === 'products' && (
          <ProductsTab
            fetchProducts={fetchProducts}
            isAddProductModalOpen={isAddProductModalOpen}
            onDeleteProduct={handleDeleteProduct}
            onEditProduct={(id) => navigate(`/seller/edit-product/${id}`)}
            onStatusUpdate={handleStatusUpdate}
            products={products}
            setIsAddProductModalOpen={setIsAddProductModalOpen}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            sellerProfile={sellerProfile}
            {...settingsForm}
          />
        )}
      </div>
    </>
  );
}


