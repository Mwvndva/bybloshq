import { Link, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/shared/ui/button';
import { Loader2, Store, Package, ExternalLink, Sparkles } from 'lucide-react';
import { cn, getImageUrl } from '@/shared/utils/formatting';
import { BagProvider } from '@/features/shop/bag/BagContext';
import { BagSheet } from '@/features/shop/components/BagSheet';
import { ShopBagProductCard } from '@/features/shop/components/ShopBagProductCard';
import type { Product, Seller } from '@/shared/types';
import { type Theme } from '@/shared/hooks/useShopTheme';
import { isAesthetic } from '../utils/shopPage.shared';
import { SEOHead } from '@/shared/components/SEOHead';
import { ShopHero } from '../components/ShopHero';
import { ShopPageThemePicker } from '../components/ShopPageThemePicker';
import { useShopPage } from './useShopPage';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { getShopUrl } from '@/shared/utils/shopLinks';

const ShopPage = () => {
  const { shopName: routeShopName } = useParams<{ shopName: string }>();
  const {
    sellerInfo,
    themeClasses,
    shopPageTheme,
    setShopPageTheme,
    resolvedShopTheme,
    products,
    hasDigitalProducts,
    filteredProducts,
    searchQuery,
    setSearchQuery,
    avatarLoadFailed,
    setAvatarLoadFailed,
    sellerInitials,
    showSellerAvatar,
    isLoading,
    error,
  } = useShopPage();

  // A wishlist tap navigates here with the product to pre-add to the bag.
  const location = useLocation();
  const bagAdd = (location.state as { bagAdd?: Product } | null)?.bagAdd ?? null;

  if (isLoading) {
    return (
      <div
        className="shop-page-root min-h-screen flex items-center justify-center bg-[var(--byblos-bg,#f5f4f0)] text-[var(--byblos-text,#0f0f0e)] transition-colors duration-300"
        data-shop-theme={resolvedShopTheme}
      >
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
            <Loader2 className="h-12 w-12 text-yellow-600 animate-spin" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-[var(--byblos-text)] mb-3">Loading Shop</h3>
            <p className="text-[var(--byblos-muted)] text-lg font-medium">Please wait while we fetch the shop details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="shop-page-root min-h-screen flex items-center justify-center p-4 bg-[var(--byblos-bg,#f5f4f0)] text-[var(--byblos-text,#0f0f0e)] transition-colors duration-300"
        data-shop-theme={resolvedShopTheme}
      >
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-100 to-red-200 rounded-3xl flex items-center justify-center shadow-lg">
            <Store className="h-12 w-12 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[var(--byblos-text)] mb-3">Error Loading Shop</h2>
            <p className="text-[var(--byblos-muted)] text-lg font-medium mb-6">{error}</p>
            <Button
              asChild
              className="bg-yellow-400 hover:bg-yellow-300 text-black shadow-lg px-8 py-3 rounded-xl font-bold transition-colors duration-200"
            >
              <Link to="/">Return to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BagProvider seedProduct={bagAdd}>
    <div
      className="shop-page-root min-h-screen transition-colors duration-300"
      data-shop-theme={resolvedShopTheme}
    >
      <SEOHead
        title={sellerInfo?.shopName || sellerInfo?.fullName || 'Shop'}
        description={sellerInfo?.bio || `Shop ${sellerInfo?.shopName || 'products'} on Byblos. Browse quality items and order securely.`}
        image={sellerInfo?.avatarUrl ? getImageUrl(sellerInfo.avatarUrl) : undefined}
      />
      {/* Light/Dark/System theme picker — top-right, small, no border touching */}
      <ShopPageThemePicker theme={shopPageTheme} onThemeChange={setShopPageTheme} />
      <ShopHero
        sellerInfo={sellerInfo}
        showSellerAvatar={showSellerAvatar}
        setAvatarLoadFailed={setAvatarLoadFailed}
        sellerInitials={sellerInitials}
      />
      {/* Products */}
      <main className="max-w-[1920px] mx-auto px-3 sm:px-6 pt-2 pb-6 sm:pt-4 sm:pb-8 lg:px-8">
        <div className="mb-8">
          <div className="relative max-w-md mx-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-[var(--byblos-muted)]"
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
                "block w-full pl-10 pr-3 py-3 border border-[var(--byblos-border,rgba(0,0,0,0.1))] rounded-2xl transition-all duration-300",
                "bg-[var(--byblos-surface,#ffffff)] text-[var(--byblos-text,#0f0f0e)] placeholder:text-[var(--byblos-muted)]",
                "focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 shadow-sm"
              )}
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <p className="mt-3 text-center text-xs font-semibold text-[var(--byblos-muted)]">
            Tap a product to add it to your bag
          </p>

          {isNativeApp() && hasDigitalProducts && (
            <div className="mt-3.5 max-w-md mx-auto">
              <a
                href={getShopUrl(sellerInfo?.slug || sellerInfo?.shopName || routeShopName || '')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 w-full p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-950 dark:text-amber-200 hover:bg-amber-500/25 transition-all shadow-sm group text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs font-bold leading-tight">Digital products available on Web</p>
                    <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 font-medium">Tap to view & buy downloads on website</p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-amber-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </a>
            </div>
          )}
        </div>

        {filteredProducts.length > 0 ? (
          <div className="shop-products-card rounded-[2rem] p-5 sm:p-10 sm:rounded-[2.5rem] transition-all duration-300">
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
                    bannerUrl: '',
                    location: sellerInfo.location || '',
                    // New physical shop fields
                    hasPhysicalShop: !!sellerInfo.physicalAddress,
                    physicalAddress: sellerInfo.physicalAddress,
                    latitude: sellerInfo.latitude,
                    longitude: sellerInfo.longitude,
                    theme: sellerInfo.theme,
                    // Add any other required fields from Seller interface with defaults
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  } : undefined
                };

                return (
                  <div key={product.id}>
                    <ShopBagProductCard product={productWithSeller} />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="shop-products-card text-center py-16 rounded-3xl p-8 transition-all duration-300 border border-[var(--byblos-border)]">
            <Package className="h-16 w-16 mx-auto text-[var(--byblos-muted)] mb-4" />
            <h3 className="text-xl font-bold text-[var(--byblos-text)] mb-2">
              No products found
            </h3>
            <p className="text-[var(--byblos-muted)] text-sm mb-6">
              {searchQuery
                ? 'No products match your search. Try different keywords.'
                : 'This shop currently has no products available.'}
            </p>
            {searchQuery && (
              <Button
                variant="outline"
                className="border-[var(--byblos-border)] text-[var(--byblos-text)] hover:bg-[var(--byblos-surface-soft)] transition-colors"
                onClick={() => setSearchQuery('')}
              >
                Clear search
              </Button>
            )}
          </div>
        )}

      </main>
    </div>
    <BagSheet />
    </BagProvider>
  );
};

export default ShopPage;


