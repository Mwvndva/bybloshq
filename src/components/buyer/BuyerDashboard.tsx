import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useToast } from '@/components/ui/use-toast';

// Lazy load the OrdersSection component
const OrdersSection = lazy(() => import('@/components/orders/OrdersSection'));
import {
  Heart, User,
  Users, Store, Package
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWishlist } from '@/contexts/WishlistContext';
import { useBuyerAuth } from '@/contexts/GlobalAuthContext';
import WishlistSection from './WishlistSection';
import SellersGrid from '@/components/SellersGrid';
import { BuyerBottomNav } from './dashboard/BuyerBottomNav';
import { BuyerDashboardHeader } from './dashboard/BuyerDashboardHeader';
import { BuyerDashboardSearch } from './dashboard/BuyerDashboardSearch';
import { BuyerProfileSheet } from './dashboard/BuyerProfileSheet';
import { MyShopsSection } from './dashboard/MyShopsSection';
import { useBuyerFollowedShops } from './dashboard/hooks/useBuyerFollowedShops';



// Main dashboard component
function BuyerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, updateBuyerProfile } = useBuyerAuth();
  const { wishlist } = useWishlist();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<'shop' | 'shops' | 'wishlist' | 'orders' | 'profile'>(() => {
    // Priority 1: Pathname (new standard for direct linking)
    const pathname = location.pathname;
    if (pathname.includes('/buyer/orders')) return 'orders';
    if (pathname.includes('/buyer/shops')) return 'shops';
    if (pathname.includes('/buyer/wishlist')) return 'wishlist';
    if (pathname.includes('/buyer/profile')) return 'shop';

    // Priority 2: Navigation state
    const stateSection = (location.state as any)?.activeSection;
    if (stateSection) return stateSection;

    // Priority 3: Query parameters (legacy support)
    const queryParams = new URLSearchParams(location.search);
    const querySection = queryParams.get('section') || queryParams.get('tab');
    if (querySection === 'profile') return 'shop';
    if (querySection && ['shop', 'shops', 'wishlist', 'orders'].includes(querySection)) {
      return querySection as any;
    }

    return 'shop';
  });
  const [isProfileSidebarOpen, setIsProfileSidebarOpen] = useState(false);

  // Sync active section with URL changes
  useEffect(() => {
    const pathname = location.pathname;
    const queryParams = new URLSearchParams(location.search);
    const pathMapping: Record<string, typeof activeSection> = {
      '/buyer/orders': 'orders',
      '/buyer/shops': 'shops',
      '/buyer/wishlist': 'wishlist',
      '/buyer/profile': 'shop',
      '/buyer/dashboard': 'shop'
    };

    const targetSection = pathMapping[pathname];
    const shouldOpenProfileSidebar = pathname === '/buyer/profile'
      || queryParams.get('section') === 'profile'
      || queryParams.get('tab') === 'profile';

    if (shouldOpenProfileSidebar) {
      setIsProfileSidebarOpen(true);
    } else {
      setIsProfileSidebarOpen(false);
    }
    if (targetSection && targetSection !== activeSection) {
      setActiveSection(targetSection);
    }
  }, [location.pathname, location.search, activeSection]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity, setFilterCity] = useState<string>(''); // Default to empty (all cities)
  const [filterArea, setFilterArea] = useState<string>('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState<string>(user?.fullName || '');
  const [city, setCity] = useState<string>(user?.city || '');
  const [locationArea, setLocationArea] = useState<string>(user?.location || '');
  const [mobilePayment, setMobilePayment] = useState<string>(user?.mobilePayment || '');
  const [whatsappNumber, setWhatsappNumber] = useState<string>(user?.whatsappNumber || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [shopsSearchQuery, setShopsSearchQuery] = useState('');
  const [myShopsMobileTab, setMyShopsMobileTab] = useState<'online' | 'physical'>('online');
  const followedShops = useBuyerFollowedShops(shopsSearchQuery, activeSection === 'shops');

  // Order notification state
  const [hasUnreadOrders, setHasUnreadOrders] = useState(false);
  const [lastViewedOrdersTime, setLastViewedOrdersTime] = useState<string | null>(
    localStorage.getItem('buyer_last_viewed_orders')
  );

  const locationData: Record<string, string[]> = {
    'Nairobi': ['CBD', 'Westlands', 'Karen', 'Runda', 'Kileleshwa', 'Kilimani', 'Lavington', 'Parklands', 'Eastleigh', 'South B', 'South C', 'Langata', 'Kasarani', 'Embakasi', 'Ruaraka'],
  };

  const handleSaveProfile = async () => {
    if (!fullName || !city || !locationArea) {
      toast({
        title: "Missing Information",
        description: "Full name, city, and location are required.",
        variant: "destructive"
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateBuyerProfile({
        fullName,
        city,
        location: locationArea,
        mobilePayment,
        whatsappNumber
      });

      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved successfully.",
      });

      // Update the filter city when profile is updated
      setFilterCity(city);
      setIsEditingProfile(false);
    } catch (error) {
      console.error('Failed to update profile', error);
      toast({
        title: "Update Failed",
        description: "There was a problem saving your profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Removed auto-filter by user location - now shows all products by default
  // Users can manually select their city/location if they want to filter

  // Log when filter values change
  useEffect(() => {
    console.log('Filters updated:', { filterCity, filterArea });
  }, [filterCity, filterArea]);

  // Check for order updates
  useEffect(() => {
    const checkForOrderUpdates = async () => {
      try {
        const buyerApiModule = await import('@/api/buyerApi');
        const buyerApi = buyerApiModule.default;
        const orders = await buyerApi.getOrders();

        if (orders.length > 0) {
          // Get the most recent order update time (could be createdAt or updatedAt)
          const latestUpdateTime = Math.max(
            ...orders.map(order => {
              const created = new Date(order.createdAt).getTime();
              const updated = order.updatedAt ? new Date(order.updatedAt).getTime() : created;
              return Math.max(created, updated);
            })
          );

          const lastViewed = lastViewedOrdersTime
            ? new Date(lastViewedOrdersTime).getTime()
            : 0;

          setHasUnreadOrders(latestUpdateTime > lastViewed);
        } else {
          setHasUnreadOrders(false);
        }
      } catch (error) {
        console.error('Error checking for order updates:', error);
      }
    };

    // Check when component mounts and when user changes
    if (user) {
      checkForOrderUpdates();
    }
  }, [user, lastViewedOrdersTime]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Get refund amount from user - Parse as float to ensure it's a number
  const refundAmount = typeof user?.refunds === 'string' ? parseFloat(user.refunds) : (user?.refunds || 0);



  useEffect(() => {
    const originalBodyStyle = document.body.style.cssText;
    const originalHtmlStyle = document.documentElement.style.cssText;

    document.body.style.cssText = 'margin: 0; padding: 0; background-color: #F8FAFC; overflow-x: hidden;';
    document.documentElement.style.cssText = 'margin: 0; padding: 0; background-color: #F8FAFC; overflow-x: hidden;';

    return () => {
      document.body.style.cssText = originalBodyStyle;
      document.documentElement.style.cssText = originalHtmlStyle;
    };
  }, []);

  const handleBack = () => navigate('/');

  const handleProfileSidebarOpenChange = useCallback((open: boolean) => {
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
      navigate('/buyer/dashboard', { replace: true });
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

  const setActiveTab = (key: 'shop' | 'shops' | 'wishlist' | 'orders' | 'profile') => {
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
      const now = new Date().toISOString();
      setLastViewedOrdersTime(now);
      localStorage.setItem('buyer_last_viewed_orders', now);
      setHasUnreadOrders(false);
    }
  };

  return (
    <div className="page-enter" style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh',
      overflow: 'hidden',
      background: '#000000',
    }}>
      <BuyerDashboardHeader onBack={handleBack} />
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
        padding: '6px 18px 16px',
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'smooth',
        overscrollBehavior: 'contain',
      }}>
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
              <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>Wishlist</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>{wishlist.length} items</span>
            </div>
            <WishlistSection />
          </div>
        )}

        {activeSection === 'orders' && (
          <div className="space-y-4">
            <Suspense fallback={<div style={{ color: '#FFFFFF' }}>Loading orders...</div>}>
              <OrdersSection />
            </Suspense>
          </div>
        )}

      </div>

      <BuyerProfileSheet
        city={city}
        fullName={fullName}
        isEditingProfile={isEditingProfile}
        isOpen={isProfileSidebarOpen}
        isSavingProfile={isSavingProfile}
        locationArea={locationArea}
        locationData={locationData}
        mobilePayment={mobilePayment}
        refundAmount={user?.refunds || 0}
        user={user}
        whatsappNumber={whatsappNumber}
        onCityChange={setCity}
        onFullNameChange={setFullName}
        onLocationAreaChange={setLocationArea}
        onLogout={handleLogout}
        onMobilePaymentChange={setMobilePayment}
        onOpenChange={handleProfileSidebarOpenChange}
        onSaveProfile={handleSaveProfile}
        onToggleEdit={() => setIsEditingProfile(!isEditingProfile)}
        onWhatsappNumberChange={setWhatsappNumber}
      />

      <BuyerBottomNav activeNav={activeNav} navItems={navItems} onSelect={setActiveTab} />
    </div>
  );
}

export default BuyerDashboard;
