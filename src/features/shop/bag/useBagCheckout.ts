import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useGlobalAuth } from '@/features/auth/contexts';
import type { BuyerProfile } from '@/features/auth/types/authTypes';
import { useToast } from '@/shared/hooks/use-toast';
import { useCheckBuyerByPhoneMutation } from '@/features/buyer/hooks/mutations/useBuyerAuthMutations';
import { useSaveBuyerInfoMutation } from '@/features/buyer/hooks/mutations/useSaveBuyerInfoMutation';
import { useInitiateProductMutation } from '@/features/buyer/hooks/useBuyerPayments';
import { useAsyncLock } from '@/shared/hooks/useAsyncLock';
import { calculateBuyerPayableTotal, calculateProductServiceCharge, createCheckoutAttemptToken, getProductFlags, normalizePhone, normalizePhoneForPaystack, type ProductWithApiFields } from '@/features/shop/utils/productCardUtils';
import { toBuyerLocationPayload, type BuyerLocationPayload } from '@/infrastructure/location/location';
import type { DoorDeliverySelection } from '@/shared/components/PhoneCheckModal';
import type { BuyerInfo } from '@/shared/components/BuyerInfoModal';
import type { BagContextValue } from './BagContext';

interface BuyerDetails { fullName: string; email: string; mobilePayment: string; city?: string; location?: string; latitude?: number; longitude?: number; }
export interface BagBooking { date: Date; time: string; location: string; locationType?: string; serviceRequirements?: string; buyerLocation?: BuyerLocationPayload | null; }
interface PaymentModalData {
  isOpen: boolean; orderNumber: string | null; invoiceId: string | null; isGuest: boolean;
  email?: string; checkoutToken?: string | null;
  paymentSummary?: { productAmount?: number; deliveryFee?: number; serviceCharge?: number; totalAmount?: number };
}

/**
 * Checkout for the per-seller bag. A physical/digital bag is paid as `items[]`
 * (one STK push). A service bag holds exactly one service and carries its booking
 * (date/time/location) in metadata → the backend resolves it as BUYER_TO_SELLER.
 */
