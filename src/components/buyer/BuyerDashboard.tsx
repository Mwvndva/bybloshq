import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AestheticWithNone } from '@/types/components';

// Lazy load the OrdersSection component
const OrdersSection = lazy(() => import('@/components/orders/OrdersSection'));
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Heart,
  User,
  Settings,
  LogOut,
  TrendingUp,
  Package,
  Phone,
  Mail,
  Info,
  X
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateBuyerProfile } from '@/api/buyerApi';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWishlist } from '@/contexts/WishlistContext';
import { useBuyerAuth } from '@/contexts/GlobalAuthContext';
import AestheticCategories from '@/components/AestheticCategories';
import ProductGrid from '@/components/ProductGrid';
import type { Aesthetic, Product } from '@/types';
import WishlistSection from './WishlistSection';
import RefundCard from './RefundCard';
import { useBybx } from '@/contexts/BybxContext';
import BybxImporter from '@/components/BybxImporter';

// Local helper for localized integers
const formatNumber = (value: number | null | undefined) => {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return num.toLocaleString();
};

const StatsCard = ({ icon: Icon, title, value, subtitle }: {
  icon: any;
  title: string;
  value: string | number;
  subtitle: string;
}) => (
  <Card
    className="relative overflow-hidden rounded-2xl"
    style={{
      background: 'rgba(17, 17, 17, 0.7)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.6)'
    }}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 via-transparent to-yellow-600/10" />
    <CardContent className="relative p-3 sm:p-4 md:p-5">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-semibold text-gray-300 uppercase tracking-wide truncate">{title}</p>
          <p className="text-lg sm:text-xl md:text-2xl font-black text-white leading-tight">{value}</p>
          <p className="text-[10px] sm:text-xs text-gray-300 font-medium truncate">{subtitle}</p>
        </div>
        <div className="shrink-0 rounded-xl sm:rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-500 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 grid place-items-center shadow">
          <Icon className="text-white h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// Main dashboard component
function BuyerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useBuyerAuth();
  const { wishlist } = useWishlist();
  const { onFileLoaded } = useBybx();
  const [selectedAesthetic, setSelectedAesthetic] = useState<AestheticWithNone>('clothes-style');
  const [activeSection, setActiveSection] = useState<'shop' | 'wishlist' | 'orders' | 'profile'>(() => {
    // Priority 1: Navigation state
    const stateSection = (location.state as any)?.activeSection;
    if (stateSection) return stateSection;

    // Priority 2: Query parameters (useful for full page reloads)
    const queryParams = new URLSearchParams(location.search);
    const querySection = queryParams.get('section');
    if (querySection && ['shop', 'wishlist', 'orders', 'profile'].includes(querySection)) {
      return querySection as any;
    }

    return 'shop';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity, setFilterCity] = useState<string>(''); // Default to empty (all cities)
  const [filterArea, setFilterArea] = useState<string>('');
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [city, setCity] = useState<string>(user?.city || '');
  const [locationArea, setLocationArea] = useState<string>(user?.location || '');
  const [mobilePayment, setMobilePayment] = useState<string>(user?.mobilePayment || '');
  const [whatsappNumber, setWhatsappNumber] = useState<string>(user?.whatsappNumber || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Order notification state
  const [hasUnreadOrders, setHasUnreadOrders] = useState(false);
  const [lastViewedOrdersTime, setLastViewedOrdersTime] = useState<string | null>(
    localStorage.getItem('buyer_last_viewed_orders')
  );

  const isMissingLocation = !user?.city || !user?.location;

  const locationData: Record<string, string[]> = {
    'Nairobi': ['CBD', 'Westlands', 'Karen', 'Runda', 'Kileleshwa', 'Kilimani', 'Lavington', 'Parklands', 'Eastleigh', 'South B', 'South C', 'Langata', 'Kasarani', 'Embakasi', 'Ruaraka'],
    'Mombasa': ['Mombasa Island', 'Nyali', 'Bamburi', 'Kisauni', 'Changamwe', 'Likoni', 'Mtongwe', 'Tudor', 'Shanzu', 'Diani'],
    'Kisumu': ['Kisumu Central', 'Milimani', 'Mamboleo', 'Dunga', 'Kondele', 'Manyatta', 'Nyalenda'],
    'Nakuru': ['Nakuru Town', 'Lanet', 'Kaptembwa', 'Shabab', 'Free Area', 'Section 58', 'Milimani', 'Kiamunyi'],
    'Eldoret': ['Eldoret Town', 'Kapsoya', 'Langas', 'Huruma', 'Kipkaren', 'Kimumu', 'Maili Nne'],
  };

  const handleSaveProfile = async () => {
    if (!city || !locationArea) return;
    setIsSavingProfile(true);
    try {
      await updateBuyerProfile({
        city,
        location: locationArea,
        mobilePayment,
        whatsappNumber
      });
      // Update the filter city when profile is updated
      setFilterCity(city);
      window.location.reload();
    } catch (e) {
      console.error('Failed to update profile', e);
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

  // Get refund amount from user
  const refundAmount = user?.refunds || 0;

  const stats = [
    {
      icon: Heart,
      title: 'Wishlist Items',
      value: formatNumber(wishlist.length),
      subtitle: 'Saved for later'
    },
    {
      icon: TrendingUp,
      title: 'Refund Balance',
      value: `KSh ${formatNumber(refundAmount)}`,
      subtitle: 'Available refunds'
    }
  ];

  useEffect(() => {
    const originalBodyStyle = document.body.style.cssText;
    const originalHtmlStyle = document.documentElement.style.cssText;

    document.body.style.cssText = 'margin: 0; padding: 0; background-color: #000000; overflow-x: hidden;';
    document.documentElement.style.cssText = 'margin: 0; padding: 0; background-color: #000000; overflow-x: hidden;';

    return () => {
      document.body.style.cssText = originalBodyStyle;
      document.documentElement.style.cssText = originalHtmlStyle;
    };
  }, []);

  const glassStyle: React.CSSProperties = {
    background: 'rgba(17, 17, 17, 0.7)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.6)'
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header - Mobile Responsive */}
      <div className="bg-black/80 backdrop-blur-md border-b border-gray-800/50 sticky top-0 z-10 shadow-sm">
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 h-auto sm:h-20 py-3 sm:py-0">
            <Button
              variant="ghost"
              onClick={handleBackToHome}
              className="text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl px-3 py-2 font-normal w-fit self-start"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Back to Home</span>
              <span className="sm:hidden">Back</span>
            </Button>

            <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end self-start sm:self-auto w-full sm:w-auto flex-wrap">
              <div className="flex items-center gap-3 min-w-0 max-w-full sm:max-w-none">
                <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div className="min-w-0 max-w-[70vw] sm:max-w-none">
                  <h1 className="text-base sm:text-lg md:text-xl font-semibold text-white tracking-tight truncate">Buyer Dashboard</h1>
                  <p className="text-xs sm:text-sm text-gray-300 font-normal truncate">{user?.fullName || 'Buyer'}</p>
                </div>
              </div>

              {(!user?.city || !user?.location) && (
                <Badge className="bg-red-500/20 text-red-200 border border-red-500/30">
                  Add location
                </Badge>
              )}
              <div className="ml-0 sm:ml-2 shrink-0">
                <BybxImporter onFileLoaded={onFileLoaded} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        {/* Stats Overview - Mobile Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8 lg:mb-10">
          {stats.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>

        {/* Navigation Tabs - Mobile Responsive */}
        <div
          className="flex items-center gap-2 mb-6 sm:mb-8 rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 max-w-4xl mx-auto w-full overflow-x-auto sm:overflow-visible sm:justify-center"
          style={glassStyle}
        >
          {[
            { id: 'shop', label: 'Shop', icon: Package },
            { id: 'orders', label: 'Orders', icon: Package },
            { id: 'wishlist', label: 'Wishlist', icon: Heart },
            { id: 'profile', label: 'Profile', icon: User },
          ].map(({ id, label, icon: Icon }) => (
            <button
              onClick={() => {
                setActiveSection(id as any);
                // Mark orders as viewed when Orders tab is clicked
                if (id === 'orders') {
                  const now = new Date().toISOString();
                  setLastViewedOrdersTime(now);
                  localStorage.setItem('buyer_last_viewed_orders', now);
                  setHasUnreadOrders(false);
                }
              }}
              className={`relative flex items-center justify-center flex-shrink-0 space-x-2 sm:space-x-3 px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5 lg:py-3 rounded-xl sm:rounded-2xl font-semibold text-xs sm:text-sm lg:text-base transition-all duration-300 ${activeSection === id
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105'
                : 'text-gray-300 hover:text-white hover:bg-gray-800/70'
                }`}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{label}</span>

              {/* Notification Badge - Red Dot for Orders */}
              {id === 'orders' && hasUnreadOrders && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-black animate-pulse" />
              )}

              {id === 'wishlist' && wishlist.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {wishlist.length}
                </span>
              )}
              {id === 'profile' && isMissingLocation && (
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500" aria-label="Action required" />
              )}
            </button>
          ))}
        </div>

        {/* Content Sections */}
        {activeSection === 'shop' && (
          <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8" style={glassStyle}>
            <div className="mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-1.5 sm:mb-2">Discover Amazing Products</h2>
              <p className="text-gray-300 text-xs sm:text-sm lg:text-base font-normal mb-4 sm:mb-6">
                Browse through our curated collection of unique items
              </p>

              <div className="mb-6 sm:mb-8">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                  <div>
                    <Select
                      value={filterCity || '__all__'}
                      onValueChange={(val) => {
                        if (val === '__all__') {
                          setFilterCity('');
                          setFilterArea('');
                        } else {
                          setFilterCity(val);
                          setFilterArea('');
                        }
                      }}
                      defaultValue="__all__"
                    >
                      <SelectTrigger className="h-10 bg-gray-800 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400">
                        <SelectValue placeholder="City" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Cities</SelectItem>
                        {Object.keys(locationData).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Select
                      value={filterArea || '__all__'}
                      onValueChange={(val) => {
                        if (val === '__all__') setFilterArea(''); else setFilterArea(val);
                      }}
                      disabled={!filterCity}
                    >
                      <SelectTrigger className="h-10 bg-gray-800 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400">
                        <SelectValue placeholder={filterCity ? 'Area' : 'Select city first'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Areas</SelectItem>
                        {(locationData[filterCity] || []).map((a) => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Min Price"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Max Price"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                    />
                  </div>
                </div>

                <AestheticCategories
                  selectedAesthetic={selectedAesthetic}
                  onAestheticChange={handleAestheticChange}
                />

                {/* Search Bar */}
                <div className="relative mt-6">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Search products by keyword..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-4 pr-10"
                    />
                    {searchQuery ? (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300 hover:text-white focus:outline-none"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    ) : (
                      <svg
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-300"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-4 sm:mb-6">
                <p className="text-sm sm:text-base lg:text-lg font-semibold text-white">
                  {selectedAesthetic
                    ? `Showing ${selectedAesthetic} products`
                    : 'Showing all products'
                  }
                  {selectedAesthetic && (
                    <button
                      onClick={() => setSelectedAesthetic('')}
                      className="ml-2 sm:ml-4 text-yellow-400 hover:text-yellow-300 underline font-medium text-sm sm:text-base"
                    >
                      Clear filter
                    </button>
                  )}
                </p>
              </div>

              {selectedAesthetic && (
                <div className="mb-4 sm:mb-6">
                  <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm">
                    {selectedAesthetic}
                  </Badge>
                </div>
              )}
            </div>

            <ProductGrid
              selectedAesthetic={selectedAesthetic}
              searchQuery={searchQuery}
              locationCity={filterCity}
              locationArea={filterArea}
              priceMin={priceMin ? Number(priceMin) : undefined}
              priceMax={priceMax ? Number(priceMax) : undefined}
            />
          </div>
        )}

        {activeSection === 'wishlist' && (
          <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8" style={glassStyle}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 space-y-2 sm:space-y-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white">Your Wishlist</h2>
              <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base lg:text-lg self-start sm:self-auto">
                {wishlist.length} {wishlist.length === 1 ? 'item' : 'items'}
              </Badge>
            </div>
            <WishlistSection />
          </div>
        )}

        {activeSection === 'orders' && (
          <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8" style={glassStyle}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 space-y-2 sm:space-y-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white">Your Orders</h2>
            </div>
            <Suspense fallback={
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            }>
              <OrdersSection />
            </Suspense>
          </div>
        )}

        {activeSection === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <div className="space-y-6 sm:space-y-8">
              {/* Profile Card */}
              <Card className="rounded-2xl sm:rounded-3xl" style={glassStyle}>
                <CardHeader className="pb-3 sm:pb-4">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                      <User className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg sm:text-xl lg:text-2xl font-semibold text-white">Profile Information</CardTitle>
                      <p className="text-gray-300 font-normal text-sm sm:text-base">Your account details</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!isEditingProfile ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCity(user?.city || '');
                            setLocationArea(user?.location || '');
                            setMobilePayment(user?.mobilePayment || '');
                            setWhatsappNumber(user?.whatsappNumber || '');
                            setIsEditingProfile(true);
                          }}
                          className="text-sm border-gray-700 bg-transparent text-gray-200 hover:bg-gray-800 hover:text-white"
                        >
                          Edit
                        </Button>
                      ) : (
                        <>
                          <Button
                            onClick={handleSaveProfile}
                            disabled={!city || !locationArea || isSavingProfile}
                            className="text-sm bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600"
                          >
                            {isSavingProfile ? 'Saving...' : 'Save'}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setIsEditingProfile(false)}
                            className="text-sm text-gray-300 hover:text-white hover:bg-gray-800"
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    <div className="bg-gray-900/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-800">
                      <label className="text-xs sm:text-sm font-semibold text-gray-300 uppercase tracking-wide">Full Name</label>
                      <p className="text-sm sm:text-base lg:text-lg font-semibold text-white mt-1 truncate">{user?.fullName || 'Not available'}</p>
                    </div>
                    <div className="bg-gray-900/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-800">
                      <label className="text-xs sm:text-sm font-semibold text-gray-300 uppercase tracking-wide">Email</label>
                      <p className="text-sm sm:text-base lg:text-lg font-semibold text-white mt-1 truncate">{user?.email || 'Not available'}</p>
                    </div>
                    <div className="bg-gray-900/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-800">
                      <label className="text-xs sm:text-sm font-semibold text-gray-300 uppercase tracking-wide">Mobile Payment (M-Pesa)</label>
                      <p className="text-sm sm:text-base lg:text-lg font-semibold text-white mt-1 truncate">{user?.mobilePayment || 'Not available'}</p>
                    </div>
                    <div className="bg-gray-900/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-800">
                      <label className="text-xs sm:text-sm font-semibold text-gray-300 uppercase tracking-wide">WhatsApp Number</label>
                      <p className="text-sm sm:text-base lg:text-lg font-semibold text-white mt-1 truncate">{user?.whatsappNumber || 'Not available'}</p>
                    </div>
                    {!isEditingProfile ? (
                      <>
                        <div className="bg-gray-900/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-800">
                          <label className="text-xs sm:text-sm font-semibold text-gray-300 uppercase tracking-wide">City</label>
                          <p className="text-sm sm:text-base lg:text-lg font-semibold text-white mt-1 truncate">{user?.city || 'Not available'}</p>
                        </div>
                        <div className="bg-gray-900/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-800">
                          <label className="text-xs sm:text-sm font-semibold text-gray-300 uppercase tracking-wide">Location</label>
                          <p className="text-sm sm:text-base lg:text-lg font-semibold text-white mt-1 truncate">{user?.location || 'Not available'}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-gray-900/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-800">
                          <label className="text-xs sm:text-sm font-semibold text-gray-300 uppercase tracking-wide">Mobile Payment (M-Pesa)</label>
                          <div className="mt-2 text-yellow-400 font-medium text-xs flex items-center mb-1">
                            <Info className="h-3 w-3 mr-1" />
                            Used for STK Push and refunds
                          </div>
                          <Input
                            type="text"
                            value={mobilePayment}
                            onChange={(e) => setMobilePayment(e.target.value)}
                            placeholder="e.g. 0712345678"
                          />
                        </div>
                        <div className="bg-gray-900/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-800">
                          <label className="text-xs sm:text-sm font-semibold text-gray-300 uppercase tracking-wide">WhatsApp Number</label>
                          <div className="mt-2 text-yellow-400 font-medium text-xs flex items-center mb-1">
                            <Info className="h-3 w-3 mr-1" />
                            Used for order notifications
                          </div>
                          <Input
                            type="text"
                            value={whatsappNumber}
                            onChange={(e) => setWhatsappNumber(e.target.value)}
                            placeholder="e.g. 0712345678"
                          />
                        </div>
                        <div className="bg-gray-900/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-800">
                          <label className="text-xs sm:text-sm font-semibold text-gray-300 uppercase tracking-wide">City</label>
                          <div className="mt-2">
                            <Select
                              value={city}
                              onValueChange={(val) => {
                                setCity(val);
                                setLocationArea('');
                              }}
                            >
                              <SelectTrigger className="h-10 bg-gray-800 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400">
                                <SelectValue placeholder="Select your city" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.keys(locationData).map((c) => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="bg-gray-900/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-800">
                          <label className="text-xs sm:text-sm font-semibold text-gray-300 uppercase tracking-wide">Location</label>
                          <div className="mt-2">
                            <Select
                              value={locationArea}
                              onValueChange={setLocationArea}
                              disabled={!city}
                            >
                              <SelectTrigger className="h-10 bg-gray-800 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400">
                                <SelectValue placeholder={city ? 'Select your area' : 'Select city first'} />
                              </SelectTrigger>
                              <SelectContent>
                                {(locationData[city] || []).map((area) => (
                                  <SelectItem key={area} value={area}>{area}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="bg-gray-900/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-800">
                      <label className="text-xs sm:text-sm font-semibold text-gray-300 uppercase tracking-wide">Member Since</label>
                      <p className="text-sm sm:text-base lg:text-lg font-semibold text-white mt-1">
                        {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Not available'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6 sm:space-y-8">
              {/* Actions Card */}
              <Card className="rounded-2xl sm:rounded-3xl" style={glassStyle}>
                <CardHeader className="pb-3 sm:pb-4">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                      <Settings className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg sm:text-xl lg:text-2xl font-semibold text-white">Account Actions</CardTitle>
                      <p className="text-gray-300 font-normal text-sm sm:text-base">Manage your account</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={handleLogout}
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl sm:rounded-2xl py-3 sm:py-4 font-bold text-sm sm:text-base lg:text-lg shadow-lg transition-all duration-200"
                  >
                    <LogOut className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3" />
                    Sign Out
                  </Button>
                </CardContent>
              </Card>

              {/* Refund Card */}
              <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6" style={glassStyle}>
                <RefundCard refundAmount={refundAmount} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div >
  );
}

export default BuyerDashboard;
