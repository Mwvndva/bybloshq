import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Store, FileText, Handshake, Calendar, MapPin, Loader2, Heart, ShoppingCart, ExternalLink } from 'lucide-react';
import { useGlobalAuth } from '@/contexts/GlobalAuthContext';
import { Product, Seller } from '@/types';
import { useWishlist } from '@/contexts/WishlistContext';
import { cn, formatCurrency, isSellerShopless, formatFileSize } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { ServiceBookingModal } from '@/components/ServiceBookingModal';
import { PaymentStatusModal } from '@/components/PaymentStatusModal';
import { useNavigate } from 'react-router-dom';
import ProductImage from '@/components/common/ProductImage';
import { useAsyncLock } from '@/hooks/useAsyncLock';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { usePaymentFlow } from '@/flows/payment.flow';
import { useBookingFlow } from '@/flows/booking.flow';

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
  const { user: userData, isAuthenticated } = useGlobalAuth();
  const { requireAuth } = useRequireAuth();
  const { initiatePayment, isProcessing: isProcessingPayment } = usePaymentFlow();
  const { isBookingModalOpen, openBookingModal, closeBookingModal, handleBookingConfirm: confirmBooking } = useBookingFlow();

  const wishlistContext = useWishlist();
  const addToWishlist = wishlistContext.addToWishlist;
  const isInWishlist = wishlistContext.isInWishlist;
  const isWishlistLoading = wishlistContext.isLoading;

  // Visual/UI states
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [wishlistActionLoading, setWishlistActionLoading] = useState(false);

  const [paymentModalData, setPaymentModalData] = useState<{
    isOpen: boolean;
    orderNumber: string | null;
    invoiceId: string | null;
    isGuest: boolean;
    email?: string;
  }>({ isOpen: false, orderNumber: null, invoiceId: null, isGuest: false });

  // Types & Derived State
  const isDigital = product.product_type === 'digital' || (product as any).productType === 'digital' || product.is_digital || (product as any).isDigital;
  const isService = product.product_type === 'service' || (product as any).productType === 'service';
  const isHybrid = isService && (product.service_options?.location_type === 'hybrid' || (product as any).serviceOptions?.location_type === 'hybrid');

  const { runWithLock, isLocked } = useAsyncLock();
  const isMounted = useRef(true);

  // Derived state
  const displaySeller = seller || product.seller;
  const displaySellerName = displaySeller?.shopName || displaySeller?.fullName || 'Unknown Shop';

  // Check if product is out of stock (inventory tracking)
  const isOutOfStock = (product as any).track_inventory === true && ((product as any).quantity === 0 || (product as any).quantity === null);
  const isSold = product.status === 'sold' || product.isSold || isOutOfStock;
  const isWishlisted = isInWishlist(product.id);

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isWishlistLoading || wishlistActionLoading || isSold) return;

    requireAuth(async () => {
      setWishlistActionLoading(true);
      try {
        if (isWishlisted) {
          await wishlistContext.removeFromWishlist(product.id);
        } else {
          await addToWishlist(product);
        }
      } catch (error: any) {
        console.error('Wishlist toggle error:', error);
      } finally {
        setWishlistActionLoading(false);
      }
    }, "Please sign in to add items to your wishlist.");
  };

  const handleBuyClick = async (e?: React.MouseEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (isSold) return;

    requireAuth(async () => {
      if (isService) {
        openBookingModal();
      } else {
        await runWithLock(async () => {
          await executePayment(userData);
        });
      }
    }, "Secure Purchase: Please provide your details once to proceed with your order.");
  };

  const handleBookingConfirm = async (data: any) => {
    const bookingResults = confirmBooking(data);
    if (isAuthenticated) {
      await runWithLock(async () => {
        await executePayment(userData, bookingResults);
      });
    }
  };

  const executePayment = async (buyerDetails: any, bookingDetails: any = null) => {
    const result = await initiatePayment(product, {
      fullName: buyerDetails.fullName,
      email: buyerDetails.email,
      mobilePayment: buyerDetails.mobilePayment || buyerDetails.phone,
      city: buyerDetails.city,
      location: buyerDetails.location
    }, bookingDetails);

    if (result?.orderNumber) {
      setPaymentModalData({
        isOpen: true,
        orderNumber: result.orderNumber,
        invoiceId: String(result.orderId || result.orderNumber),
        isGuest: false,
        email: buyerDetails.email
      });
    }
  };

  const themedCardStyle: React.CSSProperties = {
    background: 'var(--theme-card-bg, rgba(17, 17, 17, 0.7))',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--theme-border, rgba(255, 255, 255, 0.1))',
    color: 'var(--theme-text, white)',
    boxShadow: '0 4px 24px -1px rgba(0, 0, 0, 0.2), 0 0 0 1px var(--theme-border, rgba(255, 255, 255, 0.1))'
  };

  const getThemeClasses = () => {
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
          seller: 'text-gray-800 opacity-80',
          description: (theme === 'yellow' || theme === 'orange') ? 'text-gray-800' : 'text-gray-100',
          icon: 'text-[var(--theme-accent)]',
        };
      default:
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
        'group relative overflow-hidden transition-all duration-700 backdrop-blur-md border-0 rounded-2xl sm:rounded-[2rem]',
        isSold ? 'opacity-60' : 'sm:hover:-translate-y-3 sm:hover:scale-[1.03]',
        'cursor-pointer',
        themeClasses.card
      )}
      style={themedCardStyle}
      aria-label={`Product: ${product.name}`}
      onClick={(e) => e.stopPropagation()}
    >
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
        >
          {wishlistActionLoading || isWishlistLoading ? (
            <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 animate-spin" />
          ) : (
            <Heart className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5', isWishlisted ? 'fill-current' : '')} />
          )}
        </button>
      )}

      <div className="relative overflow-hidden rounded-t-lg sm:rounded-t-xl">
        {isDigital && (
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
            <Badge className="bg-red-600 hover:bg-red-700 text-white border-0 backdrop-blur-sm shadow-md">
              <FileText className="h-3 w-3 mr-1" />
              Digital
            </Badge>
            {product.digital_file_size && (
              <Badge className="bg-black/60 text-white border-0 text-[10px] py-0.5 px-2 backdrop-blur-md rounded-full">
                {formatFileSize(product.digital_file_size)}
              </Badge>
            )}
          </div>
        )}

        {isService && (
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
            <Badge className="bg-purple-500/90 hover:bg-purple-600/90 text-white border-0 backdrop-blur-sm shadow-md">
              <Handshake className="h-3 w-3 mr-1" />
              Service
            </Badge>
            {isHybrid && (
              <Badge className="bg-blue-500/90 hover:bg-blue-600/90 text-white border-0 backdrop-blur-sm shadow-md">
                Hybrid
              </Badge>
            )}
          </div>
        )}

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
          className="w-full aspect-[3/4] transition-transform duration-700 sm:group-hover:scale-105"
        />
      </div>

      <CardContent className="p-2 sm:p-3 md:p-4 lg:p-5">
        <h3 className={cn("font-bold mb-1 sm:mb-1.5 line-clamp-1 h-6 sm:h-6 text-base sm:text-base antialiased",
          (theme === 'black' || forceWhiteText) ? 'text-white' : 'text-black'
        )}>
          {product.name}
        </h3>
        <p className={cn("font-black text-base sm:text-base mb-1 sm:mb-1.5 flex items-center gap-1.5 sm:gap-2",
          (product.product_type === 'service' || (product as any).productType === 'service')
            ? 'text-purple-600'
            : (forceWhiteText && theme === 'default') ? 'text-yellow-400' : themeClasses.price
        )}>
          {isDigital ? (
            <span className="text-red-600">
              {formatCurrency(product.price)}
            </span>
          ) : (
            formatCurrency(product.price)
          )}
          {isService && (product.service_options?.price_type === 'hourly' || (product as any).serviceOptions?.price_type === 'hourly') && (
            <span className="text-sm font-medium text-gray-300 ml-1">/hr</span>
          )}
        </p>

        {product.description && (
          <div className="relative group/desc h-10 overflow-y-auto no-scrollbar mb-1.5 sm:mb-2 overscroll-contain">
            <p className={cn("mobile-text leading-tight text-[11px] sm:text-xs min-h-full",
              (theme === 'black' || forceWhiteText) ? 'text-gray-300' : 'text-gray-700'
            )}>
              {product.description}
            </p>
          </div>
        )}

        {isService && (
          <div className={cn("flex items-start gap-1.5 mb-2 text-xs",
            (theme === 'black' || forceWhiteText) ? 'text-gray-300' : 'text-gray-700'
          )}>
            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="line-clamp-2 text-sm">
              {(product.service_options?.location_type === 'seller_visits_buyer' || (product as any).serviceOptions?.location_type === 'seller_visits_buyer') ? (
                "Mobile Service"
              ) : (product.service_options?.location_type === 'hybrid' || (product as any).serviceOptions?.location_type === 'hybrid') ? (
                "In-store & Mobile"
              ) : (
                (isSellerShopless(displaySeller) ? "Mobile Service" : "In-store")
              )}
            </span>
          </div>
        )}

        <div className={cn("flex items-center gap-1 sm:gap-1.5 pt-1.5 sm:pt-2 border-t mt-1.5 sm:mt-2",
          (theme === 'black' || forceWhiteText) ? 'border-gray-800' : 'border-gray-100'
        )}>
          <Store className={cn("h-3.5 w-3.5 sm:h-3.5 sm:w-3.5", themeClasses.icon)} />
          <span
            className={cn("mobile-text font-bold tracking-tight truncate flex-1 opacity-90 cursor-pointer hover:underline text-sm sm:text-xs",
              (theme === 'black' || forceWhiteText) ? 'text-gray-300' : 'text-gray-800'
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (displaySeller?.shopName) {
                navigate(`/shop/${displaySeller.shopName}`);
              } else if (displaySeller?.id) {
                navigate(`/shop/${displaySeller.id}`);
              }
            }}
          >
            {displaySellerName}
          </span>
          <div className="shrink-0 flex items-center">
            {isSellerShopless(displaySeller) ? (
              <Badge variant="outline" className="h-4 px-1 text-[8px] border-zinc-500/30 text-zinc-400 bg-zinc-500/10 font-bold uppercase tracking-wider">
                Online Only
              </Badge>
            ) : (
              <Badge variant="outline" className="h-4 px-1 text-[8px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-bold uppercase tracking-wider">
                Physical Shop
              </Badge>
            )}
          </div>
          {displaySeller && !isSellerShopless(displaySeller) && (product.product_type !== 'digital' && !(product as any).isDigital) && (
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

        <Button
          variant="default"
          size="default"
          className={cn(
            'button-mobile w-full h-12 sm:h-10 font-bold transition-colors mt-3 sm:mt-2.5',
            'flex items-center justify-center gap-2 sm:gap-2 text-base sm:text-sm',
            isSold
              ? 'bg-gray-400 hover:bg-gray-400'
              : isService
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : isDigital
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : themeClasses.button
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleBuyClick(e);
          }}
          disabled={isSold || isLocked || isProcessingPayment}
        >
          {isLocked || isProcessingPayment ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              {isService ? (
                <Calendar className="h-4 w-4" />
              ) : isDigital ? (
                <FileText className="h-4 w-4" />
              ) : (
                <ShoppingCart className="h-4 w-4" />
              )}
              <span>{isSold ? 'Sold Out' : isService ? 'Book Now' : isDigital ? 'Download Now' : 'Buy Now'}</span>
            </>
          )}
        </Button>
      </CardContent>

      <ServiceBookingModal
        product={product}
        isOpen={isBookingModalOpen}
        onClose={closeBookingModal}
        onConfirm={handleBookingConfirm}
        initialBuyerLocation={null}
      />

      <PaymentStatusModal
        {...paymentModalData}
        onClose={() => setPaymentModalData(prev => ({ ...prev, isOpen: false }))}
      />
    </Card>
  );
}
