import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Store, Image as ImageIcon, FileText, Handshake, Calendar, MapPin, Loader2, Heart, ShoppingCart, ExternalLink } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { Product, Seller } from '@/types';
import { useWishlist } from '@/contexts/WishlistContext';
import { cn, formatCurrency } from '@/lib/utils';
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

type Theme = 'default' | 'black' | 'pink' | 'orange' | 'green' | 'red' | 'yellow';


interface ProductCardProps {
  product: Product;
  seller?: Seller;
  hideWishlist?: boolean;
  theme?: Theme;
}


export function ProductCard({ product, seller, hideWishlist = false, theme = 'default' }: ProductCardProps) {
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
  const isSold = product.status === 'sold' || product.isSold;
  const isWishlisted = isInWishlist(product.id);


  useEffect(() => {

  }, [product.id, isWishlisted]);

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
        phone: userData.phone,
        city: userData.city,
        location: userData.location
      });
    } else {
      // 3. Not Authenticated? -> Phone Check
      setIsPhoneCheckModalOpen(true);
    }
  };

  const handleBookingConfirm = async (data: { date: Date; time: string; location: string; locationType?: string }) => {
    setBookingData(data);
    setIsBookingModalOpen(false);

    if (isAuthenticated && userData?.phone && userData?.fullName && userData?.email) {
      await executePayment({
        fullName: userData.fullName,
        email: userData.email,
        phone: userData.phone,
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
            phone: result.buyer.phone || phone,
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
          setShouldSkipSave(true); // Don't try to register again, just valid email
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
    buyerInfo: { fullName: string; email: string; phone: string; city?: string; location?: string, password?: string },
    explicitBookingData?: any,
    isExistingUserUpdate: boolean = false
  ) => {
    try {
      // If it's a new user (not just updating email for existing), save them first
      if (!isExistingUserUpdate && !shouldSkipSave) {
        const saveResult = await buyerApi.saveBuyerInfo(buyerInfo);

        if (saveResult.requiresLogin) {
          window.location.href = '/buyer/login';
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
    buyerDetails: { fullName: string; email: string; phone: string; city?: string; location?: string },
    bookingDetails: any = null,
    buyerId?: string | number
  ) => {
    setIsProcessingPurchase(true);
    try {
      const activeBooking = bookingDetails || bookingData;
      const payload = {
        phone: buyerDetails.phone,
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
      console.error(error);
      toast({
        title: 'Payment Failed',
        description: error.message || 'Could not initiate payment.',
        variant: 'destructive'
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

          // Purge all old identification artifacts (Seller tokens, etc.)
          // before the new buyer session is taken into account by the dashboard.
          clearAllAuthData();

          toast({
            title: 'Payment Successful',
            description: 'Your purchase has been confirmed! Redirecting to your orders...',
            className: 'bg-green-600 text-white',
            duration: 5000
          });

          // **NAVIGATION**: Redirect to Orders Tab using full page reload to refresh session state
          setTimeout(() => {
            window.location.href = '/buyer/dashboard?section=orders';
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

  // Get theme classes based on the theme prop
  const themeClasses = (() => {
    switch (theme) {
      case 'black':
        return {
          card: 'bg-gray-900/80 text-white border-gray-800 hover:shadow-2xl hover:shadow-gray-900/20',
          price: 'text-yellow-400',
          button: 'bg-yellow-500 hover:bg-yellow-600 text-white',
          seller: 'text-gray-300',
          description: 'text-gray-300/80',
          icon: 'text-yellow-400',
        };
      case 'pink':
        return {
          card: 'bg-pink-50/90 border-pink-100 hover:shadow-2xl hover:shadow-pink-100',
          price: 'text-pink-600',
          button: 'bg-pink-600 hover:bg-pink-700 text-white',
          seller: 'text-pink-900',
          description: 'text-pink-900/80',
          icon: 'text-pink-600',
        };
      case 'orange':
        return {
          card: 'bg-orange-50/90 border-orange-100 hover:shadow-2xl hover:shadow-orange-100',
          price: 'text-orange-600',
          button: 'bg-orange-600 hover:bg-orange-700 text-white',
          seller: 'text-orange-900',
          description: 'text-orange-900/80',
          icon: 'text-orange-600',
        };
      case 'green':
        return {
          card: 'bg-green-50/90 border-green-100 hover:shadow-2xl hover:shadow-green-100',
          price: 'text-green-600',
          button: 'bg-green-600 hover:bg-green-700 text-white',
          seller: 'text-green-900',
          description: 'text-green-900/80',
          icon: 'text-green-600',
        };
      case 'red':
        return {
          card: 'bg-red-50/90 border-red-100 hover:shadow-2xl hover:shadow-red-100',
          price: 'text-red-600',
          button: 'bg-red-600 hover:bg-red-700 text-white',
          seller: 'text-red-900',
          description: 'text-red-900/80',
          icon: 'text-red-600',
        };
      case 'yellow':
        return {
          card: 'bg-yellow-50/90 border-yellow-100 hover:shadow-2xl hover:shadow-yellow-100',
          price: 'text-yellow-600',
          button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
          seller: 'text-yellow-900',
          description: 'text-yellow-900/80',
          icon: 'text-yellow-600',
        };
      default: // default theme
        return {
          card: 'bg-white/80 border-gray-100 hover:shadow-2xl hover:shadow-gray-100',
          price: 'text-yellow-600',
          button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
          seller: 'text-gray-900',
          description: 'text-gray-700/80',
          icon: 'text-gray-600',
        };
    }
  })();

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-500 backdrop-blur-sm border-0',
        isSold ? 'opacity-60' : 'hover:-translate-y-2',
        'cursor-pointer',
        themeClasses.card
      )}
      aria-label={`Product: ${product.name}`}
      onClick={handleCardClick}
    >
      {/* Wishlist Button */}
      {!hideWishlist && (
        <button
          onClick={toggleWishlist}
          className={cn(
            'absolute top-2 right-2 z-10 p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white/90 hover:bg-white shadow-md backdrop-blur-sm transition-all duration-300',
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

      {/* Image */}
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
        {isImageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <ImageIcon className="h-8 w-8 text-gray-300 animate-pulse" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <img
          src={product.image_url}
          alt={product.name}
          className={cn(
            'w-full h-32 sm:h-40 md:h-44 lg:h-48 object-cover transition-transform duration-500 group-hover:scale-110',
            isImageLoading ? 'opacity-0' : 'opacity-100'
          )}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      </div>

      <CardContent className="mobile-compact">
        <h3 className={cn("font-bold mb-1 sm:mb-1.5 line-clamp-1 mobile-text-lg",
          theme === 'black' ? 'text-white' : 'text-gray-900'
        )}>
          {product.name}
        </h3>
        <p className={cn("font-black mobile-text-lg mb-1 sm:mb-1.5 flex items-center gap-1.5 sm:gap-2",
          (product.product_type === 'service' || (product as any).productType === 'service')
            ? 'text-purple-600'
            : themeClasses.price
        )}>
          {(product.product_type === 'digital' || (product as any).productType === 'digital' || product.is_digital || (product as any).isDigital) ? (
            <span className="text-red-600">
              {formatCurrency(product.price)}
            </span>
          ) : (
            formatCurrency(product.price)
          )}
          {(product.product_type === 'service' || (product as any).productType === 'service') && (product.service_options?.price_type === 'hourly' || (product as any).serviceOptions?.price_type === 'hourly') && (
            <span className="text-sm font-medium text-gray-500 ml-1">/hr</span>
          )}
        </p>

        {product.description && (
          <p className={cn("mobile-text leading-snug mb-1.5 sm:mb-2 line-clamp-2", themeClasses.description)}>
            {product.description}
          </p>
        )}

        {/* Service Location Info */}
        {(product.product_type === 'service' || (product as any).productType === 'service') && (
          <div className={cn("flex items-start gap-1.5 mb-2 text-xs",
            theme === 'black' ? 'text-gray-400' : 'text-gray-500'
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
          theme === 'black' ? 'border-gray-800' : 'border-gray-100'
        )}>
          <Store className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", themeClasses.icon)} />
          <span className={cn("mobile-text font-medium truncate flex-1", themeClasses.seller)}>{displaySellerName}</span>
          {displaySeller?.hasPhysicalShop && (
            <div onClick={(e) => e.stopPropagation()}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-6 px-2 text-[10px] font-medium gap-1 ${theme === 'black'
                      ? 'bg-green-900/30 text-green-400 border-green-800/50 hover:bg-green-900/50'
                      : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                      } border transition-colors`}
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
        <DialogContent className="sm:max-w-4xl mx-4 max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base flex items-center gap-2">
              {(product.product_type === 'digital' || (product as any).productType === 'digital') && (
                <FileText className="h-4 w-4 text-red-500" />
              )}
              {(product.product_type === 'digital' || (product as any).productType === 'digital')
                ? `Document Preview: ${product.name}`
                : product.name
              }
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 p-1">
            <div className="flex flex-col gap-4 items-center">
              {/* If digital and has multiple images, show them all as "pages" */}
              {((product.product_type === 'digital' || (product as any).productType === 'digital') && product.images && product.images.length > 0) ? (
                product.images.map((img, idx) => (
                  <div key={idx} className="relative w-full max-w-2xl bg-gray-100 rounded-lg overflow-hidden shadow-sm">
                    <img
                      src={img}
                      alt={`${product.name} - Page ${idx + 1}`}
                      className="w-full h-auto object-contain"
                      loading="lazy"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 text-xs rounded-full backdrop-blur-sm">
                      Page {idx + 1}
                    </div>
                  </div>
                ))
              ) : (
                /* Default single image view */
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="max-w-full max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh] object-contain rounded-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNjAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2QwZDBkMCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWltYWdlIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg==';
                  }}
                />
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
          await handleBuyerInfoSubmit({
            ...buyerInfo,
            phone: currentPhone
          }, null, shouldSkipSave);
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
