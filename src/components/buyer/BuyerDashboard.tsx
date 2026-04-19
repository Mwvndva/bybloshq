
import { useState, useEffect, useCallback, lazy, Suspense, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

// Lazy load sections
const OrdersSection = lazy(() => import('@/components/orders/OrdersSection'));
const WishlistSection = lazy(() => import('./WishlistSection'));
import {
  ChevronLeft, Search, Home, Heart, Package, User, Store, LogOut
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import buyerApi from '@/api/buyerApi';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWishlist } from '@/contexts/WishlistContext';
import { useBuyerAuth } from '@/contexts/GlobalAuthContext';
import SellersGrid from '@/components/SellersGrid';
import SellerBrandCard from '@/components/SellerBrandCard';
import RefundCard from './RefundCard';

function BuyerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, updateBuyerProfile } = useBuyerAuth();
  const { wishlist } = useWishlist();
  const { toast } = useToast();

  // Route-driven section mapping - Source of Truth: URL
  const activeSection = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/buyer/orders')) return 'orders';
    if (path.includes('/buyer/shops')) return 'shops';
    if (path.includes('/buyer/wishlist')) return 'wishlist';
    if (path.includes('/buyer/profile')) return 'profile';
    return 'shop'; // Default for /buyer/dashboard
  }, [location.pathname]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity, setFilterCity] = useState<string>('');
  const [filterArea, setFilterArea] = useState<string>('');

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState<string>(user?.fullName || '');
  const [city, setCity] = useState<string>(user?.city || '');
  const [locationArea, setLocationArea] = useState<string>(user?.location || '');
  const [mobilePayment, setMobilePayment] = useState<string>(user?.mobilePayment || '');
  const [whatsappNumber, setWhatsappNumber] = useState<string>(user?.whatsappNumber || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Shop state for "My Shops" tab
  const [shops, setShops] = useState<any[]>([]);
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
    if (activeSection === 'shops') fetchShops();
  }, [activeSection, fetchShops]);

  // Orders notification state
  const [hasUnreadOrders, setHasUnreadOrders] = useState(false);
  const lastViewedOrdersTime = localStorage.getItem('buyer_last_viewed_orders');

  useEffect(() => {
    const checkForOrderUpdates = async () => {
      try {
        const orders = await buyerApi.getOrders();
        if (orders.length > 0) {
          const latestUpdateTime = Math.max(
            ...orders.map(order => Math.max(new Date(order.createdAt).getTime(), order.updatedAt ? new Date(order.updatedAt).getTime() : 0))
          );
          const lastViewed = lastViewedOrdersTime ? new Date(lastViewedOrdersTime).getTime() : 0;
          setHasUnreadOrders(latestUpdateTime > lastViewed);
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    };
    if (user) checkForOrderUpdates();
  }, [user, lastViewedOrdersTime]);

  const handleSaveProfile = async () => {
    if (!fullName || !city || !locationArea) {
      toast({ title: "Missing Information", description: "Full name, city, and location are required.", variant: "destructive" });
      return;
    }
    setIsSavingProfile(true);
    try {
      await updateBuyerProfile({ fullName, city, location: locationArea, mobilePayment, whatsappNumber });
      toast({ title: "Profile Updated", description: "Your profile information has been saved successfully." });
      setFilterCity(city);
      setIsEditingProfile(false);
    } catch (error) {
      toast({ title: "Update Failed", description: "Check your connection and try again.", variant: "destructive" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const navItems = [
    { key: 'home', label: 'Home', Icon: Home, path: '/' },
    { key: 'shop', label: 'Shop', Icon: Store, path: '/buyer/dashboard' },
    { key: 'wishlist', label: 'Wishlist', Icon: Heart, path: '/buyer/wishlist' },
    { key: 'orders', label: 'Orders', Icon: Package, path: '/buyer/orders', badge: hasUnreadOrders },
    { key: 'profile', label: 'Profile', Icon: User, path: '/buyer/profile' },
  ];

  const handleOpenShop = (shop) => {
    navigate(`/buyer/shop/${encodeURIComponent(shop.shopName || shop.name)}`);
  };

  const locationData: Record<string, string[]> = {
    'Nairobi': ['CBD', 'Westlands', 'Karen', 'Runda', 'Kileleshwa', 'Kilimani', 'Lavington', 'Parklands', 'Eastleigh', 'South B', 'South C', 'Langata', 'Kasarani', 'Embakasi', 'Ruaraka'],
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0A0A0A] text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-3 pb-2 shrink-0">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-white/40 text-xs font-medium py-1">
          <ChevronLeft size={16} /> Back
        </button>
        <h1 className="text-base font-bold tracking-tight">Discover</h1>
        <button onClick={() => { logout(); navigate('/'); }} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40">
          <LogOut size={14} />
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto px-5 pb-24 max-w-screen-md mx-auto w-full scroll-smooth">

        {/* Unified Search Bar - Source of Truth */}
        {activeSection !== 'profile' && (
          <div className="mt-2 mb-4">
            <div className="flex items-center gap-3 bg-[#141414] rounded-xl px-4 h-11 border border-white/5 focus-within:border-yellow-500/30 transition-colors">
              <Search size={16} className="text-white/30" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={
                  activeSection === 'shop' ? "Search products or style..." :
                    activeSection === 'shops' ? "Filter followed shops..." :
                      activeSection === 'wishlist' ? "Search your wishlist..." : "Search orders..."
                }
                className="flex-1 bg-transparent border-none outline-none text-[14px] text-white placeholder:text-white/20"
              />
            </div>
          </div>
        )}

        {/* Section Views */}
        <div className="space-y-6">
          {activeSection === 'shop' && (
            <SellersGrid filterCity={filterCity} filterArea={filterArea} searchQuery={searchQuery} isBuyer={true} />
          )}

          {activeSection === 'shops' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest text-[10px]">Followed Shops</h2>
                <span className="text-[10px] font-bold text-white/20 bg-white/5 px-2 py-0.5 rounded-full">{shops.length} Total</span>
              </div>

              {(() => {
                const filteredShops = shops.filter(shop =>
                  (shop.shopName || shop.shop_name || '').toLowerCase().includes(searchQuery.toLowerCase())
                );

                if (filteredShops.length === 0 && searchQuery) {
                  return (
                    <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-sm text-white/30">No shops matching "{searchQuery}"</p>
                    </div>
                  );
                }

                return filteredShops.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {/* Featured Item (First) - Using Unified Component */}
                    <div className="space-y-2">
                      <SellerBrandCard seller={filteredShops[0]} variant="horizontal" isBuyer={true} className="border border-white/5 shadow-sm" />
                    </div>

                    {/* Remaining Shops */}
                    <div className="grid grid-cols-2 gap-3">
                      {filteredShops.slice(1).map(shop => (
                        <SellerBrandCard key={shop.id} seller={shop} variant="slim" isBuyer={true} className="border border-white/5" />
                      ))}
                    </div>
                  </div>
                ) : (
                  !isLoadingShops && (
                    <div className="text-center py-20">
                      <Store size={48} className="mx-auto text-white/5 mb-4" />
                      <p className="text-sm text-white/30 font-medium">No shops followed yet</p>
                    </div>
                  )
                );
              })()}
            </div>
          )}

          {activeSection === 'wishlist' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest text-[10px]">Your Wishlist</h2>
                <span className="text-[10px] font-bold text-white/20 bg-white/5 px-2 py-0.5 rounded-full">{wishlist.length} Items</span>
              </div>
              <Suspense fallback={<div className="h-40 flex items-center justify-center font-bold text-white/10 italic">Loading...</div>}>
                <WishlistSection searchQuery={searchQuery} />
              </Suspense>
            </div>
          )}

          {activeSection === 'orders' && (
            <div className="space-y-5">
              <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest text-[10px]">Purchase History</h2>
              <Suspense fallback={<div className="h-40 flex items-center justify-center font-bold text-white/10 italic">Loading...</div>}>
                <OrdersSection searchQuery={searchQuery} />
              </Suspense>
            </div>
          )}

          {activeSection === 'profile' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest text-[10px]">Account Profile</h2>
                <button onClick={() => setIsEditingProfile(!isEditingProfile)} className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">
                  {isEditingProfile ? 'Cancel' : 'Edit Info'}
                </button>
              </div>

              <div className="bg-[#141414] rounded-2xl p-5 space-y-4 border border-white/5 shadow-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/30 tracking-tight">Full Name</label>
                    <p className="text-sm font-bold truncate">{user?.fullName}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] uppercase font-bold text-white/30 tracking-tight">Wallet Balance</label>
                    <p className="text-sm font-black text-emerald-500">KES {(user?.refunds || 0).toLocaleString()}</p>
                  </div>
                </div>
                <div className="h-[1px] bg-white/5 w-full" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/30 tracking-tight">Current Location</label>
                    <p className="text-xs font-medium text-white/60">{user?.city}, {user?.location || '—'}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] uppercase font-bold text-white/30 tracking-tight">Account ID</label>
                    <p className="text-[9px] font-mono text-white/20">#{String(user?.id).slice(-8)}</p>
                  </div>
                </div>
              </div>

              {isEditingProfile && (
                <div className="space-y-3 p-5 bg-[#141414] rounded-2xl border border-yellow-500/10 animate-in fade-in zoom-in-95 duration-200">
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" className="bg-black/20 border-white/5 text-sm h-11" />
                  <Select value={city} onValueChange={setCity}>
                    <SelectTrigger className="bg-black/20 border-white/5 text-sm h-11">
                      <SelectValue placeholder="City" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1C1C1C] border-none text-white shadow-2xl">
                      {Object.keys(locationData).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black h-12 rounded-xl transition-all">
                    {isSavingProfile ? 'Saving...' : 'Update Profile'}
                  </Button>
                </div>
              )}

              <RefundCard refundAmount={user?.refunds || 0} />
            </div>
          )}
        </div>
      </main>

      {/* Optimized Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-[72px] bg-[#0A0A0A]/80 backdrop-blur-xl border-t border-white/5 px-6 flex items-center justify-between pb-safe z-50">
        {navItems.map(item => {
          const isActive = activeSection === item.key || (item.key === 'home' && location.pathname === '/');
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1.5 transition-all relative ${isActive ? 'scale-110' : 'opacity-30 hover:opacity-80'}`}
            >
              <item.Icon size={20} className={isActive ? 'text-yellow-500' : 'text-white'} />
              <span className={`text-[9px] font-black uppercase tracking-[0.1em] ${isActive ? 'text-yellow-500' : 'text-white'}`}>
                {item.key === 'shop' ? 'Shop' : item.label}
              </span>
              {item.badge && (
                <div className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-[#0A0A0A]" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default BuyerDashboard;
