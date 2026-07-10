import { CalendarClock, Clock, MapPin, Route, ShieldCheck, Truck } from 'lucide-react';
import type { ApiOrder, ApiOrderLogisticsDeliveryLeg } from '@/types/api/order';

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

function StatBox({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail?: string | null;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/55 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">{title}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-white">{value}</p>
      {detail && <p className="mt-1 text-xs text-white/65">{detail}</p>}
    </div>
  );
}

function Timeline({ events }: { events: NonNullable<ApiOrder['logistics']>['events'] }) {
  if (!events?.length) {
    return (
      <p className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/65">
        Timeline will appear as Mzigo Ego updates this package.
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

  const fallbackDropoffDeadline = addHours(order.createdAt, 24);
  const hubDropoffDeadline = logistics?.deadlineAt || deliveryLeg?.deadlineAt || fallbackDropoffDeadline;
  const deliveryAddress = getDeliveryAddress(deliveryLeg, order);
  const deliveryMapLink = mapLink(
    deliveryLeg?.destinationLat,
    deliveryLeg?.destinationLng,
    deliveryAddress
  );
  const pickupAddress = pickupLeg?.originAddress || pickupLeg?.originLabel || 'Seller pickup location pending';
  const pickupMapLink = mapLink(pickupLeg?.originLat, pickupLeg?.originLng, pickupAddress);
  const latestMessage = logistics?.events?.[logistics.events.length - 1]?.message;

  return (
    <section className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-white">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-yellow-300" />
            <h4 className="text-sm font-semibold text-white">
              {view === 'buyer' ? 'Door delivery tracking' : 'Mzigo Ego logistics tracking'}
            </h4>
          </div>
          <p className="mt-1 text-xs text-white/75">
            {latestMessage || (view === 'buyer'
              ? 'Mzigo Ego handles your package securely and checks it against the order before delivery.'
              : 'Choose drop-off or pickup so Mzigo Ego can secure and check the package.')}
          </p>
        </div>
        <span className="w-fit rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold capitalize text-yellow-100">
          {label(deliveryLeg?.status || pickupLeg?.status || logistics?.status)}
        </span>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
        {deliveryLeg && (
          <>
            <StatBox
              title="Delivery status"
              value={label(deliveryLeg.status)}
              detail="Estimated within 24 hours"
            />
            <StatBox
              title="Delivery fee"
              value={formatCurrency(deliveryLeg.feeAmount || 0, deliveryLeg.feeCurrency || order.currency)}
              detail={`${deliveryLeg.distanceKm || 0} km billed route`}
            />
            <div className="rounded-lg border border-white/10 bg-black/55 p-3 sm:col-span-2">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-white/55">
                <MapPin className="h-3 w-3" />
                Delivery address
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{deliveryAddress}</p>
              {deliveryMapLink && (
                <a
                  href={deliveryMapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex text-xs font-semibold text-yellow-200 hover:text-yellow-100"
                >
                  Open map
                </a>
              )}
            </div>
          </>
        )}

        {isSeller && pickupLeg && (
          <>
            <StatBox
              title="Pickup status"
              value={label(pickupLeg.status)}
              detail={formatCurrency(pickupLeg.feeAmount || 0, pickupLeg.feeCurrency || order.currency)}
            />
            <div className="rounded-lg border border-white/10 bg-black/55 p-3 sm:col-span-2">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-white/55">
                <Route className="h-3 w-3" />
                Pickup address
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{pickupAddress}</p>
              {pickupMapLink && (
                <a
                  href={pickupMapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex text-xs font-semibold text-yellow-200 hover:text-yellow-100"
                >
                  Open pickup map
                </a>
              )}
            </div>
          </>
        )}

        {isSeller && !pickupLeg && isPhysical && (
          <div className="rounded-lg border border-white/10 bg-black/55 p-3 sm:col-span-2">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-white/55">
              <CalendarClock className="h-3 w-3" />
              Hub drop-off deadline
            </p>
            <p className="mt-1 text-sm font-semibold text-white">{formatDateTime(hubDropoffDeadline)}</p>
            <p className="mt-1 text-xs text-white/65">
              No seller pickup is active. Drop this package at Mzigo Ego within 24 hours.
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <div>
            <p className="text-xs font-semibold text-emerald-100">Secure Mzigo Ego handling</p>
            <p className="mt-1 text-xs leading-relaxed text-white/75">
              {view === 'buyer'
                ? 'Mzigo Ego keeps the package safe and checks it against your order before delivery.'
                : 'Mzigo Ego keeps the package safe and checks it against the buyer order before it moves forward.'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/35 p-3">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
          <Clock className="h-3.5 w-3.5 text-yellow-300" />
          Logistics timeline
        </p>
        <Timeline events={logistics?.events || []} />
      </div>
    </section>
  );
}


