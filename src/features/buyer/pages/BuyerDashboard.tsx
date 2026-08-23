import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useToast } from '@/shared/hooks/use-toast';

// Lazy load the OrdersSection component
const OrdersSection = lazy(() => import('@/features/orders/components/OrdersSectionContainer'));
import {
  Heart, User,
  Users, Store, Package
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWishlist } from '@/features/buyer/hooks/useWishlist';
import { useGlobalAuth } from '@/features/auth/contexts';
import type { BuyerProfile } from '@/features/auth/types/authTypes';
import WishlistSection from '../components/WishlistSection';
import SellersGrid from '@/features/shop/components/SellersGrid';
import { BuyerBottomNav } from '../components/dashboard/BuyerBottomNav';
import { BuyerDashboardHeader } from '../components/dashboard/BuyerDashboardHeader';
import { BuyerDashboardSearch } from '../components/dashboard/BuyerDashboardSearch';
import { BuyerProfileSheet } from '../components/dashboard/BuyerProfileSheet';
import { MyShopsSection } from '../components/dashboard/MyShopsSection';
import { MembershipGate } from '@/features/membership/components/MembershipGate';
import { useBuyerFollowedShops } from '../components/dashboard/hooks/useBuyerFollowedShops';
import { useSwipeTabs } from '@/shared/hooks/useSwipeTabs';
import { useBuyerActiveSection } from '../components/dashboard/hooks/useBuyerActiveSection';
import { useBuyerProfileForm } from '../components/dashboard/hooks/useBuyerProfileForm';
import { useBuyerOrdersNotification } from '../components/dashboard/hooks/useBuyerOrdersNotification';


import { LoadingScreen as RouteFallback } from '@/shared/components/LoadingScreen';

type DashboardSection = 'shop' | 'shops' | 'wishlist' | 'orders';
type BuyerSection = DashboardSection | 'profile';

const PROFILE_CLOSE_NAV_DELAY_MS = 180;
const SWIPE_SECTIONS = ['shop', 'shops', 'wishlist', 'orders'] as const;

