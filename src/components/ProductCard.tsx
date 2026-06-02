import { useState, useRef, type CSSProperties, type MouseEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2, Heart } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/GlobalAuthContext';
import { Product, Seller } from '@/types';
import { useWishlist } from '@/contexts/WishlistContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import buyerApi from '@/api/buyerApi';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/lib/apiClient';
import { useAsyncLock } from '@/hooks/useAsyncLock';
import { ProductCardDetails } from '@/components/product-card/ProductCardDetails';
import { ProductCardMedia } from '@/components/product-card/ProductCardMedia';
import { ProductImageViewer } from '@/components/product-card/ProductImageViewer';
import { ProductCardModals } from '@/components/product-card/ProductCardModals';
import { createCheckoutAttemptToken, getProductCardThemeVars, getProductFlags, getThemeClasses, normalizePhone, type Theme } from '@/components/product-card/productCardUtils';
import type { DoorDeliverySelection } from '@/components/PhoneCheckModal';
import { toBuyerLocationPayload, type BuyerLocationPayload } from '@/lib/location';

const PRODUCT_SERVICE_CHARGE_RATE = 0.02;
const calculateProductServiceCharge = (amount: number) => Math.ceil(amount * PRODUCT_SERVICE_CHARGE_RATE * 100) / 100;
const calculateBuyerPayableTotal = (productAmount: number, deliveryFee = 0) => {
  return Math.ceil(Math.round((productAmount + deliveryFee + calculateProductServiceCharge(productAmount)) * 100) / 100);
};

const normalizeProductImages = (product: Product): string[] => {
  const rawImages = (product as any).images;
  const extraImages = Array.isArray(rawImages)
    ? rawImages
    : typeof rawImages === 'string'
      ? (() => {
        try {
          const parsed = JSON.parse(rawImages);
          return Array.isArray(parsed) ? parsed : [rawImages];
        } catch {
          return [rawImages];
        }
      })()
      : [];

  return [
    product.image_url,
    (product as any).imageUrl,
    ...extraImages
  ]
    .filter((image): image is string => typeof image === 'string' && image.trim().length > 0)
    .map(image => image.trim())
    .filter((image, index, allImages) => allImages.indexOf(image) === index);
};

interface ProductCardProps {
  product: Product;
  seller?: Seller;
  hideWishlist?: boolean;
  theme?: Theme;
  forceWhiteText?: boolean;
}


