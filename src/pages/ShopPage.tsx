import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Store, Package } from 'lucide-react';
import { sellerApi } from '@/api/sellerApi';
import { formatCurrency, getImageUrl } from '@/lib/utils';
import { ProductCard } from '@/components/ProductCard';
import type { Product as ProductType, Seller, Aesthetic } from '@/types';
import type { Product as SellerApiProduct } from '@/api/sellerApi';

type Theme = 'default' | 'black' | 'pink' | 'orange' | 'green' | 'red' | 'yellow' | 'brown';

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
  bannerImage?: string;  // New field
  theme?: Theme;         // New field
  city?: string;         // New field
  instagramLink?: string; // New field
  // createdAt is required from Seller
  // updatedAt is optional from Seller
  // All required fields from Seller remain required:
  // - id: string
  // - shopName: string
  // - fullName: string
  // - email: string
  // - phone: string
  // - createdAt: string
  // Other optional fields from Seller remain optional:
  // - updatedAt?: string
  // - bio?: string
  // - avatarUrl?: string
  // - location?: string
  // - website?: string
  // - socialMedia?: { ... }
}

const ShopPage = () => {
  const { shopName } = useParams<{ shopName: string }>();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerInfo, setSellerInfo] = useState<ShopSeller | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const defaultBanner = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80';

  // Get theme classes based on seller's theme
  const getThemeClasses = useCallback(() => {
    const theme = (sellerInfo?.theme as Theme) || 'default';

    switch (theme) {
      case 'black':
        return {
          bgGradient: 'from-black to-black',
          textColor: 'text-white',
          buttonGradient: 'from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800',
          cardBg: 'bg-gray-800/90',
          accentColor: 'text-yellow-400',
          borderColor: 'border-gray-700'
        };
      case 'pink':
        return {
          bgGradient: 'from-pink-50 to-white',
          textColor: 'text-pink-900',
          buttonGradient: 'from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700',
          cardBg: 'bg-white/90',
          accentColor: 'text-pink-600',
          borderColor: 'border-pink-200'
        };
      case 'orange':
        return {
          bgGradient: 'from-orange-50 to-white',
          textColor: 'text-orange-900',
          buttonGradient: 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
          cardBg: 'bg-white/90',
          accentColor: 'text-orange-600',
          borderColor: 'border-orange-200'
        };
      case 'green':
        return {
          bgGradient: 'from-green-50 to-white',
          textColor: 'text-green-900',
          buttonGradient: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
          cardBg: 'bg-white/90',
          accentColor: 'text-green-600',
          borderColor: 'border-green-200'
        };
      case 'red':
        return {
          bgGradient: 'from-red-50 to-white',
          textColor: 'text-red-900',
          buttonGradient: 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
          cardBg: 'bg-white/90',
          accentColor: 'text-red-600',
          borderColor: 'border-red-200'
        };
      case 'yellow':
        return {
          bgGradient: 'from-yellow-50 to-white',
          textColor: 'text-yellow-900',
          buttonGradient: 'from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600',
          cardBg: 'bg-white/90',
          accentColor: 'text-yellow-600',
          borderColor: 'border-yellow-200'
        };
      case 'brown':
        return {
          bgGradient: 'from-[#fdf8f6] to-white',
          textColor: 'text-[#451a03]',
          buttonGradient: 'from-[#78350f] to-[#92400e] hover:from-[#92400e] hover:to-[#b45309]',
          cardBg: 'bg-white/90',
          accentColor: 'text-[#92400e]',
          borderColor: 'border-[#f3e3d3]'
        };
      default: // default theme
        return {
          bgGradient: 'from-gray-50 to-white',
          textColor: 'text-gray-900',
          buttonGradient: 'from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600',
          cardBg: 'bg-white/90',
          accentColor: 'text-yellow-600',
          borderColor: 'border-gray-200'
        };
    }
  }, [sellerInfo?.theme]);

  const themeClasses = getThemeClasses();

  // Apply theme to the page
  useEffect(() => {
    if (!sellerInfo?.theme) return;

    const theme = sellerInfo.theme as Theme;
    const root = document.documentElement;

    // Set CSS custom properties based on theme
    const setThemeVariables = () => {
      switch (theme) {
        case 'black':
          root.style.setProperty('--theme-bg-color', '#0a0e17');
          root.style.setProperty('--theme-text', '#f3f4f6');
          root.style.setProperty('--theme-card-bg', 'rgba(17, 24, 39, 0.95)');
          root.style.setProperty('--theme-accent', '#f59e0b');
          root.style.setProperty('--theme-border', 'rgba(31, 41, 55, 0.7)');
          break;
        case 'pink':
          root.style.setProperty('--theme-bg-color', '#fce7f3');
          root.style.setProperty('--theme-text', '#831843');
          root.style.setProperty('--theme-card-bg', 'rgba(255, 255, 255, 0.95)');
          root.style.setProperty('--theme-accent', '#db2777');
          root.style.setProperty('--theme-border', 'rgba(251, 207, 232, 0.5)');
          break;
        case 'orange':
          root.style.setProperty('--theme-bg-color', '#ffedd5');
          root.style.setProperty('--theme-text', '#7c2d12');
          root.style.setProperty('--theme-card-bg', 'rgba(255, 255, 255, 0.95)');
          root.style.setProperty('--theme-accent', '#ea580c');
          root.style.setProperty('--theme-border', 'rgba(254, 215, 170, 0.5)');
          break;
        case 'green':
          root.style.setProperty('--theme-bg-color', '#f0fdf4');
          root.style.setProperty('--theme-text', '#166534');
          root.style.setProperty('--theme-card-bg', 'rgba(255, 255, 255, 0.95)');
          root.style.setProperty('--theme-accent', '#16a34a');
          root.style.setProperty('--theme-border', 'rgba(187, 247, 208, 0.5)');
          break;
        case 'red':
          root.style.setProperty('--theme-bg-color', '#fef2f2');
          root.style.setProperty('--theme-text', '#991b1b');
          root.style.setProperty('--theme-card-bg', 'rgba(255, 255, 255, 0.95)');
          root.style.setProperty('--theme-accent', '#dc2626');
          root.style.setProperty('--theme-border', 'rgba(254, 202, 202, 0.5)');
          break;
        case 'yellow':
          root.style.setProperty('--theme-bg-color', '#fef9c3');
          root.style.setProperty('--theme-text', '#713f12');
          root.style.setProperty('--theme-card-bg', 'rgba(255, 255, 255, 0.95)');
          root.style.setProperty('--theme-accent', '#ca8a04');
          root.style.setProperty('--theme-border', 'rgba(254, 240, 138, 0.5)');
          break;
        case 'brown':
          root.style.setProperty('--theme-bg-color', '#fffbeb');
          root.style.setProperty('--theme-text', '#451a03');
          root.style.setProperty('--theme-card-bg', 'rgba(255, 255, 255, 0.95)');
          root.style.setProperty('--theme-accent', '#92400e');
          root.style.setProperty('--theme-border', 'rgba(251, 235, 198, 0.5)');
          break;
        default: // default theme
          root.style.setProperty('--theme-bg-color', '#f9fafb');
          root.style.setProperty('--theme-text', '#111827');
          root.style.setProperty('--theme-card-bg', 'rgba(255, 255, 255, 0.95)');
          root.style.setProperty('--theme-accent', '#d97706');
          root.style.setProperty('--theme-border', 'rgba(229, 231, 235, 0.5)');
      }
    };

    setThemeVariables();

    // Clean up
    return () => {
      // Reset all theme variables
      root.style.removeProperty('--theme-bg-color');
      root.style.removeProperty('--theme-text');
      root.style.removeProperty('--theme-card-bg');
      root.style.removeProperty('--theme-accent');
      root.style.removeProperty('--theme-border');
    };
  }, [sellerInfo?.theme]);

  useEffect(() => {
    const fetchShopData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!shopName) {
          throw new Error('Shop name is required');
        }

        console.log('Fetching seller with shop name:', shopName);
        // First, get the seller by shop name
        const seller = await sellerApi.getSellerByShopName(shopName);

        if (!seller) {
          throw new Error('Shop not found');
        }

        console.log('Found seller:', seller);
        console.log('Seller banner image from API:', seller.bannerImage || seller.banner_image || 'No banner image');

        const sellerData: ShopSeller = {
          id: String(seller.id),  // Convert ID to string
          fullName: seller.fullName || seller.full_name || '',
          shopName: seller.shopName || seller.shop_name || '',
          phone: seller.phone || '',
          email: seller.email || '',
          bannerImage: seller.bannerImage || seller.banner_image, // Handle both cases
          city: seller.city,
          location: seller.location,
          theme: seller.theme as Theme || 'default', // Add theme with default value
          instagramLink: seller.instagramLink || '', // Map from API
          // Physical shop fields
          hasPhysicalShop: !!seller.physicalAddress,
          physicalAddress: seller.physicalAddress,
          latitude: seller.latitude,
          longitude: seller.longitude,

          // Required fields from Seller interface
          createdAt: seller.createdAt || new Date().toISOString()
        };

        // Log the banner image data for debugging
        console.log('Raw seller data:', seller);
        console.log('Processed seller data:', sellerData);
        console.log('Banner image exists:', !!sellerData.bannerImage);

        if (sellerData.bannerImage) {
          console.log('Banner image type:', typeof sellerData.bannerImage);
          console.log('Banner image length:', sellerData.bannerImage.length);
          console.log('Banner image preview:', sellerData.bannerImage.substring(0, 50) + '...');
        }

        setSellerInfo(sellerData);

        // Then fetch products for this seller using the public endpoint
        console.log('Fetching products for seller:', seller.id);
        const sellerProducts = await sellerApi.getSellerProducts(seller.id);
        console.log('Fetched products:', sellerProducts);

        // Map seller API products to our ProductType and filter available ones
        const availableProducts = (sellerProducts as SellerApiProduct[])
          .map(p => ({
            ...p,
            sellerId: p.sellerId || '',
            isSold: p.isSold || false,
            status: p.status || 'available',
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: p.updatedAt || new Date().toISOString(),
            aesthetic: isAesthetic((p as any).aesthetic) ? (p as any).aesthetic : 'all'
          } as ProductType))
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

  // Log when banner image is rendered
  useEffect(() => {
    if (sellerInfo) {
      console.log('Current seller info in state:', {
        ...sellerInfo,
        bannerImage: sellerInfo.bannerImage || 'No banner image'
      });
    }
  }, [sellerInfo]);

  // Filter products based on search query
  const filteredProducts = products.filter(product => {
    if (!searchQuery.trim()) return true;

    const searchTerms = searchQuery.toLowerCase().split(' ').filter(term => term.length > 0);
    const productText = `${product.name.toLowerCase()} ${product.description.toLowerCase()}`;

    return searchTerms.every(term =>
      productText.includes(term)
    );
  });

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
      <div className="relative h-[30vh] min-h-[260px] sm:h-[40vh] lg:h-[50vh] w-full overflow-hidden">
        {sellerInfo?.bannerImage ? (
          <img
            src={getImageUrl(sellerInfo.bannerImage)}
            alt={`${sellerInfo.shopName || 'Shop'} Banner`}
            className="w-full h-full object-cover transform scale-105 animate-slow-zoom"
            style={{ animation: 'scale 20s linear infinite alternate' }}
            onError={(e) => {
              console.error('Error loading banner image:', e);
              e.currentTarget.src = defaultBanner;
            }}
          />
        ) : (
          <img
            src={defaultBanner}
            alt="Default Shop Banner"
            className="w-full h-full object-cover"
          />
        )}

        {/* Sleek Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 transition-opacity duration-300" />

        {/* Back to Home Button - Top Left */}
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
          <Button
            asChild
            className="bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 shadow-lg px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 flex items-center group"
          >
            <Link to="/" className="flex items-center gap-1.5 sm:gap-2">
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Home</span>
            </Link>
          </Button>
        </div>

        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-8 sm:p-8 sm:pb-16">
          <div className="max-w-7xl mx-auto flex flex-col items-center text-center space-y-3 sm:space-y-4 animate-fade-in-up">
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-white tracking-tight uppercase leading-none drop-shadow-2xl px-2">
              {sellerInfo?.shopName || 'SHOP'}
            </h1>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6 text-white/90 font-medium text-[10px] sm:text-base backdrop-blur-sm bg-black/20 p-2 sm:p-3 rounded-full border border-white/10 shadow-xl">
              {sellerInfo?.fullName && (
                <span className="flex items-center gap-2 px-2">
                  <span className="opacity-70">By</span>
                  <span className="font-bold tracking-wide">{sellerInfo.fullName}</span>
                </span>
              )}

              <div className="h-1 w-1 bg-white/50 rounded-full" />

              <span className="px-2">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'Item' : 'Collection Items'}
              </span>

              {sellerInfo?.instagramLink && (
                <>
                  <div className="h-1 w-1 bg-white/50 rounded-full" />
                  <a
                    href={sellerInfo.instagramLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-2 hover:text-[var(--theme-accent)] transition-colors duration-200 group"
                    title="Visit Instagram"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="group-hover:scale-110 transition-transform"
                    >
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                    <span className="hidden sm:inline">Instagram</span>
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 lg:px-8">
        <div className="mb-8">
          <div className="relative max-w-md mx-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className={`h-5 w-5 ${themeClasses.textColor === 'text-white' ? 'text-white/70' : 'text-gray-400'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              className={`block w-full pl-10 pr-3 py-2 border ${themeClasses.borderColor} rounded-lg ${themeClasses.cardBg} shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent ${themeClasses.accentColor.replace('text-', 'focus:ring-')
                }`}
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                color: themeClasses.textColor === 'text-white' ? 'white' : 'inherit',
                backgroundColor: themeClasses.cardBg.includes('bg-white')
                  ? 'rgba(255, 255, 255, 0.9)'
                  : 'rgba(0, 0, 0, 0.1)'
              }}
            />
          </div>
        </div>

        {filteredProducts.length > 0 ? (
          <div className={`${themeClasses.cardBg} backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-lg border ${themeClasses.borderColor}/50`}>
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
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
                      hideWishlist={true}
                      theme={sellerInfo?.theme as Theme}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={`text-center py-16 ${themeClasses.cardBg} backdrop-blur-sm rounded-3xl p-8 shadow-lg border ${themeClasses.borderColor}/50`}>
            <Package className={`h-16 w-16 mx-auto ${themeClasses.textColor === 'text-white' ? 'text-white/60' : 'text-gray-400'
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
