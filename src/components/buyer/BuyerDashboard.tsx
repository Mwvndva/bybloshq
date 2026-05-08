import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { AestheticWithNone } from '@/types/components';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

// Lazy load the OrdersSection component
const OrdersSection = lazy(() => import('@/components/orders/OrdersSection'));
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  ChevronLeft, LogOut,
  Search, Heart, User,
  Users, Store, Package, Info, X
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
import SellerBrandCard from '@/components/SellerBrandCard';

const getShopId = (shop) => String(shop.id || shop.sellerId || shop.seller_id || '');

const updateSellerClientCount = (seller, clientCount) => ({
  ...seller,
  clientCount,
  client_count: clientCount
});

const updateSellerClickCount = (seller, clickCount) => ({
  ...seller,
  knockCount: clickCount,
  knock_count: clickCount
});

const hasValidShopCoordinate = (shop) => {
  const lat = Number(shop?.latitude);
  const lng = Number(shop?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
};

const isPhysicalShop = (shop) => Boolean(
  shop?.hasPhysicalShop ||
  shop?.has_physical_shop ||
  shop?.physicalAddress ||
  shop?.physical_address ||
  hasValidShopCoordinate(shop)
);

function SellerBrandCardSkeleton() {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 16, padding: 12, overflow: 'hidden', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(15,23,42,0.08)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ height: 12, width: '62%', borderRadius: 999, background: 'rgba(15,23,42,0.1)', marginBottom: 8 }} />
          <div style={{ height: 10, width: '86%', borderRadius: 999, background: 'rgba(15,23,42,0.06)', marginBottom: 6 }} />
          <div style={{ height: 10, width: '54%', borderRadius: 999, background: 'rgba(15,23,42,0.05)' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 12 }}>
        {[0, 1, 2].map(item => (
          <div key={item} style={{ height: 46, borderRadius: 12, background: 'rgba(15,23,42,0.045)' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 12 }}>
        <div style={{ height: 40, borderRadius: 12, background: 'rgba(15,23,42,0.06)' }} />
        <div style={{ width: 94, height: 40, borderRadius: 12, background: 'rgba(248,113,113,0.08)' }} />
      </div>
    </div>
  );
}



// Main dashboard component
function BuyerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
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
    if (pathname.includes('/buyer/profile')) return 'profile';

    // Priority 2: Navigation state
    const stateSection = (location.state as any)?.activeSection;
    if (stateSection) return stateSection;

    // Priority 3: Query parameters (legacy support)
    const queryParams = new URLSearchParams(location.search);
    const querySection = queryParams.get('section') || queryParams.get('tab');
    if (querySection && ['shop', 'shops', 'wishlist', 'orders', 'profile'].includes(querySection)) {
      return querySection as any;
    }

    return 'shop';
  });

  // Sync active section with URL changes
  useEffect(() => {
    const pathname = location.pathname;
    const pathMapping: Record<string, typeof activeSection> = {
      '/buyer/orders': 'orders',
      '/buyer/shops': 'shops',
      '/buyer/wishlist': 'wishlist',
      '/buyer/profile': 'profile',
      '/buyer/dashboard': 'shop'
    };

    const targetSection = pathMapping[pathname];
    if (targetSection && targetSection !== activeSection) {
      setActiveSection(targetSection);
    }
  }, [location.pathname, activeSection]);
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
  const shopsQuery = useQuery({
    queryKey: ['buyer-followed-shops'],
    queryFn: () => buyerApi.getShops({ page: 1, limit: 48 }),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: activeSection === 'shops'
  });
  const shops = shopsQuery.data || [];
  const isLoadingShops = shopsQuery.isLoading;
  const [unfollowingShopId, setUnfollowingShopId] = useState<string | null>(null);
  const unfollowShopMutation = useMutation({
    mutationFn: (shop) => buyerApi.leaveClient(getShopId(shop)),
    onMutate: async (shop) => {
      const shopId = getShopId(shop);
      setUnfollowingShopId(shopId);
      await queryClient.cancelQueries({ queryKey: ['buyer-followed-shops'] });
      await queryClient.cancelQueries({ queryKey: ['public-sellers'] });

      const previousFollowedShops = queryClient.getQueryData<any[]>(['buyer-followed-shops']);
      const previousPublicSellerQueries = queryClient.getQueriesData({ queryKey: ['public-sellers'] });

      queryClient.setQueryData<any[]>(['buyer-followed-shops'], (current = []) =>
        current.filter(item => getShopId(item) !== shopId)
      );

      queryClient.setQueriesData({ queryKey: ['public-sellers'] }, (current: any) => {
        if (!current?.sellers) return current;
        return {
          ...current,
          sellers: current.sellers.map((seller) => (
            getShopId(seller) === shopId
              ? updateSellerClientCount(seller, Math.max(0, Number(seller.clientCount ?? seller.client_count ?? 0) - 1))
              : seller
          ))
        };
      });

      return { previousFollowedShops, previousPublicSellerQueries };
    },
    onError: (error, _shop, context) => {
      if (context?.previousFollowedShops) {
        queryClient.setQueryData(['buyer-followed-shops'], context.previousFollowedShops);
      }
      context?.previousPublicSellerQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast({
        title: 'Could not unfollow shop',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive'
      });
    },
    onSuccess: (result, shop) => {
      const shopId = getShopId(shop);
      if (typeof result.clientCount === 'number') {
        queryClient.setQueriesData({ queryKey: ['public-sellers'] }, (current: any) => {
          if (!current?.sellers) return current;
          return {
            ...current,
            sellers: current.sellers.map((seller) => (
              getShopId(seller) === shopId
                ? updateSellerClientCount(seller, result.clientCount)
                : seller
            ))
          };
        });
      }
      toast({
        title: 'Shop unfollowed',
        description: result.message || 'The shop was removed from My Shops.'
      });
    },
    onSettled: () => {
      setUnfollowingShopId(null);
      queryClient.invalidateQueries({ queryKey: ['buyer-followed-shops'] });
      queryClient.invalidateQueries({ queryKey: ['public-sellers'] });
    }
  });

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

  const handleBack = () => navigate(-1);


  const navItems = [
    { key: 'shop', label: 'Shops', Icon: Store, path: '/buyer/dashboard' },
    { key: 'shops', label: 'My Shops', Icon: Users, path: '/buyer/shops' },
    { key: 'wishlist', label: 'Wishlist', Icon: Heart, path: '/buyer/wishlist' },
    { key: 'orders', label: 'Orders', Icon: Package, path: '/buyer/orders', badge: hasUnreadOrders },
    { key: 'profile', label: 'Profile', Icon: User, path: '/buyer/profile' },
  ];

  const activeNav = activeSection === 'shop' ? 'shop' : activeSection;

  const setActiveTab = (key) => {
    const pathMap = {
      shop: 'dashboard',
      shops: 'shops',
      orders: 'orders',
      wishlist: 'wishlist',
      profile: 'profile'
    };
    navigate(`/buyer/${pathMap[key]}`);
    if (key === 'orders') {
      const now = new Date().toISOString();
      setLastViewedOrdersTime(now);
      localStorage.setItem('buyer_last_viewed_orders', now);
      setHasUnreadOrders(false);
    }
  };

  const filteredShops = useMemo(() => {
    const query = shopsSearchQuery.trim().toLowerCase();
    if (!query) return shops;

    return shops.filter((shop) => {
      const name = String(shop.shopName || shop.name || '').toLowerCase();
      const location = String(shop.location || shop.city || '').toLowerCase();
      return name.includes(query) || location.includes(query);
    });
  }, [shops, shopsSearchQuery]);

  const { onlineShops, physicalShops } = useMemo(() => {
    const online = [];
    const physical = [];

    filteredShops.forEach((shop) => {
      if (isPhysicalShop(shop)) {
        physical.push(shop);
      } else {
        online.push(shop);
      }
    });

    return { onlineShops: online, physicalShops: physical };
  }, [filteredShops]);

  const handleShopClickCountChange = useCallback((shop, clickCount) => {
    const shopId = getShopId(shop);
    if (!shopId) return;

    queryClient.setQueryData<any[]>(['buyer-followed-shops'], (current = []) =>
      current.map(item => getShopId(item) === shopId ? updateSellerClickCount(item, clickCount) : item)
    );
    queryClient.setQueriesData({ queryKey: ['public-sellers'] }, (current: any) => {
      if (!current?.sellers) return current;
      return {
        ...current,
        sellers: current.sellers.map((seller) => (
          getShopId(seller) === shopId ? updateSellerClickCount(seller, clickCount) : seller
        ))
      };
    });
  }, [queryClient]);

  const handleUnfollowShop = useCallback((shop) => {
    unfollowShopMutation.mutate(shop);
  }, [unfollowShopMutation]);

  return (
    <div className="page-enter" style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh',
      overflow: 'hidden',
      background: '#F8FAFC',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 18px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <button onClick={handleBack} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', color: 'rgba(15,23,42,0.58)',
          fontSize: 12, cursor: 'pointer', padding: '4px 0',
        }}>
          <ChevronLeft size={14} /> Back
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#111827', letterSpacing: '-0.2px' }}>
          Trusted Businesses
        </span>
        <div
          onClick={handleLogout}
          style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <LogOut size={13} color="rgba(15,23,42,0.62)" />
        </div>
      </div>



      {/* Search bar */}
      {(activeSection === 'shop' || activeSection === 'shops') && (
        <div style={{ padding: '0 18px 10px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 10,
            padding: '0 12px', height: 36,
          }}>
            <Search size={14} color="rgba(15,23,42,0.45)" style={{ flexShrink: 0 }} />
            <input
              value={activeSection === 'shop' ? searchQuery : shopsSearchQuery}
              onChange={e => activeSection === 'shop' ? setSearchQuery(e.target.value) : setShopsSearchQuery(e.target.value)}
              placeholder={activeSection === 'shop' ? "Search products..." : "Search my shops..."}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: '#111827', fontSize: 13,
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
        padding: '0 18px 16px',
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
          <>
            <div style={{
              padding: '0 0 8px',
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>My Shops</span>
              <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.42)' }}>{filteredShops.length} shops</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  key: 'online',
                  title: 'Online Shops',
                  count: onlineShops.length,
                  shops: onlineShops,
                  empty: shopsSearchQuery ? 'No online shops match your search.' : 'No online shops followed yet.'
                },
                {
                  key: 'physical',
                  title: 'Physical Shops',
                  count: physicalShops.length,
                  shops: physicalShops,
                  empty: shopsSearchQuery ? 'No physical shops match your search.' : 'No physical shops followed yet.'
                }
              ].map((group) => (
                <section key={group.key} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2 px-1">
                    <span className="text-xs font-black text-slate-950">{group.title}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      {group.count}
                    </span>
                  </div>

                  <div className="grid gap-2.5">
                    {isLoadingShops && shops.length === 0 && Array.from({ length: 3 }).map((_, index) => (
                      <SellerBrandCardSkeleton key={`${group.key}-skeleton-${index}`} />
                    ))}

                    {!isLoadingShops && group.shops.map(shop => (
                      <SellerBrandCard
                        key={getShopId(shop)}
                        seller={shop}
                        isBuyer
                        showUnfollow
                        onUnfollow={handleUnfollowShop}
                        onClickCountChange={handleShopClickCountChange}
                        isUnfollowing={unfollowingShopId === getShopId(shop)}
                      />
                    ))}

                    {!isLoadingShops && filteredShops.length > 0 && group.shops.length === 0 && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-8 text-center text-xs text-slate-400">
                        {group.empty}
                      </div>
                    )}
                  </div>
                </section>
              ))}
            </div>

            {filteredShops.length === 0 && !isLoadingShops && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(15,23,42,0.42)' }}>
                {shopsSearchQuery ? 'No followed shops match your search.' : 'No shops followed yet.'}
              </div>
            )}
          </>
        )}

        {activeSection === 'wishlist' && (
          <div className="space-y-4">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Wishlist</span>
              <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.42)' }}>{wishlist.length} items</span>
            </div>
            <WishlistSection />
          </div>
        )}

        {activeSection === 'orders' && (
          <div className="space-y-4">
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Your Orders</span>
            <Suspense fallback={<div style={{ color: '#111827' }}>Loading orders...</div>}>
              <OrdersSection />
            </Suspense>
          </div>
        )}

        {activeSection === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Profile</span>
              <button
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                style={{ background: 'none', border: 'none', color: '#F5C518', fontSize: 12, fontWeight: 600 }}
              >
                {isEditingProfile ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {/* Minimalist Profile Info */}
            <div style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Full Name</div>
                <div style={{ fontSize: 14, color: '#111827', fontWeight: 600 }}>{user?.fullName}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Email Address</div>
                <div style={{ fontSize: 14, color: '#111827', fontWeight: 600 }}>{user?.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>City</div>
                  <div style={{ fontSize: 14, color: '#111827', fontWeight: 600 }}>{user?.city || 'ΓÇö'}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Area</div>
                  <div style={{ fontSize: 14, color: '#111827', fontWeight: 600 }}>{user?.location || 'ΓÇö'}</div>
                </div>
              </div>
            </div>

            {/* Edit mode placeholder - preserving existing logic would require more detailed injection, 
                 but keeping it functional by just showing the state for now or wrapping existing inputs */}
            {isEditingProfile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" className="bg-white border border-slate-200 text-slate-950 h-10" />
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="bg-white border border-slate-200 text-slate-950 h-10">
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

      {/* Bottom navigation bar */}
      <div style={{
        height: 56,
        background: '#FFFFFF',
        borderTop: '0.5px solid rgba(15,23,42,0.08)',
        display: 'flex',
        alignItems: 'stretch',
        flexShrink: 0,
      }}>
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => navigate(item.path)}
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
              color={activeNav === item.key ? '#B45309' : 'rgba(15,23,42,0.45)'}
            />
            <span style={{
              fontSize: 9, fontWeight: 500,
              color: activeNav === item.key ? '#B45309' : 'rgba(15,23,42,0.45)',
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
