import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
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
  ChevronLeft, ChevronRight, LogOut,
  Search, Home, Heart, ShoppingCart, User,
  Users, Store, Package, ShoppingBag, Info, X
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

import { ShopCard } from '@/components/ui/ShopCard';



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
  const [shops, setShops] = useState<any[]>([]);
  const [shopsSearchQuery, setShopsSearchQuery] = useState('');
  const [isLoadingShops, setIsLoadingShops] = useState(false);

  const fetchShops = useCallback(async () => {
    setIsLoadingShops(true);
    try {
      const fetchedShops = await buyerApi.getShops();
      setShops(fetchedShops);
    } catch (error) {
      console.error('Error fetching shops:', error);
    } finally {
      setIsLoadingShops(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'shops') {
      fetchShops();
    }
  }, [activeSection, fetchShops]);

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

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleAestheticChange = (aesthetic: Aesthetic) => {
    setSelectedAesthetic(aesthetic);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Get refund amount from user - Parse as float to ensure it's a number
  const refundAmount = typeof user?.refunds === 'string' ? parseFloat(user.refunds) : (user?.refunds || 0);




  const handleOpenShop = (shop) => {
    navigate(`/buyer/shop/${encodeURIComponent(shop.shopName || shop.name)}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* Page Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="unified-container flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackToHome}
              className="text-white/60 hover:text-white -ml-2"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-black uppercase tracking-tight text-white">
              {activeSection === 'shop' ? 'Marketplace' :
                activeSection === 'shops' ? 'My Shops' :
                  activeSection === 'orders' ? 'Orders' :
                    activeSection === 'wishlist' ? 'Wishlist' : 'Profile'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {activeSection === 'orders' && (
              <Button variant="link" onClick={() => navigate('/buyer/orders/history')} className="text-yellow-400 text-xs font-bold">
                History
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="rounded-full border-white/10 text-[10px] h-8"
            >
              <LogOut className="h-3 w-3 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Content Section */}
      <main className="flex-1 overflow-x-hidden">
        <div className="unified-container py-6 space-y-8 pb-24">

          {/* Main Marketplace */}
          {activeSection === 'shop' && (
            <div className="space-y-10 animate-fade-in">
              {/* Search & Filter Header */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white">Discovery</h2>
                  <p className="text-xs text-white/40">Explore shops and products</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    placeholder="Search marketplace..."
                    className="pl-10 h-10 bg-white/5 border-white/5 text-white placeholder:text-white/20 rounded-xl focus:ring-yellow-400/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Aesthetic Filter Chips */}
              <AestheticCategories
                selectedAesthetic={selectedAesthetic}
                onAestheticChange={handleAestheticChange}
              />

              {/* Discovery Grid */}
              <ProductGrid
                selectedAesthetic={selectedAesthetic}
                searchQuery={searchQuery}
                locationCity={filterCity}
                locationArea={filterArea}
                priceMin={priceMin ? Number(priceMin) : undefined}
                priceMax={priceMax ? Number(priceMax) : undefined}
              />

              {/* All Participating Shops */}
              <section className="space-y-6 pt-6 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white">Participating Sellers</h2>
                  <span className="text-[10px] text-white/20 uppercase font-black tracking-widest">{shops.length} Active</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {shops.map(shop => (
                    <ShopCard key={shop.id} shop={shop} onOpen={handleOpenShop} />
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* Subscribed Shops */}
          {activeSection === 'shops' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-400/10 rounded-lg">
                  <Store className="h-5 w-5 text-yellow-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Subscriptions</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {shops.length > 0 ? (
                  shops.map(shop => (
                    <ShopCard key={shop.id} shop={shop} onOpen={handleOpenShop} featured />
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center text-white/20">
                    You haven't followed any shops yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Wishlist */}
          {activeSection === 'wishlist' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Wishlist</h2>
                <span className="text-sm text-white/40">{wishlist.length} Items</span>
              </div>
              <WishlistSection />
            </div>
          )}

          {/* Orders */}
          {activeSection === 'orders' && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-2xl font-bold text-white">Active Orders</h2>
              <Suspense fallback={<div className="py-20 text-center text-white/20">Syncing with blockchain...</div>}>
                <OrdersSection />
              </Suspense>
            </div>
          )}

          {/* Profile */}
          {activeSection === 'profile' && (
            <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Profile</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 font-bold"
                >
                  {isEditingProfile ? 'Cancel' : 'Edit Info'}
                </Button>
              </div>

              <Card className="unified-card p-6 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-white/20 tracking-widest">Identify</label>
                    <p className="text-base font-bold text-white">{user?.fullName}</p>
                    <p className="text-sm text-white/40">{user?.email}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-white/20 tracking-widest">Base</label>
                    <p className="text-base font-bold text-white">{user?.city || '—'}</p>
                    <p className="text-sm text-white/40">{user?.location || '—'}</p>
                  </div>
                </div>

                {isEditingProfile && (
                  <div className="pt-8 border-t border-white/5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        placeholder="Full Name"
                        className="bg-white/5 border-white/10 rounded-xl h-12"
                      />
                      <Select value={city} onValueChange={setCity}>
                        <SelectTrigger className="bg-white/5 border-white/10 rounded-xl h-12">
                          <SelectValue placeholder="City" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(locationData).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black h-12 rounded-xl shadow-lg shadow-yellow-400/10"
                    >
                      {isSavingProfile ? 'Syncing...' : 'Save Profile Update'}
                    </Button>
                  </div>
                )}
              </Card>

              <RefundCard refundAmount={user?.refunds || 0} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default BuyerDashboard;
