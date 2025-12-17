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
  X
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateBuyerProfile } from '@/api/buyerApi';
import { useNavigate } from 'react-router-dom';
import { useWishlist } from '@/contexts/WishlistContext';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import AestheticCategories from '@/components/AestheticCategories';
import ProductGrid from '@/components/ProductGrid';
import type { Aesthetic, Product } from '@/types';
import WishlistSection from './WishlistSection';
import RefundCard from './RefundCard';

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
  <Card className="relative overflow-hidden border-0 shadow hover:shadow-lg transition-all duration-300 rounded-2xl">
    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 via-transparent to-yellow-600/10" />
    <CardContent className="relative p-3 sm:p-4 md:p-5">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs md:text-sm font-semibold text-gray-600 uppercase tracking-wide truncate">{title}</p>
          <p className="text-xl sm:text-2xl md:text-3xl font-black text-black leading-tight">{value}</p>
          <p className="text-[10px] sm:text-xs md:text-sm text-gray-500 font-medium truncate">{subtitle}</p>
        </div>
        <div className="shrink-0 rounded-xl sm:rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-500 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 grid place-items-center shadow">
          <Icon className="text-white h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// Main dashboard component
function BuyerDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useBuyerAuth();
  const { wishlist } = useWishlist();
  const [selectedAesthetic, setSelectedAesthetic] = useState<AestheticWithNone>('clothes-style');
  const [activeSection, setActiveSection] = useState<'shop' | 'wishlist' | 'orders' | 'profile'>('shop');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity, setFilterCity] = useState<string>(''); // Default to empty (all cities)
  const [filterArea, setFilterArea] = useState<string>('');
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [city, setCity] = useState<string>(user?.city || '');
  const [locationArea, setLocationArea] = useState<string>(user?.location || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

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
      await updateBuyerProfile({ city, location: locationArea });
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

  const stats = [
    // Removed wishlist stats card - will show count on tab instead
  ];

  // Get refund amount from user
  const refundAmount = user?.refunds || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header - Mobile Responsive */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between py-3 sm:py-4 lg:h-20">
            {/* Mobile: Stack vertically, Desktop: Horizontal */}
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 lg:space-x-6">
              <Button 
                variant="ghost" 
                onClick={handleBackToHome}
                className="text-gray-600 hover:text-black hover:bg-gray-100 rounded-xl sm:rounded-2xl px-2 sm:px-4 py-1.5 sm:py-2 font-semibold transition-all duration-200 text-sm sm:text-base self-start"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Back to Home</span>
                <span className="sm:hidden">Back</span>
              </Button>
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-black truncate">Welcome back!</h1>
                  <p className="text-sm sm:text-base text-gray-600 font-medium truncate">{user?.fullName || 'Buyer'}</p>
                </div>
                {(!user?.city || !user?.location) && (
                  <span className="ml-2 inline-flex items-center text-xs text-red-600 font-medium">
                    Please add your city and location
                  </span>
                )}
              </div>
            </div>
            
            {/* Header logout button removed as requested */}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 lg:py-12 lg:px-8">
        {/* Stats Overview - Mobile Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8 lg:mb-12">
          {stats.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>

        {/* Navigation Tabs - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-2 mb-6 sm:mb-8 bg-white/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 shadow-lg border border-gray-200/50 max-w-4xl mx-auto w-full">
          {[
            { id: 'shop', label: 'Shop', icon: Package },
            { id: 'orders', label: 'Orders', icon: Package },
            { id: 'wishlist', label: 'Wishlist', icon: Heart },
            { id: 'profile', label: 'Profile', icon: User },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id as any)}
              className={`relative flex items-center justify-center space-x-2 sm:space-x-3 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 lg:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base lg:text-lg transition-all duration-300 ${
                activeSection === id
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105'
                  : 'text-gray-600 hover:text-black hover:bg-white/80'
              }`}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{label}</span>
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
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-lg border border-gray-200/50">
            <div className="mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-black mb-2 sm:mb-4">Discover Amazing Products</h2>
              <p className="text-gray-600 text-sm sm:text-base lg:text-lg font-medium mb-6 sm:mb-8">
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
                      <SelectTrigger className="h-10">
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
                      <SelectTrigger className="h-10">
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
                    <input
                      type="number"
                      min={0}
                      placeholder="Min Price"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      min={0}
                      placeholder="Max Price"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
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
                    <input
                      type="text"
                      placeholder="Search products by keyword..."
                      className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition-all duration-200"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery ? (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    ) : (
                      <svg
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
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
                <p className="text-sm sm:text-base lg:text-lg font-bold text-black">
                  {selectedAesthetic 
                    ? `Showing ${selectedAesthetic} products` 
                    : 'Showing all products'
                  }
                  {selectedAesthetic && (
                    <button 
                      onClick={() => setSelectedAesthetic('')}
                      className="ml-2 sm:ml-4 text-yellow-600 hover:text-yellow-700 underline font-medium text-sm sm:text-base"
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
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-lg border border-gray-200/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 space-y-2 sm:space-y-0">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-black">Your Wishlist</h2>
              <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base lg:text-lg self-start sm:self-auto">
                {wishlist.length} {wishlist.length === 1 ? 'item' : 'items'}
              </Badge>
            </div>
            <WishlistSection />
          </div>
        )}

        {activeSection === 'orders' && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-lg border border-gray-200/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 space-y-2 sm:space-y-0">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-black">Your Orders</h2>
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
              <Card className="bg-gradient-to-br from-white to-gray-50 border-0 shadow-lg">
                <CardHeader className="pb-3 sm:pb-4">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                      <User className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg sm:text-xl lg:text-2xl font-black text-black">Profile Information</CardTitle>
                      <p className="text-gray-600 font-medium text-sm sm:text-base">Your account details</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!isEditingProfile ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCity(user?.city || '');
                            setLocationArea(user?.location || '');
                            setIsEditingProfile(true);
                          }}
                          className="text-sm"
                        >
                          Edit
                        </Button>
                      ) : (
                        <>
                          <Button
                            onClick={handleSaveProfile}
                            disabled={!city || !locationArea || isSavingProfile}
                            className="text-sm"
                          >
                            {isSavingProfile ? 'Saving...' : 'Save'}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setIsEditingProfile(false)}
                            className="text-sm"
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
                    <div className="bg-white/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-200/50">
                      <label className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wide">Full Name</label>
                      <p className="text-sm sm:text-base lg:text-lg font-bold text-black mt-1 truncate">{user?.fullName || 'Not available'}</p>
                    </div>
                    <div className="bg-white/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-200/50">
                      <label className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wide">Email</label>
                      <p className="text-sm sm:text-base lg:text-lg font-bold text-black mt-1 truncate">{user?.email || 'Not available'}</p>
                    </div>
                    <div className="bg-white/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-200/50">
                      <label className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wide">Phone</label>
                      <p className="text-sm sm:text-base lg:text-lg font-bold text-black mt-1 truncate">{user?.phone || 'Not available'}</p>
                    </div>
                    {!isEditingProfile ? (
                      <>
                        <div className="bg-white/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-200/50">
                          <label className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wide">City</label>
                          <p className="text-sm sm:text-base lg:text-lg font-bold text-black mt-1 truncate">{user?.city || 'Not available'}</p>
                        </div>
                        <div className="bg-white/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-200/50">
                          <label className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wide">Location</label>
                          <p className="text-sm sm:text-base lg:text-lg font-bold text-black mt-1 truncate">{user?.location || 'Not available'}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-white/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-200/50">
                          <label className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wide">City</label>
                          <div className="mt-2">
                            <Select
                              value={city}
                              onValueChange={(val) => {
                                setCity(val);
                                setLocationArea('');
                              }}
                            >
                              <SelectTrigger className="h-10">
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
                        <div className="bg-white/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-200/50">
                          <label className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wide">Location</label>
                          <div className="mt-2">
                            <Select
                              value={locationArea}
                              onValueChange={setLocationArea}
                              disabled={!city}
                            >
                              <SelectTrigger className="h-10">
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
                    <div className="bg-white/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-200/50">
                      <label className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wide">Member Since</label>
                      <p className="text-sm sm:text-base lg:text-lg font-bold text-black mt-1">
                        {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Not available'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="space-y-6 sm:space-y-8">
              {/* Actions Card */}
              <Card className="bg-gradient-to-br from-white to-gray-50 border-0 shadow-lg">
                <CardHeader className="pb-3 sm:pb-4">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                      <Settings className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg sm:text-xl lg:text-2xl font-black text-black">Account Actions</CardTitle>
                      <p className="text-gray-600 font-medium text-sm sm:text-base">Manage your account</p>
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
              <RefundCard refundAmount={refundAmount} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BuyerDashboard;
