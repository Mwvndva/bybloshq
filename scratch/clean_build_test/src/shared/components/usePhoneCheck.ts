import { useState, useEffect, type FormEvent } from 'react';
import type { DoorDeliverySelection } from '@/shared/components/PhoneCheckModal';
import type { OptionalBuyerLocation } from '@/infrastructure/location/location';
import { getLogisticsQuote } from '@/features/buyer/api/payments';
import {
  calculateBuyerPayableTotal,
  calculateProductServiceCharge,
} from '@/features/shop/utils/productCardUtils';

export interface UsePhoneCheckProps {
  isOpen: boolean;
  onPhoneSubmit: (
    phone: string,
    delivery?: DoorDeliverySelection & { customInstructions?: string }
  ) => void;
  isPhysicalProduct?: boolean;
  isCustomProduct?: boolean;
  purchaseDetails?: {
    shopName: string;
    productName: string;
    productPrice: number;
  };
}

export interface DeliveryQuote {
  feeAmount: number;
  distanceKm: number;
  chargeableDistanceKm: number;
  rateKesPerKm: number;
  totalAmount?: number;
}

export function usePhoneCheck({
  isOpen,
  onPhoneSubmit,
  isPhysicalProduct = false,
  isCustomProduct = false,
  purchaseDetails,
}: UsePhoneCheckProps) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [doorDeliveryEnabled, setDoorDeliveryEnabled] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState<OptionalBuyerLocation | null>(null);
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');

  const canUseDoorDelivery = Boolean(isPhysicalProduct);
  const productPrice = purchaseDetails?.productPrice || 0;
  const displayedServiceCharge = calculateProductServiceCharge(productPrice);
  const displayedDeliveryFee =
    doorDeliveryEnabled && deliveryQuote?.feeAmount ? Number(deliveryQuote.feeAmount) : 0;
  const displayedTotal = calculateBuyerPayableTotal(productPrice, displayedDeliveryFee);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhone('');
      setError('');
      setDoorDeliveryEnabled(false);
      setDeliveryLocation(null);
      setDeliveryQuote(null);
      setQuoteError('');
      setIsQuoteLoading(false);
      setCustomInstructions('');
    }
  }, [isOpen]);

  // Fetch logistics quote when door delivery is enabled and location is chosen
  useEffect(() => {
    if (
      !doorDeliveryEnabled ||
      !deliveryLocation ||
      deliveryLocation.lat === null ||
      deliveryLocation.lng === null
    ) {
      setDeliveryQuote(null);
      setQuoteError('');
      setIsQuoteLoading(false);
      return;
    }

    const abortController = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsQuoteLoading(true);
      setQuoteError('');
      try {
        const response = (await getLogisticsQuote(
          {
            legType: 'delivery',
            location: {
              address: deliveryLocation.address,
              latitude: deliveryLocation.lat!,
              longitude: deliveryLocation.lng!,
            },
          },
          abortController.signal
        )) as { data?: DeliveryQuote } & Partial<DeliveryQuote>;

        const quoteData = response?.data || response;
        if (quoteData) {
          setDeliveryQuote({
            feeAmount: Number(quoteData.feeAmount || 0),
            distanceKm: Number(quoteData.distanceKm || 0),
            chargeableDistanceKm: Number(quoteData.chargeableDistanceKm || 0),
            rateKesPerKm: Number(quoteData.rateKesPerKm || 40),
            totalAmount: Number(quoteData.totalAmount || quoteData.feeAmount || 0),
          });
        }
      } catch (err: unknown) {
        const errorObj = err as {
          name?: string;
          code?: string;
          message?: string;
          response?: { data?: { error?: string; message?: string } };
        };
        if (
          errorObj?.name === 'CanceledError' ||
          errorObj?.code === 'ERR_CANCELED' ||
          abortController.signal.aborted
        ) {
          return;
        }
        setDeliveryQuote(null);
        const errMsg =
          errorObj?.response?.data?.error ||
          errorObj?.response?.data?.message ||
          errorObj?.message ||
          'Could not calculate delivery fee';
        setQuoteError(errMsg);
      } finally {
        if (!abortController.signal.aborted) {
          setIsQuoteLoading(false);
        }
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [
    doorDeliveryEnabled,
    deliveryLocation?.address,
    deliveryLocation?.lat,
    deliveryLocation?.lng,
  ]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError('Please enter your phone number');
      return;
    }

    if (isCustomProduct && !customInstructions.trim()) {
      setError('Please provide customization details');
      return;
    }

    if (doorDeliveryEnabled) {
      if (
        !deliveryLocation ||
        deliveryLocation.lat === null ||
        deliveryLocation.lng === null ||
        !deliveryLocation.address?.trim()
      ) {
        setQuoteError('Please select a valid delivery location');
        return;
      }
    }

    setError('');

    let deliveryPayload: (DoorDeliverySelection & { customInstructions?: string }) | undefined;
    if (
      doorDeliveryEnabled &&
      deliveryLocation &&
      deliveryLocation.lat !== null &&
      deliveryLocation.lng !== null
    ) {
      deliveryPayload = {
        doorDelivery: true,
        address: deliveryLocation.address,
        lat: deliveryLocation.lat,
        lng: deliveryLocation.lng,
        quote: deliveryQuote
          ? {
              feeAmount: deliveryQuote.feeAmount,
              distanceKm: deliveryQuote.distanceKm,
              chargeableDistanceKm: deliveryQuote.chargeableDistanceKm,
              rateKesPerKm: deliveryQuote.rateKesPerKm,
              totalAmount: deliveryQuote.totalAmount ?? deliveryQuote.feeAmount,
            }
          : undefined,
        ...(isCustomProduct && customInstructions.trim()
          ? { customInstructions: customInstructions.trim() }
          : {}),
      };
    } else if (isCustomProduct && customInstructions.trim()) {
      deliveryPayload = {
        doorDelivery: false,
        customInstructions: customInstructions.trim(),
      };
    }

    onPhoneSubmit(trimmedPhone, deliveryPayload);
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