// Main dashboard component
function BuyerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: globalUser, logout, updateProfile } = useGlobalAuth();
  const user = globalUser?.role === 'buyer' ? globalUser.profile as BuyerProfile : null;
  const updateBuyerProfile = (updates: Partial<BuyerProfile>) => updateProfile(updates, 'buyer');
  const { wishlist } = useWishlist();
  const { toast } = useToast();
  const { activeSection, setActiveSection, isProfileSidebarOpen, setIsProfileSidebarOpen } = useBuyerActiveSection();
  const profileCloseNavigationTimerRef = useRef<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity] = useState<string>(''); // Default to empty (all cities)
  const [filterArea, setFilterArea] = useState<string>('');
  const {
    isEditingProfile, setIsEditingProfile,
    mobilePayment, setMobilePayment,
    whatsappNumber, setWhatsappNumber,
    isSavingProfile, handleSaveProfile,
  } = useBuyerProfileForm();
  const [shopsSearchQuery, setShopsSearchQuery] = useState('');
  const [myShopsMobileTab, setMyShopsMobileTab] = useState<'online' | 'physical'>('online');
  const followedShops = useBuyerFollowedShops(shopsSearchQuery, activeSection === 'shops');

  const { hasUnreadOrders, markOrdersViewed } = useBuyerOrdersNotification(!!user);

  // Removed auto-filter by user location - now shows all products by default
  // Users can manually select their city/location if they want to filter

  // Log when filter values change
  useEffect(() => {
    console.log('Filters updated:', { filterCity, filterArea });
  }, [filterCity, filterArea]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Get refund amount from user - Parse as float to ensure it's a number
  const refundAmount = typeof (user as unknown as { refunds?: string | number })?.refunds === 'string'
    ? parseFloat((user as unknown as { refunds: string }).refunds)
    : ((user as unknown as { refunds?: number })?.refunds || 0);



  useEffect(() => {
    const originalBodyStyle = document.body.style.cssText;
    const originalHtmlStyle = document.documentElement.style.cssText;

    document.body.style.cssText = 'margin: 0; padding: 0; background-color: var(--byblos-bg, #000000); overflow-x: hidden;';
    document.documentElement.style.cssText = 'margin: 0; padding: 0; background-color: var(--byblos-bg, #000000); overflow-x: hidden;';

    return () => {
      document.body.style.cssText = originalBodyStyle;
      document.documentElement.style.cssText = originalHtmlStyle;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (profileCloseNavigationTimerRef.current !== null) {
        window.clearTimeout(profileCloseNavigationTimerRef.current);
      }
    };
  }, []);

  const handleProfileSidebarOpenChange = useCallback((open: boolean) => {
    if (profileCloseNavigationTimerRef.current !== null) {
      window.clearTimeout(profileCloseNavigationTimerRef.current);
      profileCloseNavigationTimerRef.current = null;
    }

    setIsProfileSidebarOpen(open);

    if (open) {
      if (location.pathname !== '/buyer/profile') {
        navigate('/buyer/profile', { replace: true });
      }
      return;
    }

    setIsEditingProfile(false);
    const queryParams = new URLSearchParams(location.search);
    if (
      location.pathname === '/buyer/profile' ||
      queryParams.get('section') === 'profile' ||
      queryParams.get('tab') === 'profile'
    ) {
      profileCloseNavigationTimerRef.current = window.setTimeout(() => {
        navigate('/buyer/dashboard', { replace: true });
        profileCloseNavigationTimerRef.current = null;
      }, PROFILE_CLOSE_NAV_DELAY_MS);
    }
  }, [location.pathname, location.search, navigate]);


  const navItems = [
    { key: 'shop', label: 'Shops', Icon: Store, path: '/buyer/dashboard' },
    { key: 'shops', label: 'My Shops', Icon: Users, path: '/buyer/shops' },
    { key: 'wishlist', label: 'Wishlist', Icon: Heart, path: '/buyer/wishlist' },
    { key: 'orders', label: 'Orders', Icon: Package, path: '/buyer/orders', badge: hasUnreadOrders },
    { key: 'profile', label: 'Profile', Icon: User, path: '/buyer/profile' },
  ] as const;

  const activeNav = isProfileSidebarOpen ? 'profile' : (activeSection === 'shop' ? 'shop' : activeSection);

  const setActiveTab = (key: BuyerSection) => {
    const pathMap = {
      shop: 'dashboard',
      shops: 'shops',
      orders: 'orders',
      wishlist: 'wishlist',
      profile: 'profile'
    };
    if (key === 'profile') {
      setIsProfileSidebarOpen(true);
      navigate('/buyer/profile');
      return;
    }
    setIsProfileSidebarOpen(false);
    setIsEditingProfile(false);
    navigate(`/buyer/${pathMap[key]}`);
    if (key === 'orders') {
      markOrdersViewed();
    }
  };

  const {
    onTouchStart: handleDashboardTouchStart,
    onTouchEnd: handleDashboardTouchEnd,
    onTouchCancel: handleDashboardTouchCancel,
  } = useSwipeTabs({
    tabs: SWIPE_SECTIONS,
    activeTab: activeSection,
    onChange: setActiveTab,
    disabled: isProfileSidebarOpen,
  });


  return (
    <div className="page-enter dashboard-layout min-w-0 overflow-x-hidden bg-[var(--byblos-bg,#000000)] text-[var(--byblos-text,#ffffff)] transition-colors duration-200" style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100svh',
      height: '100svh',
      overflowY: 'hidden',
    }}>
      <BuyerDashboardHeader />
      <BuyerDashboardSearch
        activeSection={activeSection}
        productSearchQuery={searchQuery}
        shopsSearchQuery={shopsSearchQuery}
        onProductSearchChange={setSearchQuery}
        onShopsSearchChange={setShopsSearchQuery}
      />

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: 'clamp(10px, 4vw, 18px)',
        paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'smooth',
        overscrollBehavior: 'none',
      }}
        onTouchStart={handleDashboardTouchStart}
        onTouchEnd={handleDashboardTouchEnd}
        onTouchCancel={handleDashboardTouchCancel}
      >
        {activeSection === 'shop' && (
          <>
            <SellersGrid filterCity={filterCity} filterArea={filterArea} searchQuery={searchQuery} isBuyer={true} />
          </>
        )}

        {activeSection === 'shops' && (
          <MyShopsSection
            filteredCount={followedShops.filteredShops.length}
            isLoadingShops={followedShops.isLoadingShops}
            mobileTab={myShopsMobileTab}
            onClickCountChange={followedShops.handleShopClickCountChange}
            onMobileTabChange={setMyShopsMobileTab}
            onUnfollowShop={followedShops.handleUnfollowShop}
            searchQuery={shopsSearchQuery}
            shopGroups={followedShops.shopGroups}
            shopsCount={followedShops.shops.length}
            unfollowingShopId={followedShops.unfollowingShopId}
          />
        )}

        {activeSection === 'wishlist' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white">Wishlist</span>
              <span className="text-xs font-semibold text-slate-500 dark:text-white/50">{wishlist.length} items</span>
            </div>
            <WishlistSection />
          </div>
        )}

        {activeSection === 'orders' && (
          <div className="space-y-4">
            <Suspense fallback={<RouteFallback message="Loading orders..." />}>
              <OrdersSection />
            </Suspense>
          </div>
        )}
      </div>

      <BuyerProfileSheet
        isEditingProfile={isEditingProfile}
        isOpen={isProfileSidebarOpen}
        isSavingProfile={isSavingProfile}
        mobilePayment={mobilePayment}
        refundAmount={user?.refunds || 0}
        user={user}
        whatsappNumber={whatsappNumber}
        onLogout={handleLogout}
        onMobilePaymentChange={setMobilePayment}
        onOpenChange={handleProfileSidebarOpenChange}
        onSaveProfile={handleSaveProfile}
        onToggleEdit={() => setIsEditingProfile(!isEditingProfile)}
        onWhatsappNumberChange={setWhatsappNumber}
      />

      <BuyerBottomNav activeNav={activeNav} navItems={navItems} onSelect={setActiveTab} />

      {/* First-login Byblos membership card opt-in + share */}
      <MembershipGate enabled={!!user} />
    </div>
  );
}

export default BuyerDashboard;


