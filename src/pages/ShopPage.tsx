import { useEffect, useState, type CSSProperties } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Store, Package, Users } from 'lucide-react';
import { sellerApi } from '@/api/sellerApi';
import creatorApi from '@/api/creatorApi';
import { formatCurrency, getImageUrl, cn } from '@/lib/utils';
import { ProductCard } from '@/components/ProductCard';
import type { Product as ProductType, Seller, Aesthetic } from '@/types';
import type { Product as SellerApiProduct } from '@/api/sellerApi';
import { useBuyerAuth } from '@/contexts/GlobalAuthContext';
import { useShopTheme, type Theme } from '@/hooks/useShopTheme';

const SHOP_DEFAULT_BANNER_STYLE: CSSProperties = {
  background: [
    'radial-gradient(circle at 18% 18%, rgba(var(--theme-accent-rgb), 0.28), transparent 28%)',
    'radial-gradient(circle at 82% 32%, rgba(var(--theme-accent-rgb), 0.18), transparent 30%)',
    'linear-gradient(135deg, var(--theme-bg-color) 0%, var(--theme-card-bg) 52%, var(--theme-accent) 100%)'
  ].join(', ')
};

// Type guard to check if a string is a valid Aesthetic
function isAesthetic(value: string): value is Aesthetic {
  return [
    'all',
    'clothes-style',
    'sneakers-shoes',
    'beauty-fragrance',
    'art-decor-crafts',
    'electronics-accessories',
    'home-living',
    'health-wellness'
  ].includes(value);
}

const getSellerInitials = (shopName?: string, fullName?: string) => {
  const source = (shopName || fullName || 'Shop').trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'S';
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
};

// Base product type that matches the Product interface but makes some fields optional
interface BaseProduct extends Omit<ProductType, 'seller' | 'aesthetic' | 'isSold' | 'status'> {
  seller?: Seller;
  isSold: boolean;
  status: 'available' | 'sold';
  aesthetic: Aesthetic | string;
}

// Shop-specific product type that extends the base product
interface ShopProduct extends Omit<BaseProduct, 'seller'> {
  seller?: ShopSeller;
}

// Shop-specific seller type that extends the base Seller type
interface ShopSeller extends Omit<Seller, 'bannerUrl'> {
  bannerImage?: string;
  theme?: Theme;
  city?: string;
  instagramLink?: string;
  tiktokLink?: string;
  facebookLink?: string;
  clientCount?: number;
  bio?: string;
  avatarUrl?: string;
  avatar_url?: string;
}

