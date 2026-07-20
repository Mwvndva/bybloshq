import { Clock, MapPin, Navigation, ShieldCheck, Truck } from 'lucide-react';
import type { ApiOrder, ApiOrderLogisticsDeliveryLeg } from '@/types/api/order';
import { deriveJourneyFromStatuses } from '@/pages/logistics/mzigoJourney';
import { MzigoJourneyStepper } from '@/pages/logistics/MzigoJourneyStepper';

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
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
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
        Updates will appear here as Mzigo Ego moves your package.
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
  const hasLogistics = Boolean(deliveryLeg || pickupLeg);
  const isSeller = view === 'seller';

  if (!hasLogistics && (!isSeller || !isPhysical)) {
    return null;
  }

  const journey = deriveJourneyFromStatuses(
    pickupLeg?.status,
    deliveryLeg?.status,
    logistics?.status === 'completed',
  );

  const fallbackDeadline = addHours(order.createdAt, 24);
  const etaSource = logistics?.deadlineAt || deliveryLeg?.deadlineAt || fallbackDeadline;

  const deliveryAddress = getDeliveryAddress(deliveryLeg, order);
  const deliveryMapLink = mapLink(deliveryLeg?.destinationLat, deliveryLeg?.destinationLng, deliveryAddress);
  const pickupAddress = pickupLeg?.originAddress || pickupLeg?.originLabel || 'Seller pickup location pending';
  const pickupMapLink = mapLink(pickupLeg?.originLat, pickupLeg?.originLng, pickupAddress);

  return (
    <section className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/[0.08] p-4 text-white">
      {/* Headline: one plain status. */}
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-yellow-300" />
        <h4 className="text-sm font-semibold text-white">
          {view === 'buyer' ? 'Delivery tracking' : 'Mzigo Ego tracking'}
        </h4>
        <span className="ml-auto rounded-full bg-black/70 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-100">
          {journey.label}
        </span>
      </div>

      {/* Journey stepper. */}
      <div className="mt-3 rounded-xl border border-white/10 bg-black/40 px-3 py-3">
        <MzigoJourneyStepper journey={journey} />
      </div>

      {/* Plain ETA. */}
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm">
        <Clock className="h-4 w-4 shrink-0 text-yellow-300" />
        <span className="text-white">
          {journey.isDelivered
            ? `Delivered ${formatDateTime(deliveryLeg?.completedAt || logistics?.completedAt || etaSource)}`
            : `Arrives by ${formatDateTime(etaSource)}`}
        </span>
      </div>

      {/* Where it's going (and, for sellers, where it's coming from). */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/40 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55">
            <MapPin className="h-3 w-3" />
            Delivery address
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

        {isSeller && pickupLeg && (
          <div className="rounded-lg border border-white/10 bg-black/40 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55">
              <MapPin className="h-3 w-3" />
              Pickup address
            </p>
            <p className="mt-1 text-sm font-semibold text-white">{pickupAddress}</p>
            {pickupMapLink && (
              <a
                href={pickupMapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-yellow-200 hover:text-yellow-100"
              >
                <Navigation className="h-3 w-3" /> Open map
              </a>
            )}
          </div>
        )}

        {deliveryLeg && (
          <div className="rounded-lg border border-white/10 bg-black/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/55">Delivery fee</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatCurrency(deliveryLeg.feeAmount || 0, deliveryLeg.feeCurrency || order.currency)}
            </p>
            {deliveryLeg.distanceKm ? (
              <p className="mt-0.5 text-xs text-white/55">{deliveryLeg.distanceKm} km route</p>
            ) : null}
          </div>
        )}
      </div>

      {/* One-line trust note (was three blocks). */}
      <p className="mt-3 flex items-start gap-2 text-xs text-white/70">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
        Mzigo Ego keeps your package safe and checks it against the order before delivery.
      </p>

      {/* Plain timeline. */}
      <div className="mt-3 rounded-xl border border-white/10 bg-black/35 p-3">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/55">
          <Clock className="h-3.5 w-3.5 text-yellow-300" />
          Updates
        </p>
        <Timeline events={logistics?.events || []} />
      </div>
    </section>
  );
}
