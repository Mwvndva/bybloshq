import { useState, useEffect } from 'react';
import { AestheticWithNone } from '@/types/components';
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
import { useNavigate } from 'react-router-dom';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useWishlist } from '@/contexts/WishlistContext';
import AestheticCategories from '@/components/AestheticCategories';
import ProductGrid from '@/components/ProductGrid';
import type { Aesthetic, Product } from '@/types';

const WishlistSection = () => {
  const { wishlist, removeFromWishlist } = useWishlist();
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const handleImageClick = (product: Product) => {
    setSelectedProduct(product);
    setIsImageDialogOpen(true);
  };

  if (wishlist.length === 0) {
    return (
      <div className="text-center py-12 sm:py-16 lg:py-20">
        <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mx-auto mb-6 sm:mb-8 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-lg">
          <Heart className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-yellow-600" />
        </div>
        <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-black mb-2 sm:mb-3">Your wishlist is empty</h3>
        <p className="text-gray-600 text-sm sm:text-base lg:text-lg font-medium max-w-md mx-auto px-4">Start adding items you love to your wishlist and they'll appear here</p>
      </div>
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
      {wishlist.map((product, index) => {
        const displaySeller = product.seller;
        const displaySellerName = displaySeller?.fullName || 'Unknown Seller';
        const hasContactInfo = Boolean(displaySeller?.phone || displaySeller?.email);

        return (
          <Card key={`wishlist-${product.id}-${index}`} className="group hover:shadow-2xl transition-all duration-500 border-0 bg-white/80 backdrop-blur-sm transform hover:-translate-y-2">
            <div className="relative overflow-hidden rounded-t-xl sm:rounded-t-2xl">
            <img 
              src={product.image_url} 
              alt={product.name} 
                className="w-full h-40 sm:h-48 lg:h-56 object-cover group-hover:scale-110 transition-transform duration-500"
            />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Image click handler */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleImageClick(product);
              }}
              className="absolute inset-0 w-full h-full bg-transparent cursor-pointer"
              aria-label="View full size image"
            />
            
            <Button
              variant="ghost"
              size="icon"
                className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-white/90 hover:bg-white rounded-xl sm:rounded-2xl h-8 w-8 sm:h-10 sm:w-10 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-110 z-10"
              onClick={() => removeFromWishlist(product.id)}
            >
                <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 fill-current" />
            </Button>
          </div>
            <CardContent className="p-4 sm:p-6">
              <h3 className="font-bold text-black mb-2 line-clamp-1 text-sm sm:text-base lg:text-lg">{product.name}</h3>
              <p className="text-yellow-600 font-black text-lg sm:text-xl mb-2 sm:mb-3">
              KSh {product.price.toLocaleString()}
            </p>
              <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 leading-relaxed mb-3 sm:mb-4">
              {product.description}
            </p>
              
              {/* Contact Button */}
              {hasContactInfo && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-blue-200 text-blue-700 hover:text-blue-800 rounded-lg sm:rounded-xl font-semibold transition-all duration-200 text-xs sm:text-sm py-2"
                    >
                      <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Contact Seller
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md mx-4">
                    <DialogHeader>
                      <DialogTitle className="flex items-center space-x-2 text-sm sm:text-base">
                        <User className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="truncate">Contact {displaySellerName}</span>
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 sm:space-y-4">
                      {displaySeller?.phone && (
                        <div className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
                          <Phone className="h-4 w-4 text-gray-600 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-medium text-gray-900">Phone</p>
                            <a 
                              href={`tel:${displaySeller.phone}`}
                              className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 transition-colors break-all"
                            >
                              {displaySeller.phone}
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {displaySeller?.email && (
                        <div className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
                          <Mail className="h-4 w-4 text-gray-600 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-medium text-gray-900">Email</p>
                            <a 
                              href={`mailto:${displaySeller.email}`}
                              className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 transition-colors break-all"
                            >
                              {displaySeller.email}
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
          </CardContent>
        </Card>
        );
      })}
    </div>

    {/* Image Dialog */}
    <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
      <DialogContent className="sm:max-w-4xl mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-sm sm:text-base">
            <span className="truncate pr-2">{selectedProduct?.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsImageDialogOpen(false)}
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="flex justify-center">
          <img
            src={selectedProduct?.image_url || '/placeholder-image.jpg'}
            alt={selectedProduct?.name}
            className="max-w-full max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh] object-contain rounded-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
};

const StatsCard = ({ icon: Icon, title, value, subtitle }: {
  icon: any;
  title: string;
  value: string | number;
  subtitle: string;
}) => (
  <Card className="bg-gradient-to-br from-white to-gray-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
    <CardContent className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1 sm:space-y-2 min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wide truncate">{title}</p>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-black">{value}</p>
          <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">{subtitle}</p>
        </div>
        <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0 ml-2">
          <Icon className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export function BuyerDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useBuyerAuth();
  const { wishlist } = useWishlist();
  const [selectedAesthetic, setSelectedAesthetic] = useState<AestheticWithNone>('');
  const [activeSection, setActiveSection] = useState<'shop' | 'wishlist' | 'profile'>('shop');
  const [searchQuery, setSearchQuery] = useState('');

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
    {
      icon: Heart,
      title: 'Wishlist Items',
      value: wishlist.length,
      subtitle: 'Items saved'
    }
  ];

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
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl sm:rounded-2xl px-2 sm:px-4 py-1.5 sm:py-2 font-semibold transition-all duration-200 text-sm sm:text-base"
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
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
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mb-6 sm:mb-8 bg-white/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 shadow-lg border border-gray-200/50">
          {[
            { id: 'shop', label: 'Shop', icon: Package },
            { id: 'wishlist', label: 'Wishlist', icon: Heart },
            { id: 'profile', label: 'Profile', icon: User },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id as any)}
              className={`flex items-center justify-center space-x-2 sm:space-x-3 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 lg:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base lg:text-lg transition-all duration-300 ${
                activeSection === id
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105'
                  : 'text-gray-600 hover:text-black hover:bg-white/80'
              }`}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{label}</span>
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
                <AestheticCategories 
                  selectedAesthetic={selectedAesthetic} 
                  onAestheticChange={handleAestheticChange} 
                />
                
                {/* Search Bar */}
                <div className="mt-4 relative">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}