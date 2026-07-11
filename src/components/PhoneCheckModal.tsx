import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Phone, Loader2, MapPin, Truck } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import LocationPicker from '@/components/common/LocationPicker';
import { useLogisticsQuoteMutation } from '@/hooks/buyer/useBuyerPayments';
import {
  createOptionalBuyerLocation,
  hasPreciseLocation,
  toBuyerLocationPayload,
  type BuyerLocationPayload,
  type OptionalBuyerLocation
} from '@/lib/location';

import { calculateBuyerPayableTotal, calculateProductServiceCharge } from '@/components/product-card/productCardUtils';

export interface DoorDeliverySelection {
  doorDelivery: boolean;
  address?: BuyerLocationPayload['address'];
  lat?: BuyerLocationPayload['lat'];
  lng?: BuyerLocationPayload['lng'];
  quote?: {
    feeAmount: number;
    distanceKm: number;
    chargeableDistanceKm: number;
    rateKesPerKm: number;
    totalAmount: number;
  };
}

interface PhoneCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhoneSubmit: (phone: string, delivery?: DoorDeliverySelection) => void;
  isLoading?: boolean;
  isPhysicalProduct?: boolean;
  isCustomProduct?: boolean;
  productionDays?: number | null;
  customizationPrompt?: string | null;
  isImportedProduct?: boolean;
  importDays?: number | null;
  importNote?: string | null;
  purchaseDetails?: {
    shopName: string;
    productName: string;
    productPrice: number;
  };
}

