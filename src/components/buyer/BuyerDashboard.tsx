import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { AestheticWithNone } from '@/types/components';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

// Lazy load the OrdersSection component
const OrdersSection = lazy(() => import('@/components/orders/OrdersSection'));
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  ChevronLeft,
  Search, Heart, User,
  Users, Store, Package, LogOut
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import buyerApi from '@/api/buyerApi';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWishlist } from '@/contexts/WishlistContext';
import { useBuyerAuth } from '@/contexts/GlobalAuthContext';
import AestheticCategories from '@/components/AestheticCategories';
import ProductGrid from '@/components/ProductGrid';
import type { Aesthetic, Product } from '@/types';
import WishlistSection from './WishlistSection';
import { format } from 'date-fns';

import RefundCard from './RefundCard';
import SellersGrid from '@/components/SellersGrid';
import { MyShopsSection } from './dashboard/MyShopsSection';
import { useBuyerFollowedShops } from './dashboard/hooks/useBuyerFollowedShops';



// Main dashboard component
function BuyerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, updateBuyerProfile } = useBuyerAuth();
  const { wishlist } = useWishlist();
  const { toast } = useToast();
  const [selectedAesthetic, setSelectedAesthetic] = useState<AestheticWithNone>('clothes-style');
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
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
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

  const isMissingLocation = !user?.city || !user?.location;

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

  const handleAestheticChange = (aesthetic: Aesthetic) => {
    setSelectedAesthetic(aesthetic);
  };

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
      {/* Header */}
      <div style={{
        padding: '16px 18px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <button onClick={handleBack} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.86)',
          fontSize: 12, cursor: 'pointer', padding: '4px 0',
        }}>
          <ChevronLeft size={14} /> Back
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.2px' }}>
          Trusted Businesses
        </span>
        <div style={{ width: 30, height: 30 }} />
      </div>



      {/* Search bar */}
      {(activeSection === 'shop' || activeSection === 'shops') && (
        <div style={{
          padding: '6px 18px 20px',
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'center',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#080808', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 10,
            padding: '0 12px', height: 36,
            width: '100%',
            maxWidth: activeSection === 'shop' ? 760 : 560,
          }}>
            <Search size={14} color="rgba(255,255,255,0.78)" style={{ flexShrink: 0 }} />
            <input
              value={activeSection === 'shop' ? searchQuery : shopsSearchQuery}
              onChange={e => activeSection === 'shop' ? setSearchQuery(e.target.value) : setShopsSearchQuery(e.target.value)}
              placeholder={activeSection === 'shop' ? "Search products..." : "Search my shops..."}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: '#FFFFFF', fontSize: 13,
              }}
            />
          </div>
        </div>
      )}

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

        {activeSection === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>Profile</span>
              <button
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                style={{ background: 'none', border: 'none', color: '#F5C518', fontSize: 12, fontWeight: 600 }}
              >
                {isEditingProfile ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {/* Minimalist Profile Info */}
            <div style={{ background: '#050505', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.45)' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Full Name</div>
                <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>{user?.fullName}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Email Address</div>
                <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>{user?.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: 0.5 }}>City</div>
                  <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>{user?.city || 'ΓÇö'}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Area</div>
                  <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>{user?.location || 'ΓÇö'}</div>
                </div>
              </div>
            </div>

            {/* Edit mode placeholder - preserving existing logic would require more detailed injection, 
                 but keeping it functional by just showing the state for now or wrapping existing inputs */}
            {isEditingProfile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" className="bg-white/5 border border-white/15 text-white h-10" />
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="bg-white/5 border border-white/15 text-white h-10">
                    <SelectValue placeholder="Select City" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(locationData).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="bg-[#F5C518] text-black h-10 font-bold">
                  {isSavingProfile ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            )}

            <RefundCard refundAmount={user?.refunds || 0} />
          </div>
        )}
      </div>

      <Sheet open={isProfileSidebarOpen} onOpenChange={handleProfileSidebarOpenChange}>
        <SheetContent side="right" className="w-full max-w-sm overflow-y-auto bg-black text-white border-l border-white/15 shadow-2xl shadow-black/70">
          <SheetHeader className="text-left">
            <SheetTitle className="text-white">Buyer Profile</SheetTitle>
          </SheetHeader>

          <div className="mt-6 flex flex-col gap-4">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Full Name</div>
              <div className="mt-1 text-base font-semibold text-white">{user?.fullName || 'Not set'}</div>
              <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/60">Email Address</div>
              <div className="mt-1 text-sm font-semibold text-white break-words">{user?.email || 'Not set'}</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/60">City</div>
                  <div className="mt-1 text-sm font-semibold text-white">{user?.city || 'Not set'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Area</div>
                  <div className="mt-1 text-sm font-semibold text-white">{user?.location || 'Not set'}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Mobile Payment</div>
                  <div className="mt-1 text-sm font-semibold text-white">{user?.mobilePayment || 'Not set'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/60">WhatsApp</div>
                  <div className="mt-1 text-sm font-semibold text-white">{user?.whatsappNumber || 'Not set'}</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="h-10 rounded-xl border border-white/15 bg-white/10 text-sm font-semibold text-white hover:bg-white/15"
            >
              {isEditingProfile ? 'Cancel Editing' : 'Edit Profile'}
            </button>

            {isEditingProfile && (
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 shadow-sm space-y-3">
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" className="bg-black border border-white/15 text-white h-10" />
                <Select value={city} onValueChange={(value) => {
                  setCity(value);
                  setLocationArea('');
                }}>
                  <SelectTrigger className="bg-black border border-white/15 text-white h-10">
                    <SelectValue placeholder="Select City" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(locationData).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={locationArea} onValueChange={setLocationArea} disabled={!city}>
                  <SelectTrigger className="bg-black border border-white/15 text-white h-10">
                    <SelectValue placeholder="Select Area" />
                  </SelectTrigger>
                  <SelectContent>
                    {(locationData[city] || []).map(area => <SelectItem key={area} value={area}>{area}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={mobilePayment} onChange={e => setMobilePayment(e.target.value)} placeholder="Mobile Payment Number" className="bg-black border border-white/15 text-white h-10" />
                <Input value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} placeholder="WhatsApp Number" className="bg-black border border-white/15 text-white h-10" />
                <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="w-full bg-[#F5C518] text-black h-10 font-bold">
                  {isSavingProfile ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            )}

            <RefundCard refundAmount={user?.refunds || 0} />

            <Button
              onClick={handleLogout}
              variant="outline"
              className="h-10 w-full justify-center gap-2 border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/15"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Bottom navigation bar */}
      <div style={{
        height: 56,
        background: '#050505',
        borderTop: '0.5px solid rgba(255,255,255,0.16)',
        display: 'flex',
        alignItems: 'stretch',
        flexShrink: 0,
      }}>
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => setActiveTab(item.key)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3, background: 'none', border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'opacity 0.15s',
            }}
          >
            <item.Icon
              size={18}
              color={activeNav === item.key ? '#F5C518' : 'rgba(255,255,255,0.68)'}
            />
            <span style={{
              fontSize: 9, fontWeight: 500,
              color: activeNav === item.key ? '#F5C518' : 'rgba(255,255,255,0.68)',
            }}>
              {item.label}
            </span>
            {item.badge && (
              <div style={{
                position: 'absolute', top: 6, right: '50%',
                transform: 'translateX(10px)',
                width: 5, height: 5, borderRadius: '50%',
                background: '#F5C518',
              }} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default BuyerDashboard;
