import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Store, Image as ImageIcon, FileText, Handshake, Calendar, MapPin, Loader2, Heart, ShoppingCart, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/GlobalAuthContext';
import { Product, Seller } from '@/types';
import { useWishlist } from '@/contexts/WishlistContext';
import { cn, formatCurrency, getImageUrl } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { BuyerInfoModal } from '@/components/BuyerInfoModal';
import PhoneCheckModal from '@/components/PhoneCheckModal';
import { ServiceBookingModal } from '@/components/ServiceBookingModal';
import buyerApi from '@/api/buyerApi';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/lib/apiClient';
import { clearAllAuthData } from '@/lib/authCleanup';
import ProductImage from '@/components/common/ProductImage';

type Theme = 'default' | 'black' | 'pink' | 'orange' | 'green' | 'red' | 'yellow' | 'brown';


interface ProductCardProps {
  product: Product;
  seller?: Seller;
  hideWishlist?: boolean;
  theme?: Theme;
  forceWhiteText?: boolean;
}


export function ProductCard({ product, seller, hideWishlist = false, theme = 'default', forceWhiteText = false }: ProductCardProps) {
  const { toast } = useToast();
  const navigate = useNavigate();

  // Safely use wishlist context
  let wishlistContext = null;
  try {
    wishlistContext = useWishlist?.();
  } catch (error) {
    console.warn('ProductCard: Wishlist not available');
  }

  const addToWishlist = wishlistContext?.addToWishlist || (async () => { });
  const isInWishlist = wishlistContext?.isInWishlist || (() => false);
  const isWishlistLoading = wishlistContext?.isLoading || false;

  // Dialog state
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [isPhoneCheckModalOpen, setIsPhoneCheckModalOpen] = useState(false);
  const [isBuyerModalOpen, setIsBuyerModalOpen] = useState(false);
  const [currentPhone, setCurrentPhone] = useState('');
  const [initialBuyerData, setInitialBuyerData] = useState<{ fullName?: string; email?: string; city?: string; location?: string } | undefined>(undefined);
  const [shouldSkipSave, setShouldSkipSave] = useState(false);

  // Loading states
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [wishlistActionLoading, setWishlistActionLoading] = useState(false);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  // Derived state
  const displaySeller = seller || product.seller;
  const displaySellerName = displaySeller?.shopName || displaySeller?.fullName || 'Unknown Shop';

  // Check if product is out of stock (inventory tracking)
  const isOutOfStock = (product as any).track_inventory === true && ((product as any).quantity === 0 || (product as any).quantity === null);
  const isSold = product.status === 'sold' || product.isSold || isOutOfStock;
  const isWishlisted = isInWishlist(product.id);

  const glassCardStyle: React.CSSProperties = {
    background: 'rgba(17, 17, 17, 0.7)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.6)'
  };


  useEffect(() => {

  }, [product.id, isWishlisted]);

  // Define all product images
  const allImages = [
    ...(product.image_url && (!product.images || product.images.length === 0 || product.images[0] !== product.image_url) ? [product.image_url] : []),
    ...(product.images || [])
  ];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };
  const toggleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isWishlistLoading || wishlistActionLoading || isSold) return;
    setWishlistActionLoading(true);
    try {
      await addToWishlist(product);
      toast({
        title: 'Added to Wishlist',
        description: `${product.name} added to your wishlist.`
      });
    } catch (error: any) {
      if (error.code === 'DUPLICATE_WISHLIST_ITEM' || error.response?.status === 409) {
        toast({
          title: 'Already in Wishlist',
          description: 'Product already in wishlist',
          variant: 'default'
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to add item to wishlist.',
          variant: 'destructive'
        });
      }
    } finally {
      setWishlistActionLoading(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractiveElement =
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[role="button"]') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select') ||
      target.closest('[contenteditable="true"]') ||
      target.closest('[tabindex]');

    if (!isInteractiveElement) {
      setIsImageDialogOpen(true);
    }
  };

  // Safely use buyer auth context
  let isAuthenticated = false;
  let userData = null;

  try {
    const buyerAuth = useBuyerAuth?.();
    isAuthenticated = buyerAuth?.isAuthenticated || false;
    userData = buyerAuth?.user || null;
  } catch (error) {
    console.warn('ProductCard: BuyerAuth not available');
  }

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingData, setBookingData] = useState<{ date: Date; time: string; location: string; locationType?: string } | null>(null);

  const handleBuyClick = async (e: React.MouseEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    // 1. Service Product? -> Booking Flow
    if (product.product_type === 'service' || (product as any).productType === 'service') {
      setIsBookingModalOpen(true);
      return;
    }

    // 2. Authenticated? -> Direct Payment
    if (isAuthenticated && userData?.phone && userData?.fullName && userData?.email) {
      await executePayment({
        fullName: userData.fullName,
        email: userData.email,
        mobilePayment: userData.mobilePayment,
        whatsappNumber: userData.whatsappNumber,
        city: userData.city,
        location: userData.location
      });
    } else {
      // 3. Not Authenticated? -> Phone Check
      setIsPhoneCheckModalOpen(true);
    }
  };

  const handleBookingConfirm = async (data: {
    date: Date;
    time: string;
    location: string;
    locationType?: string;
    serviceRequirements?: string;
    buyerLocation?: { latitude: number; longitude: number; fullAddress: string } | null
  }) => {
    setBookingData(data);
    setIsBookingModalOpen(false);

    if (isAuthenticated && userData?.phone && userData?.fullName && userData?.email) {
      await executePayment({
        fullName: userData.fullName,
        email: userData.email,
        mobilePayment: userData.mobilePayment,
        whatsappNumber: userData.whatsappNumber,
        city: userData.city,
        location: userData.location
      }, data);
    } else {
      setIsPhoneCheckModalOpen(true);
    }
  };

  const handlePhoneSubmit = async (phone: string) => {
    setIsCheckingPhone(true);
    try {
      // Use buyerApi (which uses the old axios instance? No, let's just use it as is for now, it works)
      // Actually, let's verify buyerApi uses the same base logic.
      const result = await buyerApi.checkBuyerByPhone(phone);

      setCurrentPhone(phone);
      setIsPhoneCheckModalOpen(false);

      if (result.exists && result.buyer) {
        // CASE A: Buyer Exists
        // Check hasEmail flag instead of explicit email string to avoid PII leak
        if (result.buyer.hasEmail || (result.buyer.email && result.buyer.email.trim() !== '')) {
          // Has Email -> PROCEED TO PAYMENT
          // We pass empty email if we only have the flag; backend will resolve it from DB
          await executePayment({
            fullName: result.buyer.fullName || '',
            email: result.buyer.email || '', // Can be empty if we have hasEmail=true
            mobilePayment: result.buyer.mobilePayment || phone,
            whatsappNumber: result.buyer.whatsappNumber || phone,
            city: result.buyer.city,
            location: result.buyer.location
          }, null, result.buyer.id);
        } else {
          // Missing Email -> Prompt to Complete Profile
          toast({
            title: "Email Required",
            description: "Please provide your email address to receive the receipt.",
            variant: "default"
          });
          setInitialBuyerData({
            fullName: result.buyer.fullName,
            city: result.buyer.city,
            location: result.buyer.location,
            email: ''
          });
          setShouldSkipSave(false); // Enable save/login to identify the user session
          setIsBuyerModalOpen(true);
        }
      } else {
        // CASE B: New Buyer -> Registration Form
        setInitialBuyerData(undefined);
        setShouldSkipSave(false);
        setIsBuyerModalOpen(true);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to check phone number.',
        variant: 'destructive'
      });
    } finally {
      setIsCheckingPhone(false);
    }
  };

  const handleBuyerInfoSubmit = async (
    buyerInfo: {
      fullName: string;
      email: string;
      mobilePayment: string;
      whatsappNumber: string;
      city?: string;
      location?: string;
      password?: string
    },
    explicitBookingData?: any,
    isExistingUserUpdate: boolean = false
  ) => {
    try {
      // If it's a new user (not just updating email for existing), save them first
      if (!isExistingUserUpdate && !shouldSkipSave) {
        const saveResult = await buyerApi.saveBuyerInfo(buyerInfo);

        if (saveResult.requiresLogin) {
          // Save current location for redirect after login
          sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
          navigate('/buyer/login', { replace: true });
          return;
        }


        // Proceed with new ID (or let backend infer from cookie)
        await executePayment(buyerInfo, explicitBookingData, saveResult.buyer?.id);
      } else {
        // Existing user (skipped save) -> Proceed using backend lookup
        await executePayment(buyerInfo, explicitBookingData);
      }

    } catch (error: any) {
      console.error('Save error:', error);
      toast({ title: "Error", description: "Failed to save information." });
    }
  };

  const executePayment = async (
    buyerDetails: {
      fullName: string;
      email: string;
      mobilePayment: string;
      whatsappNumber: string;
      city?: string;
      location?: string
    },
    bookingDetails: any = null,
    buyerId?: string | number
  ) => {
    setIsProcessingPurchase(true);
    try {
      const activeBooking = bookingDetails || bookingData;
      const payload = {
        phone: buyerDetails.mobilePayment, // For STK Push
        mobilePayment: buyerDetails.mobilePayment,
        whatsappNumber: buyerDetails.whatsappNumber,
        email: buyerDetails.email,
        amount: product.price,
        productId: product.id,
        sellerId: product.sellerId || displaySeller?.id,
        productName: product.name,
        customerName: buyerDetails.fullName,
        narrative: `Purchase of ${product.name}`,
        paymentMethod: 'payd',
        city: buyerDetails.city,
        location: buyerDetails.location,
        metadata: activeBooking ? {
          booking_date: format(activeBooking.date, 'yyyy-MM-dd'),
          booking_time: activeBooking.time,
          service_location: activeBooking.location,
          location_type: activeBooking.locationType,
          service_requirements: activeBooking.serviceRequirements,
          buyer_location: activeBooking.buyerLocation,
          product_type: 'service'
        } : undefined
      };

      // USE NEW API CLIENT
      const response = await apiClient.post('/payments/initiate-product', payload);
      const data: any = response.data;

      if (data.status === 'success') {
        toast({
          title: 'STK Push Sent',
          description: 'Please check your phone to complete the payment.',
          duration: 10000
        });

        // Start Polling
        const invoiceId = data.data?.reference || data.data?.invoice_id; // Payd returns reference
        if (invoiceId) pollPaymentStatus(invoiceId);

      } else {
        throw new Error(data.message);
      }

    } catch (error: any) {
      console.error('Payment initiation error:', error);

      // Extract error message from response
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Could not initiate payment';

      // Check for specific error types
      const isNetworkError = errorMessage.includes('socket hang up') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('network') ||
        error.code === 'ECONNRESET';

      toast({
        title: 'Payment Failed',
        description: isNetworkError
          ? 'Payment gateway connection failed. Please try again in a moment.'
          : errorMessage,
        variant: 'destructive',
        duration: 8000
      });
      setIsProcessingPurchase(false);
    }
  };

  const pollPaymentStatus = (invoiceId: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 24) { clearInterval(interval); setIsProcessingPurchase(false); return; }

      try {
        // USE NEW API CLIENT
        const response = await apiClient.get(`/payments/status/${invoiceId}`);
        const data: any = response.data;
        const status = data.data?.status || data.status;

        if (status === 'success' || status === 'completed') {
          clearInterval(interval);
          setIsProcessingPurchase(false);

          toast({
            title: 'Payment Successful',
            description: 'Your purchase has been confirmed! Redirecting...',
            className: 'bg-green-600 text-white',
            duration: 2000
          });

          // **NAVIGATION**: Redirect to payment success page to show modal
          // User will manually click "Go to Login" button from success modal
          setTimeout(() => {
            navigate(`/payment/success?reference=${invoiceId}&status=success`, { replace: true });
          }, 1500);

        } else if (status === 'failed') {
          clearInterval(interval);
          setIsProcessingPurchase(false);
          toast({ title: 'Payment Failed', description: 'Transaction declined.', variant: 'destructive' });
        }
      } catch (e) { console.error(e); }
    }, 5000);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNjAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2QwZDBkMCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWltYWdlIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg==';
    setIsImageLoading(false);
  };

  const handleImageLoad = () => setIsImageLoading(false);

  // Get theme styles dynamically from CSS variables (set by ShopPage)
  const themedCardStyle: React.CSSProperties = {
    background: 'var(--theme-card-bg, rgba(17, 17, 17, 0.7))',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--theme-border, rgba(255, 255, 255, 0.1))',
    color: 'var(--theme-text, white)',
    boxShadow: '0 4px 24px -1px rgba(0, 0, 0, 0.2), 0 0 0 1px var(--theme-border, rgba(255, 255, 255, 0.1))'
  };

  const getThemeClasses = () => {
    // When inside a themed shop, we prefer CSS variables
    const isThemedShop = theme !== 'default';

    switch (theme) {
      case 'black':
        return {
          card: 'bg-[#0a0a0a]/95 text-white border-white/10 hover:border-[var(--theme-accent, #f59e0b)]/50 hover:shadow-[0_0_30px_rgba(var(--theme-accent-rgb, 245,158,11),0.15)]',
          price: 'text-[var(--theme-accent, #f59e0b)]',
          button: 'bg-[var(--theme-button-bg, #f59e0b)] hover:opacity-90 text-[var(--theme-button-text, black)] font-bold shadow-[0_0_15px_rgba(var(--theme-accent-rgb, 245,158,11),0.3)]',
          seller: 'text-gray-300',
          description: 'text-gray-300',
          icon: 'text-[var(--theme-accent, #f59e0b)]',
        };
      case 'pink':
      case 'orange':
      case 'green':
      case 'red':
      case 'yellow':
      case 'brown':
        return {
          card: 'bg-[var(--theme-card-bg, white)] text-black border-[var(--theme-border)] hover:shadow-xl hover:shadow-[var(--theme-accent)]/10',
          price: 'text-[var(--theme-accent)]',
          button: 'bg-[var(--theme-button-bg)] hover:opacity-90 text-[var(--theme-button-text)] shadow-md',
          seller: 'text-gray-800',
          description: 'text-gray-700',
          icon: 'text-[var(--theme-accent)]',
        };
      default: // default/glass theme
        return {
          card: 'border-0',
          price: 'text-yellow-400',
          button: 'bg-yellow-400 hover:bg-yellow-500 text-black font-bold shadow-lg shadow-yellow-500/10',
          seller: 'text-gray-100',
          description: 'text-gray-300',
          icon: 'text-gray-300',
        };
    }
  };

  const themeClasses = getThemeClasses();

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-700 backdrop-blur-md border-0 rounded-[2rem]',
        isSold ? 'opacity-60' : 'hover:-translate-y-3 hover:scale-[1.03]',
        'cursor-pointer',
        themeClasses.card
      )}
      style={themedCardStyle}
      aria-label={`Product: ${product.name}`}
      onClick={handleCardClick}
    >

      {/* Wishlist Button */}
      {!hideWishlist && (
        <button
          onClick={toggleWishlist}
          className={cn(
            'absolute top-2 right-2 z-10 p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-black/40 hover:bg-black/55 border border-white/10 shadow-md backdrop-blur-sm transition-all duration-300',
            'h-7 w-7 sm:h-9 sm:w-9 md:h-10 md:w-10 flex items-center justify-center',
            wishlistActionLoading || isWishlistLoading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-110',
            isWishlisted ? 'text-red-500' : 'text-gray-600'
          )}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          disabled={isSold || wishlistActionLoading || isWishlistLoading}
          aria-busy={wishlistActionLoading}
        >
          {wishlistActionLoading || isWishlistLoading ? (
            <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 animate-spin" />
          ) : (
            <Heart className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5', isWishlisted ? 'fill-current' : '')} />
          )}
        </button>
      )}

      {/* Product Image — always renders, shows placeholder when no image */}
      <div className="relative overflow-hidden rounded-t-lg sm:rounded-t-xl">
        {(product.product_type === 'digital' || (product as any).productType === 'digital' || product.is_digital || (product as any).isDigital) && (
          <div className="absolute top-2 left-2 z-10">
            <Badge className="bg-red-600 hover:bg-red-700 text-white border-0 backdrop-blur-sm shadow-sm">
              <FileText className="h-3 w-3 mr-1" />
              Digital
            </Badge>
          </div>
        )}

        {(product.product_type === 'service' || (product as any).productType === 'service') && (
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
            <Badge className="bg-purple-500/90 hover:bg-purple-600/90 text-white border-0 backdrop-blur-sm shadow-sm">
              <Handshake className="h-3 w-3 mr-1" />
              Service
            </Badge>
            {(product.service_options?.location_type === 'hybrid' || (product as any).serviceOptions?.location_type === 'hybrid') && (
              <Badge className="bg-blue-500/90 hover:bg-blue-600/90 text-white border-0 backdrop-blur-sm shadow-sm">
                Hybrid
              </Badge>
            )}
          </div>
        )}

        {/* Out of Stock Badge */}
        {isOutOfStock && (
          <div className="absolute top-2 right-2 z-10">
            <Badge className="bg-[#000000] text-red-500 border-2 border-red-500 font-bold backdrop-blur-sm shadow-lg animate-pulse">
              SOLD OUT
            </Badge>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-[1]" />

        <ProductImage
          src={product.image_url}
          alt={product.name}
          className="w-full h-40 sm:h-56 md:h-64 lg:h-72 transition-transform duration-700 group-hover:scale-105"
        />
      </div>

      <CardContent className="p-2 sm:p-3 md:p-4 lg:p-5">
        <h3 className={cn("font-bold mb-1 sm:mb-1.5 line-clamp-1 mobile-text-lg antialiased",
          (theme === 'black' || forceWhiteText) ? 'text-white' : 'text-black'
        )}>
          {product.name}
        </h3>
        <p className={cn("font-black mobile-text-lg mb-1 sm:mb-1.5 flex items-center gap-1.5 sm:gap-2",
          (product.product_type === 'service' || (product as any).productType === 'service')
            ? 'text-purple-600'
            : (forceWhiteText && theme === 'default') ? 'text-yellow-400' : themeClasses.price
        )}>
          {(product.product_type === 'digital' || (product as any).productType === 'digital' || product.is_digital || (product as any).isDigital) ? (
            <span className="text-red-600">
              {formatCurrency(product.price)}
            </span>
          ) : (
            formatCurrency(product.price)
          )}
          {(product.product_type === 'service' || (product as any).productType === 'service') && (product.service_options?.price_type === 'hourly' || (product as any).serviceOptions?.price_type === 'hourly') && (
            <span className="text-sm font-medium text-gray-300 ml-1">/hr</span>
          )}
        </p>

        {product.description && (
          <p className={cn("mobile-text leading-snug mb-1.5 sm:mb-2 line-clamp-2",
            (theme === 'black' || forceWhiteText) ? 'text-gray-300' : 'text-gray-700'
          )}>
            {product.description}
          </p>
        )}

        {/* Service Location Info */}
        {(product.product_type === 'service' || (product as any).productType === 'service') && (
          <div className={cn("flex items-start gap-1.5 mb-2 text-xs",
            (theme === 'black' || forceWhiteText) ? 'text-gray-300' : 'text-gray-700'
          )}>
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="line-clamp-2">
              {(product.service_options?.location_type === 'seller_visits_buyer' || (product as any).serviceOptions?.location_type === 'seller_visits_buyer') ? (
                "Mobile Service"
              ) : (product.service_options?.location_type === 'hybrid' || (product as any).serviceOptions?.location_type === 'hybrid') ? (
                "In-store & Mobile"
              ) : (
                product.service_locations || (product as any).serviceLocations || "In-store"
              )}
            </span>
          </div>
        )}

        {/* Seller Info */}
        <div className={cn("flex items-center gap-1 sm:gap-1.5 pt-1.5 sm:pt-2 border-t mt-1.5 sm:mt-2",
          (theme === 'black' || forceWhiteText) ? 'border-gray-800' : 'border-gray-100'
        )}>
          <Store className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", themeClasses.icon)} />
          <span className={cn("mobile-text font-bold tracking-tight truncate flex-1 opacity-90",
            (theme === 'black' || forceWhiteText) ? 'text-gray-300' : 'text-gray-800'
          )}>{displaySellerName}</span>
          {displaySeller?.physicalAddress && (
            <div onClick={(e) => e.stopPropagation()}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-6 px-2 text-[10px] font-bold gap-1 transition-all duration-300",
                      "bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border-[var(--theme-accent)]/20 hover:bg-[var(--theme-accent)]/20 shadow-sm"
                    )}
                  >
                    <Store className="w-3 h-3" />
                    Visit Shop
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0 shadow-xl border-green-100 overflow-hidden z-50">
                  <div className="bg-green-50/50 p-3 border-b border-green-100">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="bg-green-100 p-1.5 rounded-full">
                        <MapPin className="w-4 h-4 text-green-700" />
                      </div>
                      <span className="font-semibold text-green-900 text-sm">Physical Store</span>
                    </div>
                  </div>
                  <div className="p-3 bg-white space-y-3">
                    <div className="text-sm text-gray-600 leading-relaxed">
                      {displaySeller.physicalAddress}
                    </div>

                    <Button
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 text-xs h-8"
                      onClick={() => {
                        // Open Google Maps
                        const query = encodeURIComponent(displaySeller.physicalAddress || '');
                        if (displaySeller.latitude && displaySeller.longitude) {
                          window.open(`https://www.google.com/maps/search/?api=1&query=${displaySeller.latitude},${displaySeller.longitude}`, '_blank');
                        } else {
                          window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                        }
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Get Directions
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {/* Buy Button */}
        <Button
          variant="default"
          size="default"
          className={cn(
            'button-mobile w-full font-semibold transition-colors mt-2 sm:mt-2.5',
            'focus-visible:ring-2 focus-visible:ring-offset-2',
            'flex items-center justify-center gap-1.5 sm:gap-2',
            'disabled:opacity-50 disabled:pointer-events-none',
            isSold
              ? 'bg-gray-400 hover:bg-gray-400'
              : (product.product_type === 'service' || (product as any).productType === 'service')
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : (product.product_type === 'digital' || (product as any).productType === 'digital' || product.is_digital || (product as any).isDigital)
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : themeClasses.button,
            (product.product_type !== 'service' && (product as any).productType !== 'service' && product.product_type !== 'digital' && (product as any).productType !== 'digital' && !product.is_digital && !(product as any).isDigital) && themeClasses.button
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.nativeEvent) {
              e.nativeEvent.stopImmediatePropagation();
            }
            handleBuyClick(e);
          }}
          disabled={isSold || isProcessingPurchase}
          aria-busy={isProcessingPurchase}
        >
          {isProcessingPurchase ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              {(product.product_type === 'service' || (product as any).productType === 'service') ? (
                <Calendar className="h-4 w-4" />
              ) : (product.product_type === 'digital' || (product as any).productType === 'digital' || product.is_digital || (product as any).isDigital) ? (
                <FileText className="h-4 w-4" />
              ) : (
                <ShoppingCart className="h-4 w-4" />
              )}
              <span>
                {isSold
                  ? 'Sold Out'
                  : (product.product_type === 'service' || (product as any).productType === 'service')
                    ? 'Book Now'
                    : (product.product_type === 'digital' || (product as any).productType === 'digital' || product.is_digital || (product as any).isDigital)
                      ? 'Download Now'
                      : 'Buy Now'}
              </span>
            </>
          )}
        </Button>
      </CardContent>

      {/* Image/Preview Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-4xl mx-auto max-h-[90vh] flex flex-col p-2 sm:p-6 bg-[#111] sm:bg-background border-white/10 border sm:border-border rounded-xl">
          <DialogHeader className="pr-8 px-2 sm:px-0 mt-2 sm:mt-0">
            <DialogTitle className="text-sm sm:text-base flex items-center gap-2 text-white sm:text-foreground">
              {(product.product_type === 'digital' || (product as any).productType === 'digital') && (
                <FileText className="h-4 w-4 text-red-500" />
              )}
              {((product.product_type === 'digital' || (product as any).productType === 'digital') && product.images && product.images.length > 0)
                ? `Document Preview: ${product.name}`
                : product.name
              }
            </DialogTitle>
          </DialogHeader>
          <div className="absolute right-4 top-4">
            {/* The Dialog component automatically renders a generic close button, but we can style children or use DialogPrimitive.Close if we need more control. 
                 Since we can't easily override the internal DialogContent close button without modifying the UI library component globally, 
                 we can use the DialogClose exported from the library. */}
          </div>
          {/* We'll use CSS to target the internal close button since we don't want to change the global ui/dialog.tsx component. */}
          <style>{`
            div[role="dialog"] button.absolute.right-4.top-4 {
              color: rgba(250, 204, 21, 1); /* text-yellow-400 */
              opacity: 1;
              background: rgba(0,0,0,0.5);
              padding: 4px;
              border-radius: 50%;
            }
            div[role="dialog"] button.absolute.right-4.top-4:hover {
              color: rgba(234, 179, 8, 1); /* text-yellow-500 */
              background-color: rgba(250, 204, 21, 0.2);
            }
          `}</style>

          <div className="flex-1 w-full overflow-hidden flex flex-col justify-center min-h-[50vh] relative group/modal">
            <div className="flex items-center justify-center w-full p-2 sm:p-4 pb-4">
              {allImages.length > 0 && (
                <div className="relative w-full max-w-2xl bg-black/20 sm:bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                  <img
                    src={getImageUrl(allImages[currentImageIndex])}
                    alt={`${product.name} - Image ${currentImageIndex + 1}`}
                    className="max-w-full w-full h-auto max-h-[75vh] object-contain rounded-lg shadow-sm transition-opacity duration-300"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNjAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2QwZDBkMCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWltYWdlIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg==';
                    }}
                  />

                  {allImages.length > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover/modal:opacity-100 transition-opacity"
                        onClick={handlePrevImage}
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover/modal:opacity-100 transition-opacity"
                        onClick={handleNextImage}
                      >
                        <ChevronRight className="h-6 w-6" />
                      </Button>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {allImages.map((_, idx) => (
                          <div
                            key={idx}
                            className={`h-1.5 rounded-full transition-all ${idx === currentImageIndex ? 'w-4 bg-yellow-400' : 'w-1.5 bg-white/50'}`}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {((product.product_type === 'digital' || (product as any).productType === 'digital') && allImages.length > 0) && (
                    <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1.5 text-sm rounded-full backdrop-blur-md">
                      Page {currentImageIndex + 1} of {allImages.length}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Buyer Information Modal */}
      <PhoneCheckModal
        isOpen={isPhoneCheckModalOpen}
        onClose={() => setIsPhoneCheckModalOpen(false)}
        onPhoneSubmit={handlePhoneSubmit}
        isLoading={isCheckingPhone}
      />

      <BuyerInfoModal
        isOpen={isBuyerModalOpen}
        onClose={() => setIsBuyerModalOpen(false)}
        onSubmit={async (buyerInfo) => {
          await handleBuyerInfoSubmit(buyerInfo, null, shouldSkipSave);
        }}
        isLoading={isProcessingPurchase}
        theme={theme}
        phoneNumber={currentPhone}
        initialData={initialBuyerData}
      />

      <ServiceBookingModal
        product={product}
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        onConfirm={handleBookingConfirm}
      />
    </Card>
  );
}
