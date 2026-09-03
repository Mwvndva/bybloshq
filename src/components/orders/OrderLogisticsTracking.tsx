import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Navigation,
  PackageSearch,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react';
import type { ApiOrder, ApiOrderLogisticsDeliveryLeg } from '@/shared/types';
import {
  MZIGO_CBD_HUB,
  deriveOrderJourney,
  isRiderMoving,
} from '@/features/logistics/utils/mzigoJourney';
import { MzigoJourneyStepper } from '@/features/logistics/components/MzigoJourneyStepper';
import { useOrderLiveEtaQuery } from '@/features/logistics/hooks/useOrderLiveEtaQuery';
import { cn } from '@/shared/utils/formatting';

type TrackingView = 'buyer' | 'seller';

interface OrderLogisticsTrackingProps {
  order: ApiOrder;
  view: TrackingView;
  isPhysical?: boolean;
  formatCurrency: (value: number | undefined, currency?: string) => string;
}

function label(value?: string | null) {
  return String(value || 'pending').replace(/_/g, ' ');
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Pending schedule';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending schedule';
  return new Intl.DateTimeFormat('en-KE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function addHours(value: string | Date | undefined, hours: number) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function Timeline({ events }: { events: NonNullable<ApiOrder['logistics']>['events'] }) {
  if (!events?.length) {
    return (
      <p className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/65">
        Updates will appear here as fulfillment progresses.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {events.slice(-5).reverse().map((event) => (
        <div key={`${event.id}-${event.createdAt}`} className="flex gap-2 rounded-lg border border-white/10 bg-black/40 p-2">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-yellow-300" />
          <div className="min-w-0">
            <p className="text-xs font-semibold capitalize text-white">{label(event.status || event.type)}</p>
            {event.message && <p className="text-xs text-white/70">{event.message}</p>}
            <p className="mt-0.5 text-[10px] text-white/45">{formatDateTime(event.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OrderLogisticsTracking({
  order,
  view,
  isPhysical = true,
  formatCurrency,
}: OrderLogisticsTrackingProps) {
  const [isOpen, setIsOpen] = useState(true);
  const logistics = order.logistics;
  const deliveryLeg = logistics?.deliveryLeg || null;
  const pickupLeg = logistics?.pickupLeg || null;
  const isSeller = view === 'seller';

  const fulfillmentType = String(order.fulfillment_type || '').toUpperCase();
  const isDoorDelivery = fulfillmentType === 'COURIER' || Boolean(deliveryLeg);
  const isPickup = fulfillmentType === 'BUYER_TO_SELLER' || (!isDoorDelivery && isPhysical);
  const isDigital = Boolean(order.isDigital || order.items?.some((i) => i.productType === 'digital' || i.isDigital));
  const isService = Boolean(order.items?.some((i) => i.productType === 'service'));

  const journey = useMemo(() => deriveOrderJourney(order), [order]);
  const riderMoving = isDoorDelivery && isRiderMoving(deliveryLeg);

  // Poll live ETA when order is actively in transit
  const isTrackingActive = isDoorDelivery && (riderMoving || deliveryLeg?.status === 'out_for_delivery' || pickupLeg?.status === 'started');
  const { data: liveEta } = useOrderLiveEtaQuery(order.id, Boolean(isTrackingActive));

  const fallbackDeadline = addHours(order.createdAt, 24);
  const etaSource = liveEta?.estimatedArrival || deliveryLeg?.deadlineAt || logistics?.deadlineAt || fallbackDeadline;

  // Derive movement-based progress bar percentage
  const dynamicProgressPercent = useMemo(() => {
    if (journey.isDelivered || order.status === 'COMPLETED') return 100;
    if (liveEta && typeof liveEta.routeProgress === 'number' && liveEta.routeProgress > 0) {
      return Math.round(liveEta.routeProgress * 100);
    }
    return journey.percentProgress;
  }, [journey.isDelivered, journey.percentProgress, order.status, liveEta]);

  // Dynamic header title based on role and fulfillment type
  const headerTitle = isSeller
    ? isDoorDelivery
      ? 'Dispatch & Delivery Tracking'
      : isPickup
        ? 'Hub Collection Tracking'
        : isDigital
          ? 'Digital Order Fulfillment'
          : 'Service Appointment Tracking'
    : isDoorDelivery
      ? 'Delivery & Logistics Tracking'
      : isPickup
        ? 'Collection & Logistics Progress'
        : isDigital
          ? 'Digital Fulfillment'
          : 'Service Tracking';

  const headerIcon = isDoorDelivery ? (
    <Truck className="h-4 w-4" />
  ) : isPickup ? (
    <Store className="h-4 w-4" />
  ) : isDigital ? (
    <Download className="h-4 w-4" />
  ) : (
    <PackageSearch className="h-4 w-4" />
  );

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-yellow-400/30 bg-yellow-400/[0.08] text-white">
      {/* ── Single Master Dropdown Header ── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={`logistics-unified-${order.id}`}
        className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-white/5"
      >
        <span className="text-yellow-300">{headerIcon}</span>
        <span className="text-xs sm:text-sm font-semibold text-white truncate">{headerTitle}</span>

        <span className="ml-auto flex items-center gap-2 shrink-0">
          {riderMoving ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/50 bg-yellow-400/20 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-200">
              <Truck className="h-3 w-3 animate-pulse text-yellow-300" />
              {liveEta?.trackingStatus === 'arriving'
                ? 'Arriving Now'
                : typeof liveEta?.etaMinutes === 'number'
                  ? `In Transit • ${liveEta.etaMinutes}m`
                  : 'In Transit'}
            </span>
          ) : journey.isDelivered || order.status === 'COMPLETED' ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200">
              <CheckCircle2 className="h-3 w-3 text-emerald-300" />
              {isSeller ? 'Delivered & Released' : journey.label}
            </span>
          ) : isPickup && (order.status === 'READY_FOR_BUYER' || order.status === 'COLLECTION_PENDING') ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/50 bg-yellow-400/20 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-200">
              {isSeller ? 'Waiting for Buyer' : 'Ready for Pickup'}
            </span>
          ) : (
            <span className="rounded-full bg-black/70 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-100">
              {journey.label}
            </span>
          )}

          <ChevronDown className={cn('h-4 w-4 shrink-0 text-white/60 transition-transform duration-200', isOpen && 'rotate-180')} />
        </span>
      </button>

      {/* ── Unified Dropdown Body ── */}
      {isOpen && (
        <div id={`logistics-unified-${order.id}`} className="space-y-3 border-t border-white/10 p-3 pt-3.5">
          {/* Tier 1: Visual Stepper */}
          <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
            <MzigoJourneyStepper journey={journey} />
          </div>

          {/* Dynamic Movement Progress Bar */}
          <div className="overflow-hidden rounded-full bg-white/10 p-0.5">
            <div
              className={cn(
                'h-1.5 rounded-full transition-all duration-500',
                journey.state === 'attention'
                  ? 'bg-red-400'
                  : journey.state === 'delayed'
                    ? 'bg-amber-400'
                    : journey.isDelivered || order.status === 'COMPLETED'
                      ? 'bg-emerald-400'
                      : riderMoving
                        ? 'bg-gradient-to-r from-yellow-500 via-amber-300 to-yellow-400 animate-pulse'
                        : 'bg-yellow-400'
              )}
              style={{ width: `${Math.min(100, Math.max(8, dynamicProgressPercent))}%` }}
            />
          </div>

          {/* Live ETA & Status Headline Card */}
          <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-yellow-300" />
              <span className="text-white font-medium text-xs sm:text-sm">
                {journey.isDelivered || order.status === 'COMPLETED'
                  ? isSeller
                    ? `Delivered on ${formatDateTime(deliveryLeg?.completedAt || logistics?.completedAt || order.updatedAt)} — Escrow released`
                    : `${isPickup ? 'Collected' : 'Delivered'} on ${formatDateTime(deliveryLeg?.completedAt || logistics?.completedAt || order.updatedAt)}`
                  : liveEta && liveEta.trackingStatus === 'arriving'
                    ? isSeller ? 'Rider arriving at buyer destination now' : 'Arriving now (within 1 min)'
                    : liveEta && typeof liveEta.etaMinutes === 'number'
                      ? isSeller
                        ? `Rider en route to buyer • ETA ~${liveEta.etaMinutes} min (by ${formatDateTime(liveEta.estimatedArrival || etaSource)})`
                        : `Arriving in ${liveEta.etaMinutes} min (by ${formatDateTime(liveEta.estimatedArrival || etaSource)})`
                      : isDoorDelivery
                        ? isSeller
                          ? riderMoving
                            ? `En route to customer • Est. ${formatDateTime(etaSource)}`
                            : `Preparing for dispatch • Est. delivery ${formatDateTime(etaSource)}`
                          : riderMoving
                            ? `Arriving by ${formatDateTime(etaSource)}`
                            : `Est. delivery by ${formatDateTime(etaSource)}`
                        : isPickup
                          ? order.status === 'READY_FOR_BUYER' || order.status === 'COLLECTION_PENDING'
                            ? isSeller
                              ? 'Parcel securely held at Central Hub — Buyer notified to collect'
                              : 'Ready for collection at Central Hub'
                            : isSeller
                              ? 'Awaiting handoff to Central Hub for collection'
                              : 'Estimated ready within 24 hours'
                          : isDigital
                            ? 'Instant access available'
                            : 'Booking active'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {liveEta?.isStale && (
                <span className="text-[11px] text-amber-300">
                  Location update delayed
                </span>
              )}
              <span className="text-xs text-white/70">
                {liveEta?.lastUpdatedAt && !liveEta.isStale
                  ? 'Updated just now'
                  : journey.detail}
              </span>
            </div>
          </div>

          {/* Tier 2: Specs Strip (Door Delivery vs. Hub Collection) */}
          {isDoorDelivery && (
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-black/40 p-2.5 sm:p-3">
                <p className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-white/55">
                  <Truck className="h-3 w-3 text-yellow-300" />
                  {isSeller ? 'Logistics Type' : 'Fulfillment Mode'}
                </p>
                <p className="mt-0.5 text-xs sm:text-sm font-semibold text-white">Door Delivery</p>
                <p className="text-[11px] text-white/70">
                  {isSeller ? 'Store ➔ Hub ➔ Buyer' : 'Handled by Mzigo Ego'}
                </p>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/40 p-2.5 sm:p-3">
                <p className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-white/55">
                  <Store className="h-3 w-3 text-yellow-300" />
                  Central Transit Hub
                </p>
                <p className="mt-0.5 text-xs sm:text-sm font-semibold text-white">{MZIGO_CBD_HUB.name}</p>
                <p className="text-[11px] text-white/70 truncate">{MZIGO_CBD_HUB.address}</p>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/40 p-2.5 sm:p-3">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-white/55">
                  {isSeller ? 'Escrow Status' : 'Delivery Fee'}
                </p>
                <p className="mt-0.5 text-xs sm:text-sm font-semibold text-white">
                  {isSeller
                    ? journey.isDelivered || order.status === 'COMPLETED'
                      ? 'Funds Released'
                      : 'Held in Escrow'
                    : formatCurrency(deliveryLeg?.feeAmount || 0, deliveryLeg?.feeCurrency || order.currency)}
                </p>
                <p className="text-[11px] text-white/70">
                  {isSeller
                    ? journey.isDelivered || order.status === 'COMPLETED'
                      ? 'Settled to wallet'
                      : 'Unlocks upon delivery'
                    : 'Paid by customer'}
                </p>
              </div>
            </div>
          )}

          {/* Central Hub Collection Point Card if pickup */}
          {isPickup && (
            <div className="rounded-lg border border-white/10 bg-black/40 p-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-yellow-300">
                    <Store className="h-3.5 w-3.5" />
                    Central Hub Collection Point
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {MZIGO_CBD_HUB.name}
                  </p>
                  <p className="text-xs text-white/70">{MZIGO_CBD_HUB.address} • Mon - Sat (8:00 AM - 7:00 PM)</p>
                  {isSeller ? (
                    <p className="mt-1 text-xs text-emerald-300 font-medium">
                      Handoff package to Central Hub. Escrow releases automatically once buyer collects.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-yellow-200/90 font-medium">
                      Bring your Order ID or phone number for instant package release.
                    </p>
                  )}
                </div>

                {!isSeller && (
                  <a
                    href={MZIGO_CBD_HUB.mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 sm:mt-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3 py-1.5 text-xs font-semibold text-yellow-200 hover:bg-yellow-400/20 shrink-0 transition-colors"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Get Directions
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Tier 3: Milestones Timeline & Security Notice */}
          {isPhysical && (
            <div className="rounded-xl border border-white/10 bg-black/35 p-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/55">
                <Clock className="h-3.5 w-3.5 text-yellow-300" />
                {isSeller ? 'Dispatch & Audit Trail' : isDoorDelivery ? 'Fulfillment Milestones' : 'Collection Timeline'}
              </p>
              <Timeline events={logistics?.events || []} />

              <p className="mt-3 flex items-start gap-2 text-xs text-white/70 border-t border-white/5 pt-2.5">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                {isSeller
                  ? 'Settlement Notice: Your earnings unlock automatically upon verified delivery receipt.'
                  : 'Mzigo Ego Central Hub handles verification, package security, and milestone tracking.'}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
