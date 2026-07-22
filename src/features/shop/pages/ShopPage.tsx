import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, Store, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductCard } from '@/components/ProductCard';
import type { Product, Seller } from '@/types';
import { type Theme } from '@/hooks/useShopTheme';
import { isAesthetic } from './shopPage.shared';
import { useShopPage } from './useShopPage';
import { ShopHero } from './ShopHero';
import { ShopPageThemePicker } from './ShopPageThemePicker';

const ShopPage = () => {
  const {
    sellerInfo,
    themeClasses,
    shopPageTheme,
    setShopPageTheme,
    resolvedShopTheme,
    products,
    filteredProducts,
    searchQuery,
    setSearchQuery,
    bannerLoadFailed,
    setBannerLoadFailed,
    avatarLoadFailed,
    setAvatarLoadFailed,
    sellerInitials,
    showSellerAvatar,
    isLoading,
    error,
    isAuthenticated,
  } = useShopPage();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
            <Loader2 className="h-12 w-12 text-yellow-600 animate-spin" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-black mb-3">Loading Shop</h3>
            <p className="text-gray-600 text-lg font-medium">Please wait while we fetch the shop details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-100 to-red-200 rounded-3xl flex items-center justify-center shadow-lg">
            <Store className="h-12 w-12 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-black mb-3">Error Loading Shop</h2>
            <p className="text-gray-600 text-lg font-medium mb-6">{error}</p>
            <Button
              asChild
              className="bg-yellow-300 hover:bg-yellow-400 text-black shadow-lg px-8 py-3 rounded-xl font-semibold transition-colors duration-200"
            >
              <Link to="/">Return to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="shop-page-root min-h-screen transition-colors duration-300"
      data-shop-theme={resolvedShopTheme}
    >
      {/* Light/Dark/System theme picker — top-right, small, no border touching */}
      <ShopPageThemePicker theme={shopPageTheme} onThemeChange={setShopPageTheme} />
      <ShopHero
        sellerInfo={sellerInfo}
        bannerLoadFailed={bannerLoadFailed}
        setBannerLoadFailed={setBannerLoadFailed}
        showSellerAvatar={showSellerAvatar}
        setAvatarLoadFailed={setAvatarLoadFailed}
        sellerInitials={sellerInitials}
      />
      {/* Products */}
      <main className="max-w-[1920px] mx-auto px-3 sm:px-6 pt-12 pb-6 sm:pt-20 sm:pb-8 lg:px-8">
        <div className="mb-8">
          <div className="relative max-w-md mx-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className={`h-5 w-5 ${themeClasses.textColor === 'text-white' ? 'text-white/70' : 'text-gray-300'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              className={cn(
                "block w-full pl-10 pr-3 py-3 border border-[var(--theme-border)] rounded-2xl transition-all duration-300",
                "bg-[var(--theme-card-bg)] text-[var(--theme-text)] placeholder:text-[var(--theme-text)]/50",
                "focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/50 focus:border-[var(--theme-accent)] shadow-xl"
              )}
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {filteredProducts.length > 0 ? (
          <div className={cn(
            "shop-products-card backdrop-blur-md rounded-[2.5rem] p-5 sm:p-10 shadow-2xl border transition-all duration-500",
            themeClasses.cardBg,
            themeClasses.borderColor,
            "shadow-[var(--theme-accent)]/5"
          )}>
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <div className="min-w-0 flex-1">
                <h2 className={`text-lg sm:text-2xl font-black ${themeClasses.textColor} truncate`}>
                  Available Products
                </h2>
                <p className={`${themeClasses.textColor === 'text-white' ? 'text-white/80' : 'text-gray-600'} text-[10px] sm:text-sm font-medium mt-1 truncate`}>
                  {products.length} {products.length === 1 ? 'item' : 'items'} available
                </p>
              </div>
              <div className={`${themeClasses.buttonGradient} text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg font-bold text-[10px] sm:text-xs shrink-0 ml-2`}>
                {products.length} Items
              </div>
            </div>
            <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {filteredProducts.map((product) => {
                // Ensure the product has the seller info from the shop
                const productWithSeller: Product & { seller?: Seller; isSold?: boolean; } = {
                  ...product,
                  aesthetic: isAesthetic(product.aesthetic) ? product.aesthetic : 'all',
                  seller: sellerInfo ? {
                    id: sellerInfo.id,
                    fullName: sellerInfo.fullName || '',
                    email: sellerInfo.email || '',
                    phone: sellerInfo.phone || '',
                    whatsappNumber: sellerInfo.whatsappNumber || sellerInfo.phone || '',
                    shopName: sellerInfo.shopName || '',
                    bannerUrl: sellerInfo.bannerImage || '',
                    location: sellerInfo.location || '',
                    // New physical shop fields
                    hasPhysicalShop: !!sellerInfo.physicalAddress,
                    physicalAddress: sellerInfo.physicalAddress,
                    latitude: sellerInfo.latitude,
                    longitude: sellerInfo.longitude,
                    // Add any other required fields from Seller interface with defaults
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  } : undefined
                };

                // Create a properly typed seller object that matches the Seller interface
                const sellerForCard: Seller | undefined = sellerInfo ? {
                  id: sellerInfo.id,
                  fullName: sellerInfo.fullName || '',
                  email: sellerInfo.email || '',
                  phone: sellerInfo.phone || '',
                  whatsappNumber: sellerInfo.whatsappNumber || sellerInfo.phone || '',
                  shopName: sellerInfo.shopName || '',
                  bannerUrl: sellerInfo.bannerImage || '',
                  location: sellerInfo.location || '',
                  city: sellerInfo.city || '',
                  // New physical shop fields
                  hasPhysicalShop: !!sellerInfo.physicalAddress,
                  physicalAddress: sellerInfo.physicalAddress,
                  latitude: sellerInfo.latitude,
                  longitude: sellerInfo.longitude,
                  createdAt: sellerInfo.createdAt || new Date().toISOString(),
                  updatedAt: sellerInfo.updatedAt || new Date().toISOString(),
                  theme: sellerInfo.theme,
                  // Optional fields with defaults
                  bio: sellerInfo.bio,
                  avatarUrl: sellerInfo.avatarUrl,
                  website: sellerInfo.website,
                  socialMedia: sellerInfo.socialMedia
                } : undefined;

                return (
                  <div key={product.id}>
                    <ProductCard
                      product={productWithSeller}
                      seller={sellerForCard}
                      hideWishlist={!isAuthenticated}
                      theme={sellerInfo?.theme as Theme}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={`text-center py-16 ${themeClasses.cardBg} backdrop-blur-sm rounded-3xl p-8 shadow-lg border ${themeClasses.borderColor}/50`}>
            <Package className={`h-16 w-16 mx-auto ${themeClasses.textColor === 'text-white' ? 'text-white/60' : 'text-gray-300'
              } mb-4`} />
            <h3 className={`text-xl font-bold ${themeClasses.textColor === 'text-white' ? 'text-white' : 'text-gray-800'
              } mb-2`}>
              No products found
            </h3>
            <p className={`${themeClasses.textColor === 'text-white' ? 'text-white/80' : 'text-gray-600'
              } mb-6`}>
              {searchQuery
                ? 'No products match your search. Try different keywords.'
                : 'This shop currently has no products available.'}
            </p>
            {searchQuery && (
              <Button
                variant="outline"
                className={`${themeClasses.borderColor} ${themeClasses.textColor === 'text-white'
                  ? 'text-white border-white/30 hover:bg-white/10'
                  : 'hover:bg-gray-100'
                  }`}
                onClick={() => setSearchQuery('')}
              >
                Clear search
              </Button>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default ShopPage;


