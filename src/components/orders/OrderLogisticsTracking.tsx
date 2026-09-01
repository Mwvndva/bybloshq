import { useState, useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  MapPin,
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

/**
 * Collapsible dropdown panel used for the tracking and logistics details sections.
 */
function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  headerRight,
  id,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  headerRight?: React.ReactNode;
  id: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
      >
        <span className="text-yellow-300">{icon}</span>
        <span className="text-sm font-semibold text-white">{title}</span>
        <span className="ml-auto flex items-center gap-2">
          {headerRight}
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-white/60 transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        <div id={id} className="border-t border-white/10 p-3">
          {children}
        </div>
      )}
    </div>
  );
}

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

function mapLink(lat?: number | string | null, lng?: number | string | null, address?: string | null) {
  const parsedLat = lat === null || lat === undefined ? NaN : Number(lat);
  const parsedLng = lng === null || lng === undefined ? NaN : Number(lng);
  if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
    return `https://www.google.com/maps?q=${parsedLat},${parsedLng}`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return null;
}

function getDeliveryAddress(leg?: ApiOrderLogisticsDeliveryLeg | null, order?: ApiOrder) {
  return leg?.destinationAddress
    || leg?.destinationLabel
    || order?.location_address
    || order?.shippingAddress?.address
    || 'Delivery address pending';
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

  const deliveryAddress = getDeliveryAddress(deliveryLeg, order);
  const deliveryMapLink = mapLink(deliveryLeg?.destinationLat, deliveryLeg?.destinationLng, deliveryAddress);

  const sellerShopAddress = order.seller?.physicalAddress || order.seller?.location || order.location_address || pickupLeg?.originAddress || 'Shop address pending';
  const sellerMapLink = mapLink(
    order.seller?.latitude ?? pickupLeg?.originLat,
    order.seller?.longitude ?? pickupLeg?.originLng,
    sellerShopAddress
  );

  return (
    <section className="mt-4 space-y-2 rounded-xl border border-yellow-400/30 bg-yellow-400/[0.08] p-2 text-white sm:p-3">
      {/* ── Fulfillment Progress & ETA (open by default) ── */}
      <CollapsibleSection
        id={`tracking-progress-${order.id}`}
        title={isDoorDelivery ? 'Delivery Tracking' : isPickup ? 'Collection Progress' : isDigital ? 'Digital Fulfillment' : 'Service Tracking'}
        icon={isDoorDelivery ? <Truck className="h-4 w-4" /> : isPickup ? <Store className="h-4 w-4" /> : isDigital ? <Download className="h-4 w-4" /> : <PackageSearch className="h-4 w-4" />}
        defaultOpen
        headerRight={
          riderMoving ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/50 bg-yellow-400/20 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-200">
              <Truck className="h-3 w-3 animate-pulse text-yellow-300" /> {liveEta?.trackingStatus === 'arriving' ? 'Arriving Now' : 'In Transit'}
            </span>
          ) : journey.isDelivered ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200">
              <CheckCircle2 className="h-3 w-3 text-emerald-300" /> {journey.label}
            </span>
          ) : (
            <span className="rounded-full bg-black/70 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-100">
              {journey.label}
            </span>
          )
        }
      >
        {/* Progress Stepper */}
        <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
          <MzigoJourneyStepper journey={journey} />
        </div>

        {/* Dynamic Movement Progress Bar */}
        <div className="mt-2.5 overflow-hidden rounded-full bg-white/10 p-0.5">
          <div
            className={cn(
              'h-1.5 rounded-full transition-all duration-500',
              journey.state === 'attention'
                ? 'bg-red-400'
                : journey.state === 'delayed'
                  ? 'bg-amber-400'
                  : journey.isDelivered
                    ? 'bg-emerald-400'
                    : riderMoving
                      ? 'bg-gradient-to-r from-yellow-500 via-amber-300 to-yellow-400 animate-pulse'
                      : 'bg-yellow-400'
            )}
            style={{ width: `${Math.min(100, Math.max(8, dynamicProgressPercent))}%` }}
          />
        </div>

        {/* Informative Status & Live ETA Badge */}
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-yellow-300" />
            <span className="text-white">
              {journey.isDelivered
                ? `${isPickup ? 'Collected' : 'Delivered'} on ${formatDateTime(deliveryLeg?.completedAt || logistics?.completedAt || order.updatedAt)}`
                : liveEta && liveEta.trackingStatus === 'arriving'
                  ? 'Arriving now (within 1 min)'
                  : liveEta && typeof liveEta.etaMinutes === 'number'
                    ? `Arriving in ${liveEta.etaMinutes} min (by ${formatDateTime(liveEta.estimatedArrival || etaSource)})`
                    : isDoorDelivery
                      ? (riderMoving ? `Arriving by ${formatDateTime(etaSource)}` : `Est. delivery by ${formatDateTime(etaSource)}`)
                      : isPickup
                        ? (order.status === 'READY_FOR_BUYER' || order.status === 'COLLECTION_PENDING'
                            ? 'Ready for pickup at Central Hub'
                            : 'Estimated ready within 24 hours')
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

        {/* Byblos CBD Hub Pickup Card if hub collection */}
        {isPickup && (
          <div className="mt-3 rounded-lg border border-white/10 bg-black/40 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-yellow-300">
              <Store className="h-3.5 w-3.5" />
              Central Hub Collection Point
            </p>
            <p className="mt-1 text-sm font-bold text-white">
              {MZIGO_CBD_HUB.name}
            </p>
            <p className="text-xs text-white/70">{MZIGO_CBD_HUB.address}</p>
            <a
              href={MZIGO_CBD_HUB.mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-1 text-xs font-semibold text-yellow-200 hover:bg-yellow-400/20"
            >
              <Navigation className="h-3 w-3" /> Get Directions to Hub
            </a>
          </div>
        )}
      </CollapsibleSection>

      {/* ── Logistics Details (collapsed by default for courier orders) ── */}
      {isDoorDelivery && (
        <CollapsibleSection
          id={`tracking-logistics-${order.id}`}
          title="Logistics Details"
          icon={<PackageSearch className="h-4 w-4" />}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-black/40 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55">
                <MapPin className="h-3 w-3" />
                Delivery Address (Buyer)
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{deliveryAddress}</p>
              {deliveryMapLink && (
                <a
                  href={deliveryMapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-yellow-200 hover:text-yellow-100"
                >
                  <Navigation className="h-3 w-3" /> Open map
                </a>
              )}
            </div>

            <div className="rounded-lg border border-white/10 bg-black/40 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55">
                <Store className="h-3 w-3" />
                Central Transit Hub
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{MZIGO_CBD_HUB.name}</p>
              <p className="text-xs text-white/70">{MZIGO_CBD_HUB.address}</p>
            </div>

            {deliveryLeg && (
              <div className="rounded-lg border border-white/10 bg-black/40 p-3 sm:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/55">Delivery Fee</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {formatCurrency(deliveryLeg.feeAmount || 0, deliveryLeg.feeCurrency || order.currency)}
                </p>
              </div>
            )}
          </div>

          <p className="mt-3 flex items-start gap-2 text-xs text-white/70">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
            Mzigo Ego Central Hub handles verification, package security, and milestone tracking.
          </p>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/35 p-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/55">
              <Clock className="h-3.5 w-3.5 text-yellow-300" />
              Fulfillment Milestones
            </p>
            <Timeline events={logistics?.events || []} />
          </div>
        </CollapsibleSection>
      )}
    </section>
  );
}