const PhoneCheckModal: React.FC<PhoneCheckModalProps> = ({
  isOpen,
  onClose,
  onPhoneSubmit,
  isLoading = false,
  isPhysicalProduct = false,
  isCustomProduct = false,
  productionDays = null,
  customizationPrompt = null,
  isImportedProduct = false,
  importDays = null,
  importNote = null,
  purchaseDetails
}) => {
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex flex-col w-[95vw] max-w-[425px] max-h-[85dvh] p-0 gap-0 overflow-hidden rounded-3xl border border-slate-200 shadow-2xl bg-white text-slate-950">
        <DialogHeader className="p-6 sm:p-8 pb-2 shrink-0 space-y-4">
          <div className="mx-auto w-14 h-14 bg-yellow-50 border border-yellow-200 rounded-2xl flex items-center justify-center shadow-inner">
            <Phone className="h-7 w-7 text-yellow-600" />
          </div>
          <DialogTitle className="text-xl font-semibold text-center text-slate-950 tracking-tight">Complete your order</DialogTitle>
          <p className="text-center text-sm text-slate-500">Pay safely through Byblos. Your money is protected until you confirm delivery.</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="no-scrollbar flex-1 overflow-y-auto p-5 sm:p-8 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="ml-1 text-xs font-semibold text-slate-700">M-Pesa number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g. 0712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={isLoading}
                className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-950 placeholder:text-slate-400 focus-visible:ring-yellow-400 sm:h-12 sm:text-base"
              />
              {error && <p className="text-xs text-red-500 font-medium ml-1">{error}</p>}
            </div>
            <div className="space-y-3">
                <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed px-1">
                Please enter your M-Pesa number to proceed with payment.
              </p>

              {/* 🛡️ ESCROW NOTICE: Buyer Protection (CRITICAL UX FIX) */}
              {purchaseDetails && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-500">Shop</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-950 text-right truncate">{purchaseDetails.shopName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-500">Product</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-950 text-right truncate">{purchaseDetails.productName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                    <span className="text-xs font-semibold text-slate-500">Price</span>
                    <span className="text-sm sm:text-base font-semibold text-slate-950">{formatCurrency(purchaseDetails.productPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-500">Byblos service charge (2%)</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-950">{formatCurrency(displayedServiceCharge)}</span>
                  </div>
                  <p className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-[11px] font-medium leading-relaxed text-slate-600">
                    This 2% charge helps keep checkout protected, receipts clear, and your order tracked safely.
                  </p>
                  {isCustomProduct && (
                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-slate-700">
                      Custom product: made in up to {productionDays || 1} {(productionDays || 1) === 1 ? 'day' : 'days'}. Delivery starts after seller handoff.
                    </div>
                  )}
                  {isImportedProduct && !isCustomProduct && (
                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-slate-700">
                      Imported / pre-order item: expected ready in up to {importDays || 14} days. Delivery starts after seller handoff.
                      {importNote ? <span className="mt-1 block font-medium text-slate-600">{importNote}</span> : null}
                    </div>
                  )}
                  {doorDeliveryEnabled && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-500">Delivery fee</span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-950">
                        {isQuoteLoading ? 'Calculating...' : formatCurrency(displayedDeliveryFee)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                    <span className="text-xs font-semibold text-slate-500">Total to pay</span>
                    <span className="text-sm sm:text-base font-semibold text-slate-950">{formatCurrency(displayedTotal)}</span>
                  </div>
                  {canUseDoorDelivery && (
                    <div className="border-t border-slate-200 pt-3 space-y-3">
                      <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 cursor-pointer">
                        <span className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                          <Truck className="h-4 w-4 text-yellow-600" />
                          Door delivery
                        </span>
                        <input
                          type="checkbox"
                          checked={doorDeliveryEnabled}
                          disabled={isLoading}
                          onChange={(event) => setDoorDeliveryEnabled(event.target.checked)}
                          className="h-4 w-4 accent-yellow-400"
                        />
                      </label>

                      {doorDeliveryEnabled && (
                        <div className="space-y-3">
                          <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <LocationPicker
                              label="Delivery Location"
                              detailedLabel="Full Delivery Address"
                              placeholder="Search delivery location..."
                              autoPopulate={false}
                              mapClassName="h-40 sm:h-48"
                              onLocationChange={(address, coordinates) => {
                                setDeliveryLocation(createOptionalBuyerLocation(address, coordinates));
                              }}
                              className="[&_label]:!text-slate-700 [&_p]:!text-slate-500 [&_input]:!bg-white [&_input]:!text-slate-950 [&_input]:!border-slate-200 [&_input::placeholder]:!text-slate-400"
                            />
                          </div>

                          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-slate-600">Delivery fee</span>
                              <span className="text-xs font-semibold text-slate-950">
                                {isQuoteLoading ? 'Calculating...' : formatCurrency(displayedDeliveryFee)}
                              </span>
                            </div>
                            {deliveryQuote && (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold text-slate-600">Distance</span>
                                <span className="text-xs font-semibold text-slate-700">
                                  {deliveryQuote.chargeableDistanceKm} km billed
                                </span>
                              </div>
                            )}
                            {quoteError && <p className="text-xs text-red-500 font-bold">{quoteError}</p>}
                            <div className="flex items-start gap-2 rounded-xl bg-white border border-yellow-200 p-2 text-[11px] font-semibold leading-relaxed text-slate-600">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-600" />
                              <span>Mzigo Ego handles your package securely, checks it against the order, and delivers within 24 hours.</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isCustomProduct && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                  <Label htmlFor="custom-instructions" className="ml-1 text-xs font-semibold text-slate-700">Customization details</Label>
                  <p className="text-[11px] font-medium leading-relaxed text-slate-500">
                    {customizationPrompt || 'Tell the seller exactly what you want customized.'}
                  </p>
                  <Textarea
                    id="custom-instructions"
                    value={customInstructions}
                    onChange={(event) => setCustomInstructions(event.target.value)}
                    disabled={isLoading}
                    required
                    maxLength={500}
                    placeholder="Example: Black cap, white embroidery, phrase: WUEH"
                    className="min-h-[92px] rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-950 placeholder:text-slate-400 focus-visible:ring-yellow-400"
                  />
                  <p className="text-[10px] font-medium text-slate-400">{customInstructions.length}/500</p>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  <span className="text-xs font-semibold text-slate-950">Secure escrow protection</span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed font-medium">
                  Your money is 100% safe. We hold your payment in a secure escrow system and <strong>only release it to the seller after you confirm</strong> the order is received.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:gap-3 p-5 sm:p-8 pt-4 mt-auto border-t border-slate-200 shrink-0 bg-white/95 backdrop-blur-sm">
            <Button
              type="submit"
              disabled={isLoading}
              variant="secondary-byblos"
              className="w-full h-10 sm:h-12 rounded-xl font-semibold text-sm sm:text-base shadow-sm transition-all active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Checking...</span>
                </div>
              ) : 'Continue'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
              className="w-full rounded-xl text-slate-500 hover:text-slate-950 hover:bg-slate-100 font-semibold"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PhoneCheckModal;


