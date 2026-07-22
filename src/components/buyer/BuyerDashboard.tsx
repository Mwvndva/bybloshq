import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useToast } from '@/hooks/use-toast';

// Lazy load the OrdersSection component
const OrdersSection = lazy(() => import('@/components/orders/OrdersSection'));
import {
  Heart, User,
  Users, Store, Package
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWishlist } from '@/hooks/useWishlist';
import { useBuyerAuth } from '@/features/auth/contexts';
import WishlistSection from './WishlistSection';
import SellersGrid from '@/components/SellersGrid';
import { BuyerBottomNav } from './dashboard/BuyerBottomNav';
import { BuyerDashboardHeader } from './dashboard/BuyerDashboardHeader';
import { BuyerDashboardSearch } from './dashboard/BuyerDashboardSearch';
import { BuyerProfileSheet } from './dashboard/BuyerProfileSheet';
import { MyShopsSection } from './dashboard/MyShopsSection';
import { MembershipGate } from '@/features/membership/MembershipGate';
import { useBuyerFollowedShops } from './dashboard/hooks/useBuyerFollowedShops';
import { useBuyerSwipeNav } from './dashboard/hooks/useBuyerSwipeNav';
import { useBuyerActiveSection } from './dashboard/hooks/useBuyerActiveSection';
import { useBuyerProfileForm } from './dashboard/hooks/useBuyerProfileForm';
import { useBuyerOrdersNotification } from './dashboard/hooks/useBuyerOrdersNotification';


type DashboardSection = 'shop' | 'shops' | 'wishlist' | 'orders';
type BuyerSection = DashboardSection | 'profile';

const PROFILE_CLOSE_NAV_DELAY_MS = 180;

// Main dashboard component
function BuyerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, updateBuyerProfile } = useBuyerAuth();
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
  const refundAmount = typeof user?.refunds === 'string' ? parseFloat(user.refunds) : (user?.refunds || 0);



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

  const { onTouchStart: handleDashboardTouchStart, onTouchEnd: handleDashboardTouchEnd } = useBuyerSwipeNav(activeSection, isProfileSidebarOpen, setActiveTab);


  return (
    <div className="page-enter dashboard-layout min-w-0 overflow-x-hidden bg-[var(--byblos-bg,#000000)] text-[var(--byblos-text,#ffffff)] transition-colors duration-200" style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100svh',
      height: '100svh',
      overflow: 'hidden',
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
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'smooth',
        overscrollBehavior: 'contain',
      }}
        onTouchStart={handleDashboardTouchStart}
        onTouchEnd={handleDashboardTouchEnd}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Wishlist</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{wishlist.length} items</span>
            </div>
            <WishlistSection />
          </div>
        )}

        {activeSection === 'orders' && (
          <div className="space-y-4">
            <Suspense fallback={<div style={{ color: '#ffffff' }}>Loading orders...</div>}>
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


