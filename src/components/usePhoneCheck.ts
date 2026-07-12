import { useEffect, useState } from 'react';
import { useLogisticsQuoteMutation } from '@/hooks/buyer/useBuyerPayments';
import {
  hasPreciseLocation,
  toBuyerLocationPayload,
  type OptionalBuyerLocation
} from '@/lib/location';
import { calculateBuyerPayableTotal, calculateProductServiceCharge } from '@/components/product-card/productCardUtils';
import type { DoorDeliverySelection } from './PhoneCheckModal';

interface UsePhoneCheckParams {
  isOpen: boolean;
  onPhoneSubmit: (phone: string, delivery?: DoorDeliverySelection) => void;
  isPhysicalProduct: boolean;
  isCustomProduct: boolean;
  purchaseDetails?: {
    shopName: string;
    productName: string;
    productPrice: number;
  };
}

export function usePhoneCheck({
  isOpen,
  onPhoneSubmit,
  isPhysicalProduct,
  isCustomProduct,
  purchaseDetails,
}: UsePhoneCheckParams) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [doorDeliveryEnabled, setDoorDeliveryEnabled] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState<OptionalBuyerLocation>({
    address: '',
    lat: null,
    lng: null
  });
  const [deliveryQuote, setDeliveryQuote] = useState<DoorDeliverySelection['quote'] | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');

  const productPrice = Number(purchaseDetails?.productPrice || 0);
  const canUseDoorDelivery = Boolean(isPhysicalProduct && productPrice > 0);
  const displayedServiceCharge = calculateProductServiceCharge(productPrice);
  const logisticsQuoteMutation = useLogisticsQuoteMutation();
  const displayedDeliveryFee = canUseDoorDelivery && doorDeliveryEnabled ? Number(deliveryQuote?.feeAmount || 0) : 0;
  const displayedTotal = calculateBuyerPayableTotal(productPrice, displayedDeliveryFee);

  useEffect(() => {
    if (!isOpen) {
      setError('');
      setDoorDeliveryEnabled(false);
      setDeliveryLocation({ address: '', lat: null, lng: null });
      setDeliveryQuote(null);
      setQuoteError('');
      setIsQuoteLoading(false);
      setCustomInstructions('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!canUseDoorDelivery && doorDeliveryEnabled) {
      setDoorDeliveryEnabled(false);
    }
  }, [canUseDoorDelivery, doorDeliveryEnabled]);

  useEffect(() => {
    if (!canUseDoorDelivery || !doorDeliveryEnabled) {
      setDeliveryQuote(null);
      setQuoteError('');
      setIsQuoteLoading(false);
      return;
    }

    if (!hasPreciseLocation(deliveryLocation)) {
      setDeliveryQuote(null);
      setQuoteError('');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsQuoteLoading(true);
      setQuoteError('');
      try {
        const response = await logisticsQuoteMutation.mutateAsync({
          payload: {
            legType: 'delivery',
            location: {
              address: deliveryLocation.address,
              latitude: deliveryLocation.lat,
              longitude: deliveryLocation.lng
            }
          },
          signal: controller.signal
        });
        const quote = (response as Record<string, unknown>)?.data as { feeAmount?: number; distanceKm?: number; chargeableDistanceKm?: number; rateKesPerKm?: number } | undefined;
        const feeAmount = Number(quote?.feeAmount || 0);
        setDeliveryQuote({
          feeAmount,
          distanceKm: Number(quote?.distanceKm || 0),
          chargeableDistanceKm: Number(quote?.chargeableDistanceKm || 0),
          rateKesPerKm: Number(quote?.rateKesPerKm || 40),
          totalAmount: calculateBuyerPayableTotal(productPrice, feeAmount)
        });
      } catch (quoteError: unknown) {
        if ((quoteError as Record<string, unknown>)?.name !== 'CanceledError' && (quoteError as Record<string, unknown>)?.code !== 'ERR_CANCELED') {
          setDeliveryQuote(null);
          setQuoteError(String((((quoteError as Record<string, unknown>)?.response as Record<string, unknown>)?.data as Record<string, unknown>)?.error || (quoteError as Record<string, unknown>)?.message || 'Could not calculate delivery fee'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsQuoteLoading(false);
        }
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [canUseDoorDelivery, doorDeliveryEnabled, deliveryLocation, productPrice, logisticsQuoteMutation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone.trim()) {
      setError('Phone number is required');
      return;
    }

    // Basic phone validation (adjust pattern as needed)
    const phonePattern = /^(\+?254|0)[17]\d{8}$/;
    if (!phonePattern.test(phone.trim())) {
      setError('Please enter a valid phone number (e.g., +254712345678 or 0712345678)');
      return;
    }

    const wantsDoorDelivery = canUseDoorDelivery && doorDeliveryEnabled;
    const preciseDeliveryLocation = toBuyerLocationPayload(deliveryLocation.address, {
      lat: deliveryLocation.lat,
      lng: deliveryLocation.lng
    });

    if (wantsDoorDelivery) {
      if (!preciseDeliveryLocation) {
        setError('Please pin your delivery location and enter the full address');
        return;
      }

      if (isQuoteLoading) {
        setError('Please wait while we calculate the delivery fee');
        return;
      }

      if (!deliveryQuote || quoteError) {
        setError(quoteError || 'Delivery fee could not be calculated. Please adjust the location and try again.');
        return;
      }
    }

    if (isCustomProduct && !customInstructions.trim()) {
      setError('Please describe what you want customized before paying.');
      return;
    }

    onPhoneSubmit(phone.trim(), wantsDoorDelivery ? {
      doorDelivery: true,
      address: preciseDeliveryLocation?.address,
      lat: preciseDeliveryLocation?.lat,
      lng: preciseDeliveryLocation?.lng,
      quote: deliveryQuote ?? undefined,
      customInstructions: isCustomProduct ? customInstructions.trim() : undefined
    } as DoorDeliverySelection & { customInstructions?: string } : {
      doorDelivery: false,
      customInstructions: isCustomProduct ? customInstructions.trim() : undefined
    } as DoorDeliverySelection & { customInstructions?: string });
  };

  return {
    handleSubmit,
    phone,
    setPhone,
    error,
    displayedServiceCharge,
    doorDeliveryEnabled,
    setDoorDeliveryEnabled,
    isQuoteLoading,
    displayedDeliveryFee,
    displayedTotal,
    canUseDoorDelivery,
    setDeliveryLocation,
    deliveryQuote,
    quoteError,
    customInstructions,
    setCustomInstructions,
  };
}