const ShopPage = () => {
  const { shopName } = useParams<{ shopName: string }>();
  const location = useLocation();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerInfo, setSellerInfo] = useState<ShopSeller | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bannerLoadFailed, setBannerLoadFailed] = useState(false);

  const { isAuthenticated } = useBuyerAuth();
  const themeClasses = useShopTheme((sellerInfo?.theme as Theme) || 'default');

  useEffect(() => {
    const creatorCode = new URLSearchParams(location.search).get('creator');
    if (!creatorCode) return;

    const storageKey = `creator-click:${creatorCode}`;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, '1');
    creatorApi.trackLinkClick(creatorCode).catch(() => undefined);
  }, [location.search]);

  useEffect(() => {
    const fetchShopData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        window.scrollTo(0, 0);

        if (!shopName) {
          throw new Error('Shop name is required');
        }

        const seller = await sellerApi.getSellerByShopName(shopName);

        if (!seller) {
          throw new Error('Shop not found');
        }

        const sellerData: ShopSeller = {
          id: String(seller.id),
          fullName: seller.fullName || seller.full_name || '',
          shopName: seller.shopName || seller.shop_name || '',
          phone: seller.phone || '',
          whatsappNumber: seller.whatsappNumber || seller.phone || '',
          email: seller.email || '',
          bannerImage: seller.bannerImage || seller.banner_image || '',
          city: seller.city,
          location: seller.location,
          theme: (seller.theme as Theme) || 'default',
          instagramLink: seller.instagramLink || '',
          tiktokLink: seller.tiktokLink || '',
          facebookLink: seller.facebookLink || '',
          clientCount: seller.clientCount || seller.client_count || 0,
          bio: seller.bio || '',
          avatarUrl: seller.avatarUrl || seller.avatar_url || '',
          hasPhysicalShop: !!seller.physicalAddress,
          physicalAddress: seller.physicalAddress,
          latitude: seller.latitude,
          longitude: seller.longitude,
          createdAt: seller.createdAt || new Date().toISOString()
        };

        setSellerInfo(sellerData);
        setAvatarLoadFailed(false);
        setBannerLoadFailed(false);

        const sellerProducts = await sellerApi.getSellerProducts(seller.id);

        const availableProducts = (sellerProducts as SellerApiProduct[])
          .map(p => ({
            ...p,
            sellerId: p.sellerId || '',
            isSold: p.isSold || false,
            status: p.status || 'available',
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: p.updatedAt || new Date().toISOString(),
            aesthetic: isAesthetic((p as any).aesthetic) ? (p as any).aesthetic : 'all',
            seller: sellerData
          } as unknown as ShopProduct))
          .filter(p => !p.isSold && p.status !== 'sold');

        setProducts(availableProducts);
      } catch (err: any) {
        console.error('Error fetching shop data:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load shop data');
      } finally {
        setIsLoading(false);
      }
    };

    if (shopName) {
      fetchShopData();
    } else {
      setError('Shop name is required');
      setIsLoading(false);
    }
  }, [shopName]);

  // Filter products based on search query
  const filteredProducts = products.filter(product => {
    if (!searchQuery.trim()) return true;

    const searchTerms = searchQuery.toLowerCase().split(' ').filter(term => term.length > 0);
    const productText = `${product.name.toLowerCase()} ${product.description.toLowerCase()}`;

    return searchTerms.every(term =>
      productText.includes(term)
    );
  });

  const sellerInitials = getSellerInitials(sellerInfo?.shopName, sellerInfo?.fullName);
  const showSellerAvatar = Boolean(sellerInfo?.avatarUrl && !avatarLoadFailed);

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
    <div className="min-h-screen bg-[var(--theme-bg-color)] text-[var(--theme-text)] transition-colors duration-200">
      {/* Modern Hero Section */}
      <div className="relative h-[22dvh] min-h-[180px] sm:h-[44dvh] sm:min-h-[340px] lg:h-[50dvh] w-full overflow-hidden">
        {sellerInfo?.bannerImage && !bannerLoadFailed ? (
          <img
            src={getImageUrl(sellerInfo.bannerImage)}
            alt={`${sellerInfo.shopName || 'Shop'} Banner`}
            className="h-full w-full object-cover object-center sm:animate-slow-zoom"
            onError={(e) => {
              console.error('Error loading banner image:', e);
              setBannerLoadFailed(true);
            }}
          />
        ) : (
          <div className="absolute inset-0" style={SHOP_DEFAULT_BANNER_STYLE} aria-hidden="true">
            <div className="absolute inset-0 opacity-[0.1] [background-image:linear-gradient(rgba(255,255,255,0.82)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.82)_1px,transparent_1px)] [background-size:44px_44px]" />
            <div className="absolute right-[-4rem] top-1/2 h-64 w-64 -translate-y-1/2 rounded-full border bg-white/[0.06] sm:h-96 sm:w-96" style={{ borderColor: 'rgba(var(--theme-accent-rgb), 0.24)' }} />
            <div
              className="absolute left-6 top-14 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white shadow-sm backdrop-blur-sm sm:left-10 sm:top-20 sm:px-4 sm:py-1.5 sm:text-xs"
              style={{
                backgroundColor: 'rgba(var(--theme-accent-rgb), 0.22)',
                borderColor: 'rgba(var(--theme-accent-rgb), 0.34)'
              }}
            >
              Byblos Shop
            </div>
          </div>
        )}

        {/* Sleek Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/10 transition-opacity duration-300" />

        {/* Back to Home/Dashboard Button - Top Left */}
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
          <Button
            asChild
            className="bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 shadow-lg px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 flex items-center group"
          >
            <Link to={location.pathname.startsWith('/buyer') ? "/buyer/dashboard" : "/"} className="flex items-center gap-1.5 sm:gap-2">
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:-translate-x-1 transition-transform" />
              <span>{location.pathname.startsWith('/buyer') ? "Back to Dashboard" : "Back to Home"}</span>
            </Link>
          </Button>
        </div>

        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-3 pb-4 sm:p-8 sm:pb-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-end gap-2.5 sm:gap-5 text-left sm:animate-fade-in-up">
            
            {/* Avatar & Shop Name Container - Side by Side on Mobile */}
            <div className="flex items-center gap-3 sm:block shrink-0">
              <div className="h-12 w-12 sm:h-20 sm:w-20 rounded-xl sm:rounded-3xl bg-gradient-to-br from-yellow-300 to-yellow-500 border border-white/30 shadow-2xl overflow-hidden flex items-center justify-center text-lg sm:text-2xl font-black text-black">
                {showSellerAvatar ? (
                  <img
                    src={getImageUrl(sellerInfo?.avatarUrl || '')}
                    alt={`${sellerInfo?.shopName || 'Shop'} avatar`}
                    className="h-full w-full object-cover"
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : (
                  <span>{sellerInitials}</span>
                )}
              </div>
              
              <div className="min-w-0 sm:hidden">
                <h1 className="text-xl font-bold text-white tracking-tight leading-tight drop-shadow-2xl break-words">
                  {sellerInfo?.shopName || 'Shop'}
                </h1>
                {sellerInfo?.city && (
                  <p className="text-[10px] text-white/80 font-medium">
                    {sellerInfo.city}
                  </p>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
              <h1 className="hidden sm:block text-2xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight leading-none drop-shadow-2xl break-words">
                {sellerInfo?.shopName || 'Shop'}
              </h1>

              {sellerInfo?.bio && (
                <p className="max-w-3xl text-[10px] sm:text-sm md:text-base text-white/85 leading-relaxed break-words max-h-[3rem] sm:max-h-none overflow-hidden drop-shadow">
                  {sellerInfo.bio}
                </p>
              )}
              
              <div className="flex flex-wrap items-center gap-1.5 text-white/90 font-medium text-[9px] sm:text-xs max-w-full">
                <span className="backdrop-blur-sm bg-black/25 px-2 py-0.5 sm:px-3 sm:py-1.5 rounded-full border border-white/10 shadow-lg">{filteredProducts.length} {filteredProducts.length === 1 ? 'Item' : 'Items'}</span>
                <span className="flex items-center gap-0.5 sm:gap-1 backdrop-blur-sm bg-black/25 px-2 py-0.5 sm:px-3 sm:py-1.5 rounded-full border border-white/10 shadow-lg">
                  <Users className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                  <span className="font-bold">{sellerInfo?.clientCount || 0}</span>
                  <span>Followers</span>
                </span>
                <span className="flex items-center gap-0.5 sm:gap-1 backdrop-blur-sm bg-black/25 px-2 py-0.5 sm:px-3 sm:py-1.5 rounded-full border border-white/10 shadow-lg">
                  <Store className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                  <span className="font-bold">{(sellerInfo && (sellerInfo.physicalAddress || (sellerInfo.latitude && sellerInfo.longitude && sellerInfo.latitude !== 0))) ? 'Physical Shop' : 'Online Shop'}</span>
                </span>
              </div>
            </div>

            {(sellerInfo?.instagramLink || sellerInfo?.tiktokLink || sellerInfo?.facebookLink) && (
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {sellerInfo?.instagramLink && (
                  <a
                    href={sellerInfo.instagramLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Instagram"
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/25 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200 text-[9px] sm:text-xs font-medium"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-3.5 sm:h-3.5">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                    <span>Instagram</span>
                  </a>
                )}
                {sellerInfo?.tiktokLink && (
                  <a
                    href={sellerInfo.tiktokLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="TikTok"
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/25 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200 text-[9px] sm:text-xs font-medium"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-3.5 sm:h-3.5">
                      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                    </svg>
                    <span>TikTok</span>
                  </a>
                )}
                {sellerInfo?.facebookLink && (
                  <a
                    href={sellerInfo.facebookLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Facebook"
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/25 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200 text-[9px] sm:text-xs font-medium"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-3.5 sm:h-3.5">
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                    </svg>
                    <span>Facebook</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Products */}
      <main className="max-w-[1920px] mx-auto px-3 sm:px-6 py-6 sm:py-8 lg:px-8">
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
            "backdrop-blur-md rounded-[2.5rem] p-5 sm:p-10 shadow-2xl border transition-all duration-500",
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
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {filteredProducts.map((product) => {
                // Ensure the product has the seller info from the shop
                const productWithSeller: ProductType & { seller?: Seller; isSold?: boolean; } = {
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
