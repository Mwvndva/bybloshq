import { useRef, type TouchEvent } from 'react';
import { Calendar, ChevronDown, Loader2, MapPin, Minus, Plus, ShoppingBag, Trash2, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, getImageUrl } from '@/shared/utils/formatting';
import { Input } from '@/shared/ui/input';
import LocationPicker from '@/shared/components/LocationPicker';
import { BuyerInfoModal } from '@/shared/components/BuyerInfoModal';
import { ServiceBookingModal } from '@/shared/components/ServiceBookingModal';
import { PaymentStatusModal } from '@/features/payments/components/PaymentStatusModal';
import { createOptionalBuyerLocation } from '@/infrastructure/location/location';
import { usePhoneCheck } from '@/shared/components/usePhoneCheck';
import type { Theme } from '@/features/shop/utils/productCardUtils';
import { useBag } from '../bag/BagContext';
import { useBagCheckout } from '../bag/useBagCheckout';

const SWIPE_DOWN_DISMISS_PX = 60;

/**
 * The seller-shop bag: a collapsed count bar that expands into the full inline
 * checkout. Items + summary are pinned; everything from "Door delivery" down
 * scrolls, so the door-delivery location picker and (for services) the booking
 * flow fit comfortably. Themed with the shop theme (--theme-accent / --theme-card-bg / --theme-text / --theme-border).
 */