export function ProductCard({ product, seller, hideWishlist = false, theme, forceWhiteText = false }: ProductCardProps) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const wishlistContext = useWishlist();
  const { isAuthenticated } = useBuyerAuth();

  const addToWishlist = wishlistContext.addToWishlist;
  const isInWishlist = wishlistContext.isInWishlist;
  const isWishlistLoading = wishlistContext.isLoading;

  // Dialog state

  const [isPhoneCheckModalOpen, setIsPhoneCheckModalOpen] = useState(false);
  const [isBuyerModalOpen, setIsBuyerModalOpen] = useState(false);
  const [currentPhone, setCurrentPhone] = useState('');
  const [buyerId, setBuyerId] = useState<number | string | null>(null);
  const [initialBuyerData, setInitialBuyerData] = useState<{ fullName?: string; email?: string; city?: string; location?: string } | undefined>(undefined);
  const [shouldSkipSave, setShouldSkipSave] = useState(false);
  const [isBookingFlowActive, setIsBookingFlowActive] = useState(false);
  const [initialBuyerLocation, setInitialBuyerLocation] = useState<BuyerLocationPayload | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [forceCustomCheckout, setForceCustomCheckout] = useState(false);

  const { isDigital, isService, isPhysical, isHybrid, isOutOfStock, isSold } = getProductFlags(product);
  const cardTheme = (theme || seller?.theme || product.seller?.theme || 'default') as Theme;
  const productImages = normalizeProductImages(product);

  const [paymentModalData, setPaymentModalData] = useState<{
    isOpen: boolean;
    orderNumber: string | null;
    invoiceId: string | null;
    isGuest: boolean;
    email?: string;
    paymentSummary?: {
      productAmount?: number;
      deliveryFee?: number;
      serviceCharge?: number;
      totalAmount?: number;
    };
  }>({ isOpen: false, orderNumber: null, invoiceId: null, isGuest: false });

  // Loading states
  const [wishlistActionLoading, setWishlistActionLoading] = useState(false);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  // FIX (Task 14): Prevent duplicate payment triggers and race conditions
  const { runWithLock, isLocked } = useAsyncLock();

  const checkoutAttemptTokenRef = useRef<string | null>(null);
  const doorDeliverySelectionRef = useRef<DoorDeliverySelection | null>(null);
  const customInstructionsRef = useRef<string | null>(null);

  const getCheckoutAttemptToken = () => {
    if (!checkoutAttemptTokenRef.current) {
      checkoutAttemptTokenRef.current = createCheckoutAttemptToken(product.id);
    }
    return checkoutAttemptTokenRef.current;
  };

  // Derived state
  const displaySeller = seller || product.seller;
  const displaySellerName = displaySeller?.shopName || displaySeller?.fullName || 'Unknown Shop';
  const isCustomProduct = isPhysical && Boolean((product as any).is_custom_product || (product as any).isCustomProduct);
  const productionDays = Number((product as any).production_days || (product as any).productionDays || 0) || null;
  const customizationPrompt = (product as any).customization_prompt || (product as any).customizationPrompt || null;
  const isImportedProduct = isPhysical && Boolean((product as any).is_imported_product || (product as any).isImportedProduct);
  const importDays = Number((product as any).import_days || (product as any).importDays || 0) || null;
  const importNote = (product as any).import_note || (product as any).importNote || null;
  const effectiveIsCustomProduct = isCustomProduct || (isPhysical && forceCustomCheckout);
  const effectiveProductionDays = productionDays || (effectiveIsCustomProduct ? 1 : null);
  const effectiveCustomizationPrompt = customizationPrompt || 'Tell the seller exactly what you want customized.';
  const effectiveIsImportedProduct = isImportedProduct && !effectiveIsCustomProduct;
  const effectiveImportDays = importDays || (effectiveIsImportedProduct ? 14 : null);

  const isWishlisted = isInWishlist(product.id);
  const toggleWishlist = async (e: MouseEvent) => {
    e.stopPropagation();
    if (isWishlistLoading || wishlistActionLoading || isSold) return;
    setWishlistActionLoading(true);
    try {
      if (isWishlisted) {
        await wishlistContext.removeFromWishlist(product.id);
        // Toast is handled inside removeFromWishlist context method
      } else {
        await addToWishlist(product);
        // Toast is handled inside addToWishlist context method
      }
    } catch (error: any) {
      console.error('Wishlist toggle error:', error);
      // Errors are also handled with toasts in the context, 
      // but we log here just in case.
    } finally {
      setWishlistActionLoading(false);
    }
  };



  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingData, setBookingData] = useState<{ date: Date; time: string; location: string; locationType?: string } | null>(null);

  const handleBuyClick = async (e: MouseEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    // 1. Service Product + Not Authenticated? -> Verification First Flow
    if (isService && !isAuthenticated) {
      doorDeliverySelectionRef.current = null;
      setIsBookingFlowActive(true);
      setBookingData(null);
      setCurrentPhone('');
      setBuyerId(null);
      setIsPhoneCheckModalOpen(true);
      return;
    }

    // 2. Service Product + Authenticated? -> Booking Flow
    if (isService) {
      doorDeliverySelectionRef.current = null;
      setIsBookingFlowActive(true);
      setBookingData(null);
      setCurrentPhone('');
      setBuyerId(null);
      setIsBookingModalOpen(true);
      return;
    }

    // 3. Always confirm the payment number before starting STK Push.
    setIsBookingFlowActive(false);
    setBookingData(null);
    setCurrentPhone('');
    setBuyerId(null);
    doorDeliverySelectionRef.current = null;
    setIsPhoneCheckModalOpen(true);
  };

  const handleBookingConfirm = async (data: {
    date: Date;
    time: string;
    location: string;
    locationType?: string;
    serviceRequirements?: string;
    buyerLocation?: BuyerLocationPayload | null
  }) => {
    setBookingData(data);
    setIsBookingModalOpen(false);

    if (currentPhone && buyerId) {
      // CASE: Guest who just finished phone check (Task BUG-BOOK-04)
      await runWithLock(async () => {
        await executePayment({
          fullName: 'Guest',
          email: '',
          mobilePayment: currentPhone,
          city: data.location || '',
          location: data.location || ''
        }, data, buyerId);
      });
    } else {
      setIsBookingFlowActive(true);
      setIsPhoneCheckModalOpen(true);
    }
  };

  const handlePhoneSubmit = async (phone: string, delivery?: DoorDeliverySelection & { customInstructions?: string }) => {
    setIsCheckingPhone(true);
    try {
      doorDeliverySelectionRef.current = isPhysical && delivery?.doorDelivery ? delivery : null;
      customInstructionsRef.current = effectiveIsCustomProduct ? (delivery?.customInstructions || '').trim() : null;
      if (effectiveIsCustomProduct && !customInstructionsRef.current) {
        toast({
          title: 'Customization required',
          description: 'Please describe what you want customized before paying.',
          variant: 'destructive'
        });
        return;
      }
      // FIX (Task 21): Normalize phone number before checking status
      const normalizedPhone = normalizePhone(phone);
      const result = await buyerApi.checkBuyerByPhone(normalizedPhone);

      setCurrentPhone(normalizedPhone);
      setIsPhoneCheckModalOpen(false);

      if (result.exists && result.buyer) {
        // CASE A: Buyer Exists
        setCurrentPhone(normalizedPhone);
        setBuyerId(result.buyer.id);
        setIsPhoneCheckModalOpen(false);

        // If it's a booking flow, open ServiceBookingModal ONLY if we don't have booking data yet (Task BUG-BOOK-01)
        if (isBookingFlowActive && !bookingData) {
          if (result.buyer.latitude && result.buyer.longitude) {
            setInitialBuyerLocation({
              lat: Number(result.buyer.latitude),
              lng: Number(result.buyer.longitude),
              address: result.buyer.fullAddress || result.buyer.location || ''
            });
          } else {
            setInitialBuyerLocation(null);
          }
          setIsBookingModalOpen(true);
          return;
        }

        // Check hasEmail flag instead of explicit email string to avoid PII leak
        if (result.buyer.hasEmail || (result.buyer.email && result.buyer.email.trim() !== '')) {
          // Has Email -> PROCEED TO PAYMENT
          // We pass empty email if we only have the flag; backend will resolve it from DB
          await runWithLock(async () => {
            // Prevents duplicate payment requests via synchronous lock (Task 14)
            await executePayment({
              fullName: result.buyer!.fullName || '',
              email: result.buyer!.email || '', // Can be empty if we have hasEmail=true
              mobilePayment: result.buyer!.mobilePayment || normalizedPhone,
              city: result.buyer!.city,
              location: result.buyer!.location
            }, null, result.buyer!.id);
          });
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
        setCurrentPhone(normalizedPhone);
        setIsPhoneCheckModalOpen(false);

        if (isBookingFlowActive && !bookingData) {
          setInitialBuyerLocation(null);
          setIsBookingModalOpen(true);
        } else {
          setBuyerId(null); // Reset ID for new guest record if needed? 
          // Actually, checkBuyerByPhone for non-existent returns a fresh ID sometimes?
          // If not exists, we'll get it during registration/payment
          setInitialBuyerData(undefined);
          setShouldSkipSave(false);
          setIsBuyerModalOpen(true);
        }
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
    buyerInfo: any,
    explicitBookingData?: any,
    isExistingUserUpdate: boolean = false
  ) => {
    try {
      // FIX (Task 5): Merge booking coordinates into buyer profile if available
      const activeBooking = explicitBookingData || bookingData;
      const enrichedBuyerInfo = {
        ...buyerInfo,
        latitude: activeBooking?.buyerLocation?.lat, // Profile still uses latitude/longitude for legacy reasons
        longitude: activeBooking?.buyerLocation?.lng
      };

      // If it's a new user (not just updating email for existing), save them first
      if (!isExistingUserUpdate && !shouldSkipSave) {
        const saveResult = await buyerApi.saveBuyerInfo(enrichedBuyerInfo);

        if (saveResult.requiresLogin) {
          // Save current location for redirect after login
          sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
          navigate('/buyer/login', { replace: true });
          return;
        }


        // Proceed with new ID (or let backend infer from cookie)
        await runWithLock(async () => {
          // Prevents duplicate payment requests via synchronous lock (Task 14)
          await executePayment(enrichedBuyerInfo, explicitBookingData, saveResult.buyer?.id);
        });
      } else {
        // Existing user (skipped save) -> Proceed using backend lookup
        await runWithLock(async () => {
          // Prevents duplicate payment requests via synchronous lock (Task 14)
          await executePayment(enrichedBuyerInfo, explicitBookingData);
        });
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
      city?: string;
      location?: string
    },
    bookingDetails: any = null,
    buyerId?: string | number
  ) => {
    const activeDoorDeliverySelection = isPhysical ? doorDeliverySelectionRef.current : null;
    const estimatedDeliveryFee = activeDoorDeliverySelection?.doorDelivery ? Number(activeDoorDeliverySelection?.quote?.feeAmount || 0) : 0;
    const estimatedPayableAmount = calculateBuyerPayableTotal(product.price, estimatedDeliveryFee);

    // 0. Minimum Amount Validation (payment provider requirement)
    if (estimatedPayableAmount < 10) {
      toast({
        title: "Minimum Amount Not Met",
        description: `Mobile payments must be at least 10 KES. Current total: ${estimatedPayableAmount} KES.`,
        variant: "destructive"
      });
      setIsProcessingPurchase(false);
      return;
    }

    setIsProcessingPurchase(true);
    try {
      const activeBooking = bookingDetails || bookingData;
      const doorDeliverySelection = isPhysical ? doorDeliverySelectionRef.current : null;
      console.log('[PAYLOAD-DEBUG] Outgoing Payment Payload:', {
        buyerDetails,
        bookingDetails,
        bookingData,
        resolvedBooking: activeBooking,
        doorDeliverySelection,
        buyerLocation: activeBooking?.buyerLocation
      });
      const wantsDoorDelivery = isPhysical && doorDeliverySelection?.doorDelivery === true;
      const customInstructions = effectiveIsCustomProduct ? customInstructionsRef.current : null;
      if (effectiveIsCustomProduct && !customInstructions) {
        toast({
          title: 'Customization required',
          description: 'Please describe what you want customized before paying.',
          variant: 'destructive'
        });
        return;
      }
      const doorDeliveryLocation = wantsDoorDelivery
        ? toBuyerLocationPayload(doorDeliverySelection?.address, {
          lat: doorDeliverySelection?.lat,
          lng: doorDeliverySelection?.lng
        })
        : null;
      const cityLocationFallback = buyerDetails.city && buyerDetails.location
        ? toBuyerLocationPayload(`${buyerDetails.city}, ${buyerDetails.location}`, {
          lat: (buyerDetails as any).latitude,
          lng: (buyerDetails as any).longitude
        })
        : null;

      if (wantsDoorDelivery && !doorDeliveryLocation) {
        toast({
          title: 'Delivery Location Required',
          description: 'Please pin your delivery location and enter the full address.',
          variant: 'destructive'
        });
        return;
      }

      const paymentDeliveryFeeEstimate = wantsDoorDelivery ? Number(doorDeliverySelection?.quote?.feeAmount || 0) : 0;
      const productServiceCharge = calculateProductServiceCharge(product.price);
      const paymentEstimate = calculateBuyerPayableTotal(product.price, paymentDeliveryFeeEstimate);
      const checkoutToken = getCheckoutAttemptToken();
      const creatorCode = new URLSearchParams(window.location.search).get('creator') || undefined;
      const preHandoffSla = effectiveIsCustomProduct ? {
        type: 'custom_production',
        label: 'Custom order',
        ready_days: effectiveProductionDays,
        production_days: effectiveProductionDays,
        customization_prompt: effectiveCustomizationPrompt,
        buyer_instructions: customInstructions,
        delivery_starts_after_seller_handoff: true
      } : effectiveIsImportedProduct ? {
        type: 'import_waiting',
        label: 'Imported / pre-order item',
        ready_days: effectiveImportDays,
        import_days: effectiveImportDays,
        note: importNote || 'Imported item. Delivery starts after seller handoff.',
        delivery_starts_after_seller_handoff: true
      } : undefined;
      const payload = {
        phone: buyerDetails.mobilePayment, // For STK Push
        mobilePayment: buyerDetails.mobilePayment,
        email: buyerDetails.email,
        amount: paymentEstimate,
        productId: product.id,
        sellerId: product.sellerId || displaySeller?.id,
        productName: product.name,
        customerName: buyerDetails.fullName,
        narrative: `Purchase of ${product.name}`,
        paymentMethod: 'paystack',
        checkout_token: checkoutToken,
        clientCheckoutToken: checkoutToken,
        // Provide structured buyerLocation if it came from booking/map
        // root city/location fields are deprecated and ignored by backend
        buyerLocation: doorDeliveryLocation || activeBooking?.buyerLocation || cityLocationFallback || undefined,
        delivery: wantsDoorDelivery ? {
          doorDelivery: true,
          deliveryMode: 'DOOR_DELIVERY',
          address: doorDeliveryLocation?.address,
          latitude: doorDeliveryLocation?.lat,
          longitude: doorDeliveryLocation?.lng,
          frontendQuote: doorDeliverySelection?.quote
        } : {
          doorDelivery: false
        },
        metadata: activeBooking ? {
          booking_date: format(activeBooking.date, 'yyyy-MM-dd'),
          booking_time: activeBooking.time,
          service_location: activeBooking.location,
          service_requirements: activeBooking.serviceRequirements,
          buyer_location: activeBooking.buyerLocation,
          creator_code: creatorCode,
          product_type: isService ? 'service' : (isDigital ? 'digital' : 'physical'),
          customization: effectiveIsCustomProduct ? {
            is_custom_product: true,
            production_days: effectiveProductionDays,
            customization_prompt: effectiveCustomizationPrompt,
            instructions: customInstructions
          } : undefined,
          pre_handoff_sla: preHandoffSla,
          delivery: wantsDoorDelivery ? {
            doorDelivery: true,
            door_delivery: true,
            delivery_mode: 'DOOR_DELIVERY',
            buyerDeliveryLocation: doorDeliveryLocation,
            frontendQuote: doorDeliverySelection?.quote
          } : { doorDelivery: false },
          client_checkout_token: checkoutToken
        } : {
          product_type: isService ? 'service' : (isDigital ? 'digital' : 'physical'),
          creator_code: creatorCode,
          customization: effectiveIsCustomProduct ? {
            is_custom_product: true,
            production_days: effectiveProductionDays,
            customization_prompt: effectiveCustomizationPrompt,
            instructions: customInstructions
          } : undefined,
          pre_handoff_sla: preHandoffSla,
          delivery: wantsDoorDelivery ? {
            doorDelivery: true,
            door_delivery: true,
            delivery_mode: 'DOOR_DELIVERY',
            buyerDeliveryLocation: doorDeliveryLocation,
            frontendQuote: doorDeliverySelection?.quote
          } : { doorDelivery: false },
          client_checkout_token: checkoutToken
        }
      };

      // USE NEW API CLIENT
      const response = await apiClient.post('/payments/initiate-product', payload, {
        headers: {
          'Idempotency-Key': checkoutToken
        }
      });
      const data: any = response.data;

      if (data.status === 'success' || data.success === true) {
        toast({
          title: 'STK Push Sent',
          description: 'Please check your phone to complete the payment.',
          duration: 10000
        });

        // Trigger Payment Status Modal (FIX 5)
        const orderId = data.data?.orderId;
        const orderNumber = data.data?.orderNumber;
        const paymentReference = data.data?.paymentId || data.data?.reference || data.data?.orderId;

        console.log('[PAYMENT-DEBUG] Initiation Result:', { orderId, orderNumber, paymentReference });

        if (orderNumber) {
          checkoutAttemptTokenRef.current = null;
          setPaymentModalData({
            isOpen: true,
            orderNumber: orderNumber,
            invoiceId: String(orderNumber || orderId),
            isGuest: !isAuthenticated,
            email: buyerDetails.email,
            paymentSummary: {
              productAmount: Number(product.price || 0),
              deliveryFee: paymentDeliveryFeeEstimate,
              serviceCharge: productServiceCharge,
              totalAmount: paymentEstimate
            }
          });
          setIsProcessingPurchase(false);
        }
      } else {
        throw new Error(data.message);
      }

    } catch (error: any) {
      console.error('Payment initiation error:', error);

      // Extract error message from response
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Could not initiate payment';
      const requiresCustomization = /customization instructions are required/i.test(errorMessage);

      if (requiresCustomization && isPhysical) {
        setForceCustomCheckout(true);
        customInstructionsRef.current = null;
        checkoutAttemptTokenRef.current = null;
        setIsBuyerModalOpen(false);
        setIsPhoneCheckModalOpen(true);
        toast({
          title: 'Customization required',
          description: 'Add the product details the seller needs before paying.',
          variant: 'destructive',
          duration: 8000
        });
        setIsProcessingPurchase(false);
        return;
      }

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
      if (error.response) {
        checkoutAttemptTokenRef.current = null;
      }
      setIsProcessingPurchase(false);
    }
  };

  // Get theme styles dynamically from CSS variables (set by ShopPage)
  const themedCardStyle: CSSProperties = {
    ...(getProductCardThemeVars(cardTheme) as CSSProperties),
    background: 'var(--product-card-bg)',
    borderColor: 'var(--product-card-border)',
    color: 'var(--product-card-text)',
    boxShadow: '0 16px 38px -28px rgba(15, 23, 42, 0.35)'
  };

  const themeClasses = getThemeClasses(cardTheme);

  const openShop = () => {
    if (displaySeller?.shopName) {
      navigate(`/shop/${displaySeller.shopName}`);
    } else if (displaySeller?.id) {
      navigate(`/shop/${displaySeller.id}`);
    }
  };

  const handleBuyButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.nativeEvent) {
      event.nativeEvent.stopImmediatePropagation();
    }
    handleBuyClick(event);
  };

  return (
    <Card
      className={cn(
        'group relative flex h-full min-h-[350px] flex-col overflow-hidden transition-all duration-300 rounded-2xl sm:min-h-[380px]',
        isSold ? 'opacity-60' : 'sm:hover:-translate-y-1',
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
            'absolute top-2 right-2 z-10 p-1.5 sm:p-2 rounded-full bg-white/95 hover:bg-white border border-slate-200 shadow-sm backdrop-blur-sm transition-all duration-300',
            'h-7 w-7 sm:h-9 sm:w-9 md:h-10 md:w-10 flex items-center justify-center',
            wishlistActionLoading || isWishlistLoading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-110',
            isWishlisted ? 'text-red-500' : 'text-slate-500'
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

      <ProductCardMedia
        product={product}
        isDigital={isDigital}
        isService={isService}
        isHybrid={isHybrid}
        isOutOfStock={isOutOfStock}
        canOpenGallery={productImages.length > 0}
        imageCount={productImages.length}
        onOpenGallery={() => setGalleryIndex(0)}
      />

      <ProductCardDetails
        product={product}
        displaySeller={displaySeller}
        displaySellerName={displaySellerName}
        theme={cardTheme}
        forceWhiteText={forceWhiteText}
        themeClasses={themeClasses}
        isDigital={isDigital}
        isService={isService}
        isSold={isSold}
        isLocked={isLocked}
        onBuyClick={handleBuyButtonClick}
        onOpenShop={openShop}
      />

      <ProductCardModals
        product={product}
        theme={cardTheme}
        displaySellerName={displaySellerName}
        isPhoneCheckModalOpen={isPhoneCheckModalOpen}
        isBuyerModalOpen={isBuyerModalOpen}
        isBookingModalOpen={isBookingModalOpen}
        isCheckingPhone={isCheckingPhone}
        isProcessingPurchase={isProcessingPurchase}
        currentPhone={currentPhone}
        initialBuyerData={initialBuyerData}
        initialBuyerLocation={initialBuyerLocation}
        shouldSkipSave={shouldSkipSave}
        paymentModalData={paymentModalData}
        isPhysicalProduct={isPhysical}
        isCustomProduct={effectiveIsCustomProduct}
        productionDays={effectiveProductionDays}
        customizationPrompt={effectiveCustomizationPrompt}
        isImportedProduct={effectiveIsImportedProduct}
        importDays={effectiveImportDays}
        importNote={importNote}
        onPhoneCheckClose={() => setIsPhoneCheckModalOpen(false)}
        onBuyerModalClose={() => setIsBuyerModalOpen(false)}
        onBookingModalClose={() => setIsBookingModalOpen(false)}
        onPaymentModalClose={() => setPaymentModalData(prev => ({ ...prev, isOpen: false }))}
        onPhoneSubmit={handlePhoneSubmit}
        onBuyerInfoSubmit={async (buyerInfo, skipSave) => {
          await handleBuyerInfoSubmit(buyerInfo, null, skipSave);
        }}
        onBookingConfirm={handleBookingConfirm}
      />

      {galleryIndex !== null && (
        <ProductImageViewer
          images={productImages}
          productName={product.name}
          activeIndex={galleryIndex}
          onActiveIndexChange={setGalleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      )}
    </Card>
  );
}