export function useBagCheckout(bag: BagContextValue) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAuthenticated, user: globalUser } = useGlobalAuth();
  const buyerProfile = globalUser?.role === 'buyer' ? (globalUser.profile as BuyerProfile) : null;
  const rawRegisteredNumber = String(
    buyerProfile?.mobilePayment ||
    buyerProfile?.phone ||
    (globalUser as unknown as Record<string, unknown>)?.mobilePayment ||
    (globalUser as unknown as Record<string, unknown>)?.mobile_payment ||
    (globalUser as unknown as Record<string, unknown>)?.phone ||
    ''
  ).trim();
  const registeredPaystackPhone = rawRegisteredNumber ? normalizePhoneForPaystack(rawRegisteredNumber) : '';
  const hasRegisteredPaymentNumber = Boolean(registeredPaystackPhone && registeredPaystackPhone.length >= 10);

  const checkBuyerByPhoneMutation = useCheckBuyerByPhoneMutation();
  const saveBuyerInfoMutation = useSaveBuyerInfoMutation();
  const initiateProductMutation = useInitiateProductMutation();
  const { runWithLock } = useAsyncLock();

  const [isBuyerModalOpen, setIsBuyerModalOpen] = useState(false);
  const [currentPhone, setCurrentPhone] = useState('');
  const [initialBuyerData, setInitialBuyerData] = useState<{ fullName?: string; email?: string; city?: string; location?: string } | undefined>(undefined);
  const [shouldSkipSave, setShouldSkipSave] = useState(false);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const [paymentModalData, setPaymentModalData] = useState<PaymentModalData>({ isOpen: false, orderNumber: null, invoiceId: null, isGuest: false });
  const [booking, setBooking] = useState<BagBooking | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const checkoutTokenRef = useRef<string | null>(null);
  const doorDeliveryRef = useRef<DoorDeliverySelection | null>(null);

  const flags = (l: { product: unknown }) => getProductFlags(l.product as unknown as ProductWithApiFields);
  const anyPhysical = bag.items.some((l) => flags(l).isPhysical);
  const allDigital = bag.items.length > 0 && bag.items.every((l) => flags(l).isDigital);
  const hasService = bag.items.some((l) => flags(l).isService);

  const getToken = () => {
    if (!checkoutTokenRef.current) checkoutTokenRef.current = createCheckoutAttemptToken(bag.items[0]?.product.id ?? 'bag');
    return checkoutTokenRef.current;
  };

  const handleBookingConfirm = async (data: BagBooking) => {
    setBooking(data);
    setIsBookingModalOpen(false);
  };

  const executePayment = async (buyer: BuyerDetails) => {
    if (hasService && !booking) {
      toast({ title: 'Booking required', description: 'Please set the service date, time and location first.', variant: 'destructive' });
      return;
    }
    const door = anyPhysical && !hasService ? doorDeliveryRef.current : null;
    const wantsDoorDelivery = Boolean(door?.doorDelivery);
    const deliveryFee = wantsDoorDelivery ? Number(door?.quote?.feeAmount || 0) : 0;
    const subtotal = bag.subtotal;
    const serviceCharge = calculateProductServiceCharge(subtotal);
    const paymentEstimate = calculateBuyerPayableTotal(subtotal, deliveryFee);

    if (paymentEstimate < 10) {
      toast({ title: 'Minimum Amount Not Met', description: 'Mobile payments must be at least 10 KES.', variant: 'destructive' });
      return;
    }
    const doorDeliveryLocation = wantsDoorDelivery ? toBuyerLocationPayload(door?.address, { lat: door?.lat, lng: door?.lng }) : null;
    if (wantsDoorDelivery && !doorDeliveryLocation) {
      toast({ title: 'Delivery Location Required', description: 'Please pin your delivery location and enter the full address.', variant: 'destructive' });
      return;
    }
    const cityLocationFallback = buyer.city && buyer.location ? toBuyerLocationPayload(`${buyer.city}, ${buyer.location}`, { lat: buyer.latitude, lng: buyer.longitude }) : null;

    setIsProcessingPurchase(true);
    try {
      const checkoutToken = getToken();
      const creatorCode = new URLSearchParams(window.location.search).get('creator') || undefined;
      const representative = bag.items[0].product;
      const sellerId = (representative.sellerId as string | number | undefined) || representative.seller?.id;
      const deliveryBlock = wantsDoorDelivery
        ? { doorDelivery: true, door_delivery: true, deliveryMode: 'DOOR_DELIVERY', delivery_mode: 'DOOR_DELIVERY', address: doorDeliveryLocation?.address, latitude: doorDeliveryLocation?.lat, longitude: doorDeliveryLocation?.lng, buyerDeliveryLocation: doorDeliveryLocation, frontendQuote: door?.quote }
        : { doorDelivery: false };
      const productType = hasService ? 'service' : (allDigital ? 'digital' : 'physical');

      const payload = {
        phone: buyer.mobilePayment,
        mobilePayment: buyer.mobilePayment,
        email: buyer.email,
        amount: paymentEstimate,
        items: bag.items.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        productId: representative.id,
        sellerId,
        productName: bag.count > 1 ? `${bag.count} products` : representative.name,
        customerName: buyer.fullName,
        narrative: hasService ? `Booking of ${representative.name}` : `Purchase of ${bag.count} product${bag.count === 1 ? '' : 's'}`,
        paymentMethod: 'paystack',
        checkout_token: checkoutToken,
        clientCheckoutToken: checkoutToken,
        buyerLocation: doorDeliveryLocation || (hasService ? booking?.buyerLocation : null) || cityLocationFallback || undefined,
        delivery: deliveryBlock,
        metadata: {
          product_type: productType,
          creator_code: creatorCode,
          delivery: deliveryBlock,
          items: bag.items.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
          ...(hasService && booking ? {
            booking_date: format(booking.date, 'yyyy-MM-dd'),
            booking_time: booking.time,
            service_location: booking.location,
            service_requirements: booking.serviceRequirements,
            buyer_location: booking.buyerLocation,
          } : {}),
          client_checkout_token: checkoutToken,
        },
      };

      const data = await initiateProductMutation.mutateAsync({ payload, idempotencyKey: checkoutToken }) as Record<string, unknown>;
      if (data.status === 'success' || data.success === true) {
        toast({ title: 'STK Push Sent', description: 'Please check your phone to complete the payment.', duration: 10000 });
        const resultData = (data.data ?? {}) as { orderId?: string; orderNumber?: string };
        if (resultData.orderNumber) {
          checkoutTokenRef.current = null;
          setPaymentModalData({
            isOpen: true, orderNumber: resultData.orderNumber, invoiceId: String(resultData.orderNumber || resultData.orderId),
            isGuest: !isAuthenticated, email: buyer.email, checkoutToken,
            paymentSummary: { productAmount: subtotal, deliveryFee, serviceCharge, totalAmount: paymentEstimate },
          });
          bag.close();
          bag.clear();
          setBooking(null);
        }
      } else {
        throw new Error(String(data.message ?? 'Payment failed'));
      }
    } catch (error) {
      checkoutTokenRef.current = null;
      toast({ title: 'Payment error', description: (error as Error)?.message || 'Failed to initiate payment.', variant: 'destructive' });
    } finally {
      setIsProcessingPurchase(false);
    }
  };

  // Direct payment initiation for existing buyers with registered mobile payment number.
  // Bypasses the phone check step completely; normalizes number for Paystack and initiates payment.
  const initiateDirectPayment = async (
    customPhone?: string,
    delivery?: DoorDeliverySelection & { customInstructions?: string }
  ) => {
    doorDeliveryRef.current = anyPhysical && !hasService && delivery?.doorDelivery ? delivery : null;
    if (hasService && !booking) {
      toast({ title: 'Booking required', description: 'Please set the service date, time and location first.', variant: 'destructive' });
      return;
    }

    const targetPhone = customPhone || registeredPaystackPhone;
    if (!targetPhone) {
      toast({ title: 'Phone Number Required', description: 'Please enter your mobile payment number.', variant: 'destructive' });
      return;
    }

    const paystackPhone = normalizePhoneForPaystack(targetPhone);
    setCurrentPhone(paystackPhone);

    const buyerEmail = buyerProfile?.email || globalUser?.email;
    const buyerName = buyerProfile?.fullName || globalUser?.email?.split('@')[0] || 'Buyer';

    if (buyerEmail && buyerEmail.trim() !== '') {
      await runWithLock(async () => {
        await executePayment({
          fullName: buyerName,
          email: buyerEmail,
          mobilePayment: paystackPhone,
          city: buyerProfile?.city,
          location: buyerProfile?.location,
          latitude: buyerProfile?.latitude,
          longitude: buyerProfile?.longitude,
        });
      });
    } else {
      // Fallback: If buyer has no email on profile, prompt for email
      toast({ title: 'Email Required', description: 'Please provide your email address to receive the receipt.' });
      setInitialBuyerData({
        fullName: buyerName,
        city: buyerProfile?.city,
        location: buyerProfile?.location,
        email: '',
      });
      setShouldSkipSave(false);
      setIsBuyerModalOpen(true);
    }
  };

  // Called by the inline phone form (usePhoneCheck) — checks the buyer then pays (fallback).
  const handlePhoneSubmit = async (phone: string, delivery?: DoorDeliverySelection & { customInstructions?: string }) => {
    doorDeliveryRef.current = anyPhysical && !hasService && delivery?.doorDelivery ? delivery : null;
    if (hasService && !booking) {
      toast({ title: 'Booking required', description: 'Please set the service date, time and location first.', variant: 'destructive' });
      return;
    }
    try {
      const normalizedPhone = normalizePhone(phone);
      const paystackPhone = normalizePhoneForPaystack(phone);
      const result = await checkBuyerByPhoneMutation.mutateAsync(normalizedPhone);
      setCurrentPhone(paystackPhone);
      if (result.exists && result.buyer) {
        if (result.buyer.hasEmail || (result.buyer.email && result.buyer.email.trim() !== '')) {
          await runWithLock(async () => {
            await executePayment({
              fullName: result.buyer!.fullName || '',
              email: result.buyer!.email || '',
              mobilePayment: paystackPhone,
              city: result.buyer!.city,
              location: result.buyer!.location,
            });
          });
        } else {
          toast({ title: 'Email Required', description: 'Please provide your email address to receive the receipt.' });
          setInitialBuyerData({ fullName: result.buyer.fullName, city: result.buyer.city, location: result.buyer.location, email: '' });
          setShouldSkipSave(false);
          setIsBuyerModalOpen(true);
        }
      } else {
        setInitialBuyerData(undefined);
        setShouldSkipSave(false);
        setIsBuyerModalOpen(true);
      }
    } catch (error) {
      toast({ title: 'Error', description: (error as Error)?.message || 'Failed to check phone number.', variant: 'destructive' });
    }
  };

  const handleBuyerInfoSubmit = async (buyerInfo: BuyerInfo, skipSave: boolean) => {
    try {
      const info = buyerInfo as unknown as BuyerDetails;
      if (!skipSave) {
        const saveResult = await saveBuyerInfoMutation.mutateAsync(buyerInfo as unknown as Parameters<typeof saveBuyerInfoMutation.mutateAsync>[0]);
        if (saveResult.requiresLogin) {
          sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
          navigate('/buyer/login', { replace: true });
          return;
        }
      }
      setIsBuyerModalOpen(false);
      await runWithLock(async () => { await executePayment(info); });
    } catch (error) {
      toast({ title: 'Error', description: (error as Error)?.message || 'Failed to save information.', variant: 'destructive' });
    }
  };

  return {
    isBuyerModalOpen, isProcessingPurchase, currentPhone, initialBuyerData, shouldSkipSave, paymentModalData,
    anyPhysical, hasService, booking,
    isBookingModalOpen, setIsBookingModalOpen, handleBookingConfirm,
    handlePhoneSubmit, handleBuyerInfoSubmit, setIsBuyerModalOpen,
    initiateDirectPayment,
    buyerProfile,
    hasRegisteredPaymentNumber,
    registeredPaystackPhone,
    closePaymentModal: () => setPaymentModalData((p) => ({ ...p, isOpen: false })),
  };
}
