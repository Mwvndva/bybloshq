import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Phone, Loader2, MapPin, Truck } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import LocationPicker from '@/components/common/LocationPicker';
import { createOptionalBuyerLocation, type BuyerLocationPayload } from '@/lib/location';
import { usePhoneCheck } from './usePhoneCheck';


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
  const {
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
  } = usePhoneCheck({ isOpen, onPhoneSubmit, isPhysicalProduct, isCustomProduct, purchaseDetails });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex flex-col w-[92vw] max-w-[380px] sm:max-w-[400px] max-h-[85dvh] p-0 gap-0 overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl bg-white dark:bg-[#0d0d0d] text-slate-950 dark:text-white transition-colors duration-200">
        <DialogHeader className="p-5 sm:p-6 pb-2 shrink-0 space-y-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a]">
          <div className="mx-auto w-12 h-12 bg-yellow-50 dark:bg-yellow-400/10 border border-yellow-200 dark:border-yellow-400/20 rounded-2xl flex items-center justify-center shadow-inner">
            <Phone className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <DialogTitle className="text-lg font-bold text-center text-slate-950 dark:text-white tracking-tight">Complete your order</DialogTitle>
          <p className="text-center text-xs text-slate-600 dark:text-white/60">Pay safely through Byblos. Your money is protected until you confirm delivery.</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="no-scrollbar flex-1 overflow-y-auto p-4 sm:p-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="ml-1 text-xs font-semibold text-slate-700 dark:text-slate-300">M-Pesa number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g. 0712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={isLoading}
                className="h-10 rounded-xl border-slate-300 dark:border-white/10 bg-white dark:bg-[#141414] px-4 text-sm text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus-visible:ring-yellow-400"
              />
              {error && <p className="text-xs text-red-500 font-medium ml-1">{error}</p>}
            </div>
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-white/60 font-medium leading-relaxed px-1">
                Please enter your M-Pesa number to proceed with payment.
              </p>

              {/* 🛡️ ESCROW NOTICE: Buyer Protection */}
              {purchaseDetails && (
                <div className="bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-500 dark:text-white/50">Shop</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-950 dark:text-white text-right truncate">{purchaseDetails.shopName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-500 dark:text-white/50">Product</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-950 dark:text-white text-right truncate">{purchaseDetails.productName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 dark:border-white/10 pt-3">
                    <span className="text-xs font-semibold text-slate-500 dark:text-white/50">Price</span>
                    <span className="text-sm sm:text-base font-semibold text-slate-950 dark:text-white">{formatCurrency(purchaseDetails.productPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-500 dark:text-white/50">Byblos service charge (2%)</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-950 dark:text-white">{formatCurrency(displayedServiceCharge)}</span>
                  </div>
                  <p className="rounded-xl border border-yellow-200 dark:border-yellow-400/20 bg-yellow-50 dark:bg-yellow-400/10 px-3 py-2 text-[11px] font-medium leading-relaxed text-slate-700 dark:text-yellow-100">
                    This 2% charge helps keep checkout protected, receipts clear, and your order tracked safely.
                  </p>
                  {isCustomProduct && (
                    <div className="rounded-xl border border-yellow-200 dark:border-yellow-400/20 bg-yellow-50 dark:bg-yellow-400/10 px-3 py-2 text-[11px] font-semibold leading-relaxed text-slate-800 dark:text-yellow-100">
                      Custom product: made in up to {productionDays || 1} {(productionDays || 1) === 1 ? 'day' : 'days'}. Delivery starts after seller handoff.
                    </div>
                  )}
                  {isImportedProduct && !isCustomProduct && (
                    <div className="rounded-xl border border-yellow-200 dark:border-yellow-400/20 bg-yellow-50 dark:bg-yellow-400/10 px-3 py-2 text-[11px] font-semibold leading-relaxed text-slate-800 dark:text-yellow-100">
                      Imported / pre-order item: expected ready in up to {importDays || 14} days. Delivery starts after seller handoff.
                      {importNote ? <span className="mt-1 block font-medium text-slate-700 dark:text-yellow-200">{importNote}</span> : null}
                    </div>
                  )}
                  {doorDeliveryEnabled && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-500 dark:text-white/50">Delivery fee</span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-950 dark:text-white">
                        {isQuoteLoading ? 'Calculating...' : formatCurrency(displayedDeliveryFee)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 dark:border-white/10 pt-3">
                    <span className="text-xs font-semibold text-slate-500 dark:text-white/50">Total to pay</span>
                    <span className="text-sm sm:text-base font-semibold text-slate-950 dark:text-white">{formatCurrency(displayedTotal)}</span>
                  </div>
                  {canUseDoorDelivery && (
                    <div className="border-t border-slate-200 dark:border-white/10 pt-3 space-y-3">
                      <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/40 px-3 py-2 cursor-pointer">
                        <span className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                          <Truck className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
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
                          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/40 p-3">
                            <LocationPicker
                              label="Delivery Location"
                              detailedLabel="Full Delivery Address"
                              placeholder="Search delivery location..."
                              autoPopulate={false}
                              mapClassName="h-40 sm:h-48"
                              onLocationChange={(address, coordinates) => {
                                setDeliveryLocation(createOptionalBuyerLocation(address, coordinates));
                              }}
                              className="[&_label]:!text-slate-700 dark:[&_label]:!text-slate-200 [&_p]:!text-slate-500 dark:[&_p]:!text-white/50 [&_input]:!bg-white dark:[&_input]:!bg-[#141414] [&_input]:!text-slate-950 dark:[&_input]:!text-white [&_input]:!border-slate-200 dark:[&_input]:!border-white/10 [&_input::placeholder]:!text-slate-400 dark:[&_input::placeholder]:!text-white/40"
                            />
                          </div>

                          <div className="rounded-2xl border border-yellow-200 dark:border-yellow-400/20 bg-yellow-50 dark:bg-yellow-400/10 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-slate-600 dark:text-yellow-100/70">Delivery fee</span>
                              <span className="text-xs font-semibold text-slate-950 dark:text-yellow-100">
                                {isQuoteLoading ? 'Calculating...' : formatCurrency(displayedDeliveryFee)}
                              </span>
                            </div>
                            {deliveryQuote && (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold text-slate-600 dark:text-yellow-100/70">Distance</span>
                                <span className="text-xs font-semibold text-slate-700 dark:text-yellow-100">
                                  {deliveryQuote.chargeableDistanceKm} km billed
                                </span>
                              </div>
                            )}
                            {quoteError && <p className="text-xs text-red-500 font-bold">{quoteError}</p>}
                            <div className="flex items-start gap-2 rounded-xl bg-white dark:bg-black/40 border border-yellow-200 dark:border-yellow-400/20 p-2 text-[11px] font-semibold leading-relaxed text-slate-600 dark:text-yellow-100/80">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-600 dark:text-yellow-400" />
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
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-4 space-y-2">
                  <Label htmlFor="custom-instructions" className="ml-1 text-xs font-semibold text-slate-700 dark:text-slate-200">Customization details</Label>
                  <p className="text-[11px] font-medium leading-relaxed text-slate-500 dark:text-white/50">
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
                    className="min-h-[92px] rounded-xl border-slate-300 dark:border-white/10 bg-white dark:bg-[#141414] px-4 text-sm text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus-visible:ring-yellow-400"
                  />
                  <p className="text-[10px] font-medium text-slate-400 dark:text-white/40">{customInstructions.length}/500</p>
                </div>
              )}

              <div className="bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  <span className="text-xs font-semibold text-slate-950 dark:text-white">Secure escrow protection</span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-white/60 leading-relaxed font-medium">
                  Your money is 100% safe. We hold your payment in a secure escrow system and <strong>only release it to the seller after you confirm</strong> the order is received.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:gap-3 p-4 sm:p-5 pt-3 mt-auto border-t border-slate-200 dark:border-white/10 shrink-0 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-sm">
            <Button
              type="submit"
              disabled={isLoading}
              variant="secondary-byblos"
              className="w-full h-10 sm:h-11 rounded-xl font-bold text-sm shadow-sm transition-all active:scale-[0.98]"
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
              className="w-full rounded-xl text-slate-600 dark:text-white/60 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 font-semibold"
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