export function BagSheet() {
  const bag = useBag();
  const checkout = useBagCheckout(bag);
  const startY = useRef<number | null>(null);

  const shopName = bag.items[0]?.product.seller?.shopName || 'Shop';
  const theme = (bag.items[0]?.product.seller?.theme as Theme) || 'default';
  const canDoorDeliver = checkout.anyPhysical && !checkout.hasService;

  const phoneCheck = usePhoneCheck({
    isOpen: bag.isOpen,
    onPhoneSubmit: checkout.handlePhoneSubmit,
    isPhysicalProduct: canDoorDeliver,
    isCustomProduct: false,
    purchaseDetails: { shopName, productName: bag.count > 1 ? `${bag.count} products` : (bag.items[0]?.product.name || 'Your bag'), productPrice: bag.subtotal },
  });

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => { startY.current = e.touches[0]?.clientY ?? null; };
  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? startY.current;
    if (endY - startY.current > SWIPE_DOWN_DISMISS_PX) bag.close();
    startY.current = null;
  };

  const bagHasItems = bag.count > 0;

  return (
    <>
      {/* Collapsed footer. */}
      {bagHasItems && !bag.isOpen && (
        <button
          type="button"
          onClick={bag.open}
          aria-label={`View bag, ${bag.count} ${bag.count === 1 ? 'product' : 'products'}`}
          className="fixed inset-x-0 bottom-0 z-40 flex flex-col items-center"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <span className="relative z-10 -mb-4 flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-black shadow-lg" style={{ backgroundColor: 'var(--theme-accent, #f5c518)', color: 'var(--theme-button-text, #111)' }}>
            {bag.count}
          </span>
          <span className="flex w-full items-center justify-center gap-2 rounded-t-3xl border-t px-6 pb-3 pt-5 text-sm font-black uppercase tracking-wide shadow-[0_-10px_30px_rgba(0,0,0,0.25)]" style={{ backgroundColor: 'var(--theme-card-bg, #0a0a0a)', color: 'var(--theme-text, #fff)', borderColor: 'var(--theme-border, rgba(255,255,255,0.1))' }}>
            <ShoppingBag className="h-4 w-4" style={{ color: 'var(--theme-accent, #f5c518)' }} />
            Tap to view bag
          </span>
        </button>
      )}

      {/* Expanded inline checkout. */}
      {bagHasItems && bag.isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button type="button" aria-label="Close bag" onClick={bag.close} className="absolute inset-0 bg-black/50" />
          <form
            onSubmit={phoneCheck.handleSubmit}
            className="relative flex max-h-[92vh] flex-col rounded-t-3xl border-t shadow-2xl"
            style={{ backgroundColor: 'var(--theme-card-bg, #0a0a0a)', color: 'var(--theme-text, #fff)', borderColor: 'var(--theme-border, rgba(255,255,255,0.12))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* ── Pinned: header + items + summary (stagnant, above door delivery) ── */}
            <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="shrink-0 cursor-grab px-5 pt-2.5">
              <span className="mx-auto block h-1.5 w-10 rounded-full" style={{ backgroundColor: 'var(--theme-border, rgba(255,255,255,0.25))' }} />
              <div className="mt-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-black"><ShoppingBag className="h-4 w-4" style={{ color: 'var(--theme-accent, #f5c518)' }} /> Your bag</h3>
                <button type="button" onClick={bag.close} aria-label="Collapse bag" className="rounded-full p-1.5 hover:bg-white/10"><ChevronDown className="h-5 w-5" /></button>
              </div>
            </div>

            <div className="max-h-[26vh] shrink-0 overflow-y-auto px-5 pt-3">
              <ul className="space-y-2">
                {bag.items.map((line) => (
                  <li key={String(line.product.id)} className="flex items-center gap-3 rounded-2xl border p-2" style={{ borderColor: 'var(--theme-border, rgba(255,255,255,0.1))' }}>
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/10">
                      {line.product.image_url ? <img src={getImageUrl(line.product.image_url)} alt={line.product.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center opacity-40"><ShoppingBag className="h-4 w-4" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{line.product.name}</p>
                      <p className="text-xs font-semibold opacity-70">{formatCurrency(Number(line.product.price) || 0)}</p>
                    </div>
                    {!checkout.hasService && (
                      <div className="flex items-center gap-1.5">
                        <button type="button" aria-label="Decrease" onClick={() => bag.setQuantity(line.product.id, line.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-full border" style={{ borderColor: 'var(--theme-border, rgba(255,255,255,0.15))' }}><Minus className="h-3.5 w-3.5" /></button>
                        <span className="w-5 text-center text-sm font-black tabular-nums">{line.quantity}</span>
                        <button type="button" aria-label="Increase" onClick={() => bag.setQuantity(line.product.id, line.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded-full border" style={{ borderColor: 'var(--theme-border, rgba(255,255,255,0.15))' }}><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                    <button type="button" aria-label={`Remove ${line.product.name}`} onClick={() => bag.removeProduct(line.product.id)} className="rounded-full p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="shrink-0 border-b px-5 py-3" style={{ borderColor: 'var(--theme-border, rgba(255,255,255,0.1))' }}>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between opacity-80"><dt>Subtotal</dt><dd className="font-semibold tabular-nums">{formatCurrency(bag.subtotal)}</dd></div>
                <div className="flex justify-between opacity-80"><dt>Byblos service charge (2%)</dt><dd className="font-semibold tabular-nums">{formatCurrency(bag.serviceCharge)}</dd></div>
                {phoneCheck.doorDeliveryEnabled && <div className="flex justify-between opacity-80"><dt>Delivery fee</dt><dd className="font-semibold tabular-nums">{phoneCheck.isQuoteLoading ? '…' : formatCurrency(phoneCheck.displayedDeliveryFee)}</dd></div>}
                <div className="flex justify-between text-base font-black"><dt>Total</dt><dd className="tabular-nums">{formatCurrency(phoneCheck.displayedTotal)}</dd></div>
              </dl>
            </div>

            {/* ── Scrollable: door delivery / booking / payment number (from door delivery down) ── */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {/* Service booking (single service in bag). */}
              {checkout.hasService && (
                <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--theme-border, rgba(255,255,255,0.12))' }}>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Calendar className="h-4 w-4" style={{ color: 'var(--theme-accent, #f5c518)' }} /> Service booking</div>
                  {checkout.booking ? (
                    <div className="text-xs opacity-80">
                      <p className="font-semibold">{format(checkout.booking.date, 'EEE, d MMM yyyy')} at {checkout.booking.time}</p>
                      <p className="mt-0.5 truncate">{checkout.booking.location}</p>
                    </div>
                  ) : (
                    <p className="text-xs opacity-70">Pick a date, time and location to book this service.</p>
                  )}
                  <button type="button" onClick={() => checkout.setIsBookingModalOpen(true)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold" style={{ borderColor: 'var(--theme-accent, #f5c518)', color: 'var(--theme-accent, #f5c518)' }}>
                    {checkout.booking ? 'Change booking' : 'Set date, time & location'}
                  </button>
                </div>
              )}

              {/* Door delivery (physical bag) with inline location picker. */}
              {canDoorDeliver && (
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--theme-border, rgba(255,255,255,0.12))' }}>
                    <span className="flex items-center gap-2 text-sm font-bold"><Truck className="h-4 w-4" style={{ color: 'var(--theme-accent, #f5c518)' }} /> Door delivery</span>
                    <input type="checkbox" checked={phoneCheck.doorDeliveryEnabled} onChange={(e) => phoneCheck.setDoorDeliveryEnabled(e.target.checked)} className="h-4 w-4 accent-[var(--theme-accent,#f5c518)]" />
                  </label>
                  {phoneCheck.doorDeliveryEnabled && (
                    <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--theme-border, rgba(255,255,255,0.12))' }}>
                      <LocationPicker
                        label="Delivery Location"
                        detailedLabel="Full Delivery Address"
                        placeholder="Search delivery location..."
                        autoPopulate={false}
                        mapClassName="h-44"
                        onLocationChange={(address, coordinates) => phoneCheck.setDeliveryLocation(createOptionalBuyerLocation(address, coordinates))}
                      />
                      {phoneCheck.quoteError && <p className="mt-2 text-xs font-bold text-red-500">{phoneCheck.quoteError}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Mobile payment number. */}
              <div className="space-y-1.5">
                <label htmlFor="bag-phone" className="text-xs font-bold opacity-70">M-Pesa number</label>
                <Input id="bag-phone" type="tel" inputMode="tel" placeholder="e.g. 0712345678" value={phoneCheck.phone} onChange={(e) => phoneCheck.setPhone(e.target.value)} className="h-11 rounded-xl bg-white/5 text-[var(--theme-text)]" />
                {phoneCheck.error && <p className="text-xs font-medium text-red-500">{phoneCheck.error}</p>}
              </div>

              <p className="flex items-start gap-2 text-[11px] opacity-70">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--theme-accent, #f5c518)' }} />
                Your money is held in escrow and only released to the seller after you confirm the order.
              </p>
            </div>

            {/* Pinned Pay. */}
            <div className="shrink-0 border-t px-5 pb-4 pt-3" style={{ borderColor: 'var(--theme-border, rgba(255,255,255,0.1))' }}>
              <button type="submit" disabled={checkout.isProcessingPurchase} className="flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-black shadow-lg transition-transform active:scale-[0.99] disabled:opacity-60" style={{ backgroundColor: 'var(--theme-accent, #f5c518)', color: 'var(--theme-button-text, #111)' }}>
                {checkout.isProcessingPurchase ? <Loader2 className="h-5 w-5 animate-spin" /> : `Pay ${formatCurrency(phoneCheck.displayedTotal)}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Service booking uses the existing flow. */}
      {checkout.hasService && bag.items[0] && (
        <ServiceBookingModal
          product={bag.items[0].product}
          isOpen={checkout.isBookingModalOpen}
          onClose={() => checkout.setIsBookingModalOpen(false)}
          onConfirm={checkout.handleBookingConfirm}
          initialBuyerLocation={null}
        />
      )}

      <BuyerInfoModal
        isOpen={checkout.isBuyerModalOpen}
        onClose={() => checkout.setIsBuyerModalOpen(false)}
        onSubmit={async (buyerInfo) => {
          await checkout.handleBuyerInfoSubmit({ ...buyerInfo, fullName: buyerInfo.fullName || `${buyerInfo.firstName} ${buyerInfo.lastName}`.trim() }, checkout.shouldSkipSave);
        }}
        isLoading={checkout.isProcessingPurchase}
        theme={theme}
        phoneNumber={checkout.currentPhone}
        initialData={checkout.initialBuyerData}
      />

      <PaymentStatusModal {...checkout.paymentModalData} onClose={checkout.closePaymentModal} />
    </>
  );
}

export default BagSheet;
