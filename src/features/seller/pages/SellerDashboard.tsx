import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDeleteProductMutation, useUpdateProductMutation } from '@/features/seller/hooks/useSellerProducts';
import { useToast } from '@/shared/hooks/use-toast';
import { useSwipeTabs } from '@/shared/hooks/useSwipeTabs';
import { useGlobalAuth } from '@/features/auth/contexts';
import type { SellerProfile } from '@/features/auth/types/authTypes';
import { SellerProfileHero } from '../components/SellerProfileHero';
import { pendingOverviewStatuses } from '../components/dashboard/dashboardUtils';
import { useSellerDashboardData } from '../components/dashboard/hooks/useSellerDashboardData';
import { useSellerOrders } from '../components/dashboard/hooks/useSellerOrders';
import { useSellerSettingsForm } from '../components/dashboard/hooks/useSellerSettingsForm';
import { useSellerWithdrawals } from '../components/dashboard/hooks/useSellerWithdrawals';
import { CreatorsTab } from '../components/dashboard/tabs/CreatorsTab';
import { useSellerCreatorsQuery } from '@/features/seller/hooks/useSellerCreators';
import { OrdersTab } from '../components/dashboard/tabs/OrdersTab';
import { OverviewTab } from '../components/dashboard/tabs/OverviewTab';
import { ProductsTab } from '../components/dashboard/tabs/ProductsTab';
import { SettingsTab } from '../components/dashboard/tabs/SettingsTab';
import { WithdrawalsTab } from '../components/dashboard/tabs/WithdrawalsTab';
import { SellerDashboardHeader } from '../components/dashboard/widgets/SellerDashboardHeader';
import { SellerDashboardErrorState, SellerDashboardLoadingState } from '../components/dashboard/widgets/SellerDashboardState';
import { SellerDashboardTabs } from '../components/dashboard/widgets/SellerDashboardTabs';
import { copyLinkedTextToClipboard, getShopUrl, getShopUsername } from '@/shared/utils/shopLinks';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { useShopAccentOnly } from '@/shared/hooks/useShopTheme';
import { useSellerProfileQuery } from '@/features/seller/hooks/useSellerProfile';
import { useThemeScope } from '@/shared/hooks/useAppTheme';
import { registerSubNavigation, registerModalDismiss } from '@/shared/utils/modalBackHandler';
import type { Theme } from '@/shared/types';
import type { SellerDashboardProps, SellerTabId } from '../components/dashboard/types';

const SELLER_TABS_ORDER: readonly SellerTabId[] = [
  'overview',
  'products',
  'orders',
  'withdrawals',
  'creators',
  'settings',
];

export default function SellerDashboard({ children }: SellerDashboardProps) {
  useThemeScope('seller');
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user: _globalUser, logout, updateProfile } = useGlobalAuth();
  const sellerProfile = _globalUser?.role === 'seller' ? _globalUser.profile as SellerProfile : null;
  const isAuthLoading = false; // globalAuth loading is handled by AppProtectedRoute
  const updateSellerProfile = (updates: Partial<SellerProfile>) => updateProfile(updates, 'seller');

  // Drive the whole dashboard's accent from the seller's chosen shop theme
  // (sets --theme-accent / --theme-button-* CSS vars on :root). Read from the
  // live seller-profile query (not the auth-context snapshot) so a theme change
  // in Settings — which invalidates ['seller-profile'] — updates the accent
  // immediately instead of only after a full reload.
  const { data: liveSellerProfile } = useSellerProfileQuery(!!sellerProfile);
  const { data: creatorDashboardData } = useSellerCreatorsQuery(!!sellerProfile);
  useShopAccentOnly(((liveSellerProfile?.theme ?? sellerProfile?.theme) as Theme) || 'default');

  const pendingCreatorsCount = creatorDashboardData?.incomingRequests?.length || 0;
  const [activeTab, setActiveTab] = useState<SellerTabId>('overview');
  const [hasUnreadOrders, setHasUnreadOrders] = useState(false);
  const [lastViewedOrdersTime, setLastViewedOrdersTime] = useState<string | null>(
    localStorage.getItem('seller_last_viewed_orders')
  );
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);

  // Hook non-root tab navigation into native Android back stack
  useEffect(() => {
    if (!isNativeApp() || activeTab === 'overview') return;

    return registerSubNavigation(() => {
      setActiveTab('overview');
      return true;
    });
  }, [activeTab]);

  // Hook add product modal dismiss into native Android back stack
  useEffect(() => {
    if (!isNativeApp() || !isAddProductModalOpen) return;

    return registerModalDismiss(() => {
      setIsAddProductModalOpen(false);
      return true;
    });
  }, [isAddProductModalOpen]);

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
    sellerProfile: sellerProfile as unknown as import("@/shared/types").ApiSeller,
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

    const canonicalSlug = sellerProfile?.slug || (liveSellerProfile as unknown as typeof sellerProfile)?.slug || sellerProfile?.shopName;
    const shopUrl = getShopUrl(canonicalSlug);
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
  }, [sellerProfile?.shopName, sellerProfile?.slug, liveSellerProfile, toast]);

  const handleSelectTab = useCallback((tab: SellerTabId) => {
    setActiveTab(tab);

    if (tab === 'orders') {
      const now = new Date().toISOString();
      setLastViewedOrdersTime(now);
      localStorage.setItem('seller_last_viewed_orders', now);
      setHasUnreadOrders(false);
    }
  }, []);

  const {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  } = useSwipeTabs({
    tabs: SELLER_TABS_ORDER,
    activeTab,
    onChange: handleSelectTab,
  });

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
    <div className="seller-surface flex flex-col" style={{ minHeight: '100svh', height: '100svh', overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <SellerDashboardHeader sellerFirstName={sellerFirstName} />

      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        className="mx-auto w-full max-w-[1480px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6"
        style={isNativeApp() ? { paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' } : undefined}
      >
        <div className="mb-6 sm:mb-7 md:mb-8">
          <SellerProfileHero
            sellerProfile={(liveSellerProfile as unknown as typeof sellerProfile) || sellerProfile}
            shopUsername={getShopUsername(sellerProfile?.shopName)}
            onCopyShopLink={handleCopyShopLink}
            canEdit
          />
        </div>

        <SellerDashboardTabs
          activeTab={activeTab}
          hasUnreadOrders={hasUnreadOrders}
          pendingCreatorsCount={pendingCreatorsCount}
          onSelectTab={handleSelectTab}
        />

        {activeTab === 'orders' && <OrdersTab />}

        {activeTab === 'withdrawals' && (
          <WithdrawalsTab
            balance={analytics.availableBalance ?? analytics.balance}
            pendingSettlementBalance={analytics.pendingSettlementBalance}
            withdrawalReservedBalance={analytics.withdrawalReservedBalance}
            refundReservedBalance={analytics.refundReservedBalance}
            nextSettlementAt={analytics.nextSettlementAt}
            {...withdrawals}
          />
        )}

        {activeTab === 'creators' && <CreatorsTab />}

        {activeTab === 'overview' && (
          <OverviewTab
            analytics={analytics}
            pendingOverviewOrders={pendingOverviewOrders}
            sellerProfile={(liveSellerProfile as unknown as typeof sellerProfile) || sellerProfile}
            onSelectTab={handleSelectTab}
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
            onLogout={handleLogout}
            {...settingsForm}
          />
        )}
      </div>
    </div>
  );
}


