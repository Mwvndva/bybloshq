import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, Loader2, MapPin, Truck } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import LocationPicker from '@/components/common/LocationPicker';
import apiClient from '@/lib/apiClient';

export interface DoorDeliverySelection {
  doorDelivery: boolean;
  address?: string;
  lat?: number;
  lng?: number;
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
  purchaseDetails
}) => {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [doorDeliveryEnabled, setDoorDeliveryEnabled] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState<{ address: string; lat: number | null; lng: number | null }>({
    address: '',
    lat: null,
    lng: null
  });
  const [deliveryQuote, setDeliveryQuote] = useState<DoorDeliverySelection['quote'] | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);

  const productPrice = Number(purchaseDetails?.productPrice || 0);
  const displayedDeliveryFee = doorDeliveryEnabled ? Number(deliveryQuote?.feeAmount || 0) : 0;
  const displayedTotal = productPrice + displayedDeliveryFee;

  useEffect(() => {
    if (!isOpen) {
      setError('');
      setDoorDeliveryEnabled(false);
      setDeliveryLocation({ address: '', lat: null, lng: null });
      setDeliveryQuote(null);
      setQuoteError('');
      setIsQuoteLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!doorDeliveryEnabled) {
      setDeliveryQuote(null);
      setQuoteError('');
      setIsQuoteLoading(false);
      return;
    }

    if (deliveryLocation.lat === null || deliveryLocation.lng === null) {
      setDeliveryQuote(null);
      setQuoteError('');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsQuoteLoading(true);
      setQuoteError('');
      try {
        const response = await apiClient.post('/payments/logistics-quote', {
          legType: 'delivery',
          location: {
            address: deliveryLocation.address,
            latitude: deliveryLocation.lat,
            longitude: deliveryLocation.lng
          }
        }, {
          signal: controller.signal
        });
        const quote = response.data?.data;
        const feeAmount = Number(quote?.feeAmount || 0);
        setDeliveryQuote({
          feeAmount,
          distanceKm: Number(quote?.distanceKm || 0),
          chargeableDistanceKm: Number(quote?.chargeableDistanceKm || 0),
          rateKesPerKm: Number(quote?.rateKesPerKm || 40),
          totalAmount: productPrice + feeAmount
        });
      } catch (quoteError: any) {
        if (quoteError?.name !== 'CanceledError' && quoteError?.code !== 'ERR_CANCELED') {
          setDeliveryQuote(null);
          setQuoteError(quoteError?.response?.data?.error || quoteError?.message || 'Could not calculate delivery fee');
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
  }, [doorDeliveryEnabled, deliveryLocation.address, deliveryLocation.lat, deliveryLocation.lng, productPrice]);

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

    if (doorDeliveryEnabled) {
      if (!deliveryLocation.address.trim() || deliveryLocation.lat === null || deliveryLocation.lng === null) {
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

    onPhoneSubmit(phone.trim(), doorDeliveryEnabled ? {
      doorDelivery: true,
      address: deliveryLocation.address.trim(),
      lat: deliveryLocation.lat ?? undefined,
      lng: deliveryLocation.lng ?? undefined,
      quote: deliveryQuote ?? undefined
    } : { doorDelivery: false });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex flex-col w-[95vw] max-w-[425px] max-h-[85dvh] p-0 gap-0 overflow-hidden rounded-3xl border border-slate-200 shadow-2xl bg-white text-slate-950">
        <DialogHeader className="p-6 sm:p-8 pb-2 shrink-0 space-y-4">
          <div className="mx-auto w-14 h-14 bg-yellow-50 border border-yellow-100 rounded-2xl flex items-center justify-center shadow-inner">
            <Phone className="h-7 w-7 text-yellow-400" />
          </div>
          <DialogTitle className="text-xl font-black text-center text-slate-950 uppercase tracking-tight">Mobile Payment Number</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-5 sm:p-8 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-wider text-slate-500 ml-1">M-Pesa Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g. 0712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={isLoading}
                className="rounded-xl border-slate-200 focus-visible:ring-yellow-400 h-10 sm:h-12 bg-white text-sm sm:text-base px-4 text-slate-950 placeholder:text-slate-400"
              />
              {error && <p className="text-xs text-red-500 font-medium ml-1">{error}</p>}
            </div>
            <div className="space-y-3">
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed px-1">
                Please enter your M-Pesa number to proceed with payment.
              </p>

              {/* 🛡️ ESCROW NOTICE: Buyer Protection (CRITICAL UX FIX) */}
              {purchaseDetails && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-yellow-300">Shop</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-950 text-right truncate">{purchaseDetails.shopName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-yellow-300">Product</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-950 text-right truncate">{purchaseDetails.productName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-yellow-200 pt-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-yellow-300">Price</span>
                    <span className="text-sm sm:text-base font-black text-yellow-300">{formatCurrency(purchaseDetails.productPrice)}</span>
                  </div>
                  {isPhysicalProduct && (
                    <div className="border-t border-yellow-200 pt-3 space-y-3">
                      <label className="flex items-center justify-between gap-3 rounded-xl border border-yellow-200 bg-white/70 px-3 py-2 cursor-pointer">
                        <span className="flex items-center gap-2 text-xs font-black text-slate-950">
                          <Truck className="h-4 w-4 text-yellow-500" />
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
                          <div className="rounded-2xl border border-yellow-200 bg-white p-3">
                            <LocationPicker
                              label="Delivery Location"
                              detailedLabel="Full Delivery Address"
                              placeholder="Search delivery location..."
                              autoPopulate
                              onLocationChange={(address, coordinates) => {
                                setDeliveryLocation({
                                  address,
                                  lat: coordinates?.lat ?? null,
                                  lng: coordinates?.lng ?? null
                                });
                              }}
                              className="[&_label]:!text-slate-700 [&_p]:!text-slate-500"
                            />
                          </div>

                          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500">Delivery fee</span>
                              <span className="text-xs font-black text-slate-950">
                                {isQuoteLoading ? 'Calculating...' : formatCurrency(displayedDeliveryFee)}
                              </span>
                            </div>
                            {deliveryQuote && (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500">Distance</span>
                                <span className="text-xs font-bold text-slate-700">
                                  {deliveryQuote.chargeableDistanceKm} km billed
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-3 border-t border-yellow-200 pt-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500">Total to pay</span>
                              <span className="text-sm font-black text-slate-950">{formatCurrency(displayedTotal)}</span>
                            </div>
                            {quoteError && <p className="text-xs text-red-500 font-bold">{quoteError}</p>}
                            <div className="flex items-start gap-2 rounded-xl bg-white p-2 text-[11px] font-bold leading-relaxed text-slate-700">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />
                              <span>Deliveries are made within 24 hours.</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-green-500">Secure Escrow Protection</span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed font-medium">
                  Your money is 100% safe. We hold your payment in a secure escrow system and <strong>only release it to the seller after you confirm</strong> the order is received.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:gap-3 p-5 sm:p-8 pt-4 mt-auto border-t border-slate-100 shrink-0 bg-slate-50/70 backdrop-blur-sm">
            <Button
              type="submit"
              disabled={isLoading}
              variant="secondary-byblos"
              className="w-full h-10 sm:h-12 rounded-xl font-black text-sm sm:text-base shadow-lg transition-all active:scale-[0.98]"
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
              className="w-full rounded-xl text-slate-500 hover:text-slate-950 hover:bg-slate-100 font-bold"
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

