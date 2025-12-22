import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Store, Image as ImageIcon, X, Heart, Loader2, ShoppingCart, Phone, FileText, Handshake, Calendar } from 'lucide-react';
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

type Theme = 'default' | 'black' | 'pink' | 'orange' | 'green' | 'red' | 'yellow';


interface ProductCardProps {
  product: Product;
  seller?: Seller;
  hideWishlist?: boolean;
  theme?: Theme;
}


export function ProductCard({ product, seller, hideWishlist = false, theme = 'default' }: ProductCardProps) {
  const { toast } = useToast();
  // Safely use wishlist context
  let wishlistContext = null;

  try {
    wishlistContext = useWishlist?.();
  } catch (error) {
    // If useWishlist throws an error, use null
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

  // Loading states
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [wishlistActionLoading, setWishlistActionLoading] = useState(false);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  // Derived state
  const displaySeller = seller || product.seller;
  const displaySellerName = displaySeller?.shopName || displaySeller?.fullName || 'Unknown Shop';
  const sellerLocation = displaySeller?.location;
  const isSold = product.status === 'sold' || product.isSold;

  const hasContactInfo = Boolean(
    displaySeller?.phone ||
    displaySeller?.email ||
    displaySeller?.website ||
    sellerLocation
  );

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
    // Don't open image dialog if clicking on interactive elements
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
  let isLoading = false;

  try {
    const buyerAuth = useBuyerAuth?.();
    isAuthenticated = buyerAuth?.isAuthenticated || false;
    userData = buyerAuth?.user || null;
    isLoading = buyerAuth?.isLoading || false;
  } catch (error) {
    // If useBuyerAuth throws an error, use default values
    console.warn('ProductCard: BuyerAuth not available');
  }

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingData, setBookingData] = useState<{ date: Date; time: string; location: string } | null>(null);

  const handleBuyClick = async (e: React.MouseEvent) => {
    // Prevent default behavior and stop propagation
    e?.preventDefault?.();
    e?.stopPropagation?.();
    e?.nativeEvent?.stopImmediatePropagation?.();

    // Check if it's a service product
    if (product.product_type === 'service' || (product as any).productType === 'service') {
      setIsBookingModalOpen(true);
      return;
    }

    // Check if user is authenticated with complete information
    if (isAuthenticated && userData?.phone && userData?.fullName && userData?.email) {
      // User has complete information, proceed directly with payment
      await handleBuyerInfoSubmit({
        fullName: userData.fullName,
        email: userData.email,
        phone: userData.phone,
        city: userData.city,
        location: userData.location
      });
    } else {
      // Show phone check modal to verify if buyer exists
      setIsPhoneCheckModalOpen(true);
    }
  };

  const handleBookingConfirm = async (data: { date: Date; time: string; location: string }) => {
    setBookingData(data);
    setIsBookingModalOpen(false);

    // Proceed to payment flow after booking details are collected
    // Check if user is authenticated with complete information
    if (isAuthenticated && userData?.phone && userData?.fullName && userData?.email) {
      await handleBuyerInfoSubmit({
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

      const result = await buyerApi.checkBuyerByPhone(phone);

      setCurrentPhone(phone);
      setIsPhoneCheckModalOpen(false);

      if (result.exists && result.buyer && result.token) {
        // Buyer exists - use their data to initiate payment


        // Store token if provided
        if (result.token) {
          localStorage.setItem('buyer_token', result.token);
        }

        // Proceed directly to payment with existing buyer info
        await handleBuyerInfoSubmit({
          fullName: result.buyer.fullName || '',
          email: result.buyer.email || '',
          phone: result.buyer.phone || phone,
          city: result.buyer.city,
          location: result.buyer.location
        });
      } else {
        // Buyer doesn't exist - show form to collect full details

        setIsBuyerModalOpen(true);
      }
    } catch (error: any) {
      console.error('Error checking phone:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to check phone number. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsCheckingPhone(false);
    }
  };

  const handleBuyerInfoSubmit = async (
    buyerInfo: { fullName: string; email: string; phone: string; city?: string; location?: string },
    explicitBookingData?: { date: Date; time: string; location: string } | null
  ) => {
    setIsProcessingPurchase(true);

    try {
      console.debug('Buyer Info:', buyerInfo);

      // 1. Check if user is already authenticated
      let buyerId: string;
      let buyerToken: string;

      if (isAuthenticated && userData?.id) {
        // User is already authenticated, use their existing buyer ID
        buyerId = String(userData.id);
        buyerToken = localStorage.getItem('buyer_token') || '';


      } else {
        // User is not authenticated, save buyer info first
        try {
          const saveResult = await buyerApi.saveBuyerInfo(buyerInfo);

          if (saveResult.requiresLogin) {
            toast({
              title: "Account Exists",
              description: "This phone number is already registered. Please log in to complete your purchase.",
              variant: "default",
            });
            setTimeout(() => {
              window.location.href = '/buyer/login';
            }, 2000);
            return;
          }

          if (!saveResult.buyer?.id) {
            throw new Error('Failed to create buyer account');
          }

          buyerId = String(saveResult.buyer.id);
          buyerToken = saveResult.token || '';

          // Store token if provided (for new buyer)
          if (buyerToken) {
            localStorage.setItem('buyer_token', buyerToken);
          }



        } catch (saveError) {
          console.error('Error saving buyer info:', saveError);
          throw new Error('Failed to save buyer information. Please try again.');
        }
      }

      // Determine booking data to use (explicit argument takes precedence over state)
      const activeBookingData = explicitBookingData || bookingData;

      // 2. Prepare payment payload for Paystack product payment
      const payload = {
        phone: buyerInfo.phone,
        email: buyerInfo.email,
        amount: product.price,
        productId: product.id,
        sellerId: product.sellerId || displaySeller?.id,
        productName: product.name,
        customerName: buyerInfo.fullName,
        narrative: `Purchase of ${product.name}`,
        paymentMethod: 'paystack',
        metadata: activeBookingData ? {
          booking_date: format(activeBookingData.date, 'yyyy-MM-dd'),
          booking_time: activeBookingData.time,
          service_location: activeBookingData.location,
          product_type: 'service'
        } : undefined
      };

      console.debug('Payment Request:', { payload });

      // 3. Get authentication token
      const token = localStorage.getItem('buyer_token');
      if (!token && buyerToken) {
        localStorage.setItem('buyer_token', buyerToken);
      }

      // 4. Call Paystack product payment API
      const isDevelopment = import.meta.env.DEV;
      const baseURL = isDevelopment && !import.meta.env.VITE_API_URL
        ? '/api'  // Use proxy in development when VITE_API_URL is not set
        : (import.meta.env.VITE_API_URL || 'http://localhost:3002').replace(/\/$/, '');

      const response = await fetch(`${baseURL}/payments/initiate-product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || buyerToken}`
        },
        body: JSON.stringify(payload),
      });

      // 5. Handle API response
      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage = responseData.message || 'Failed to initiate payment';
        console.error('Payment API Error:', { status: response.status, responseData });
        throw new Error(errorMessage);
      }

      // Extract redirect URL from Paystack response
      const redirectUrl = responseData.data?.authorization_url;

      if (!redirectUrl) {
        console.error('Invalid response format from payment gateway:', responseData);
        throw new Error('Invalid response from payment gateway');
      }

      // 6. Redirect to Paystack payment page
      console.debug('Redirecting to Paystack:', redirectUrl);
      window.location.href = redirectUrl;

    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: 'Payment Failed',
        description: error.message || 'Failed to process your payment. Please try again.',
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setIsProcessingPurchase(false);
    }
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
    >
      {/* Wishlist Button */}
      {!hideWishlist && (
        <button
          onClick={toggleWishlist}
          className={cn(
            'absolute top-2 right-2 sm:top-4 sm:right-4 z-10 p-2 rounded-xl sm:rounded-2xl bg-white/90 hover:bg-white shadow-lg backdrop-blur-sm transition-all duration-300',
            'h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center',
            wishlistActionLoading || isWishlistLoading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-110',
            isWishlisted ? 'text-red-500' : 'text-gray-600'
          )}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          disabled={isSold || wishlistActionLoading || isWishlistLoading}
          aria-busy={wishlistActionLoading}
        >
          {wishlistActionLoading || isWishlistLoading ? (
            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
          ) : (
            <Heart className={cn('h-4 w-4 sm:h-5 sm:w-5', isWishlisted ? 'fill-current' : '')} />
          )}
        </button>
      )}

      {/* Image */}
      <div className="relative overflow-hidden rounded-t-xl sm:rounded-t-2xl">
        {(product.product_type === 'digital' || (product as any).productType === 'digital' || product.is_digital || (product as any).isDigital) && (
          <div className="absolute top-2 left-2 z-10">
            <Badge className="bg-black/90 hover:bg-gray-900/90 text-white border-0 backdrop-blur-sm shadow-sm">
              <FileText className="h-3 w-3 mr-1" />
              Digital
            </Badge>
          </div>
        )}

        {(product.product_type === 'service' || (product as any).productType === 'service') && (
          <div className="absolute top-2 left-2 z-10">
            <Badge className="bg-purple-500/90 hover:bg-purple-600/90 text-white border-0 backdrop-blur-sm shadow-sm">
              <Handshake className="h-3 w-3 mr-1" />
              Service
            </Badge>
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
            'w-full h-40 sm:h-48 lg:h-56 object-cover transition-transform duration-500 group-hover:scale-110',
            isImageLoading ? 'opacity-0' : 'opacity-100'
          )}
          onLoad={handleImageLoad}
          onError={handleImageError}
          onClick={(e) => {
            e.stopPropagation();
            setIsImageDialogOpen(true);
          }}
        />
      </div>

      <CardContent className="p-4 sm:p-6">
        <h3 className={cn("font-bold mb-2 line-clamp-1 text-sm sm:text-base lg:text-lg",
          theme === 'black' ? 'text-white' : 'text-gray-900'
        )}>
          {product.name}
        </h3>
        <p className={cn("font-black text-lg sm:text-xl mb-2 sm:mb-3 flex items-center gap-2",
          (product.product_type === 'service' || (product as any).productType === 'service')
            ? 'text-purple-600'
            : themeClasses.price
        )}>
          {(product.product_type === 'digital' || (product as any).productType === 'digital' || product.is_digital || (product as any).isDigital) ? (
            <span className="bg-black text-white px-2 py-0.5 rounded-md text-base sm:text-lg">
              {formatCurrency(product.price)}
            </span>
          ) : (
            formatCurrency(product.price)
          )}
          {(product.product_type === 'service' || (product as any).productType === 'service') && product.service_options?.price_type === 'hourly' && (
            <span className="text-sm font-medium text-gray-500 ml-1">/hr</span>
          )}
        </p>

        {product.description && (
          <p className={cn("text-xs sm:text-sm line-clamp-2 leading-relaxed mb-3 sm:mb-4", themeClasses.description)}>
            {product.description}
          </p>
        )}

        {/* Seller Info */}
        <div className={cn("flex items-center gap-2 pt-2 border-t mt-3",
          theme === 'black' ? 'border-gray-800' : 'border-gray-100'
        )}>
          <Store className={cn("h-4 w-4", themeClasses.icon)} />
          <span className={cn("text-sm font-medium truncate flex-1", themeClasses.seller)}>{displaySellerName}</span>
        </div>

        {/* Buy Button */}
        <Button
          variant="default"
          size="default"
          className={cn(
            'w-full font-semibold transition-colors mt-3',
            'focus-visible:ring-2 focus-visible:ring-offset-2',
            'flex items-center justify-center space-x-2',
            'disabled:opacity-50 disabled:pointer-events-none',
            isSold
              ? 'bg-gray-400 hover:bg-gray-400'
              : (product.product_type === 'service' || (product as any).productType === 'service')
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : (product.product_type === 'digital' || (product as any).productType === 'digital' || product.is_digital || (product as any).isDigital)
                  ? 'bg-black hover:bg-gray-800 text-white'
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

      {/* Image Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="sm:max-w-4xl mx-4">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base">
              {product.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <img
              src={product.image_url}
              alt={product.name}
              className="max-w-full max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh] object-contain rounded-lg"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNjAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2QwZDBkMCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWltYWdlIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg==';
              }}
            />
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
          });
        }}
        isLoading={isProcessingPurchase}
        theme={theme}
        phoneNumber={currentPhone}
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

