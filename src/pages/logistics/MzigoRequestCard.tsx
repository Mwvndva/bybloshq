import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, MapPin, Navigation, Phone, ShoppingBag, Store, UserRound } from 'lucide-react';
import { LogisticsLegType, LogisticsRequestCard, LogisticsStatusUpdate } from '@/api/logistics';
import { getImageUrl } from '@/lib/utils';
import { deadlineText, formatCurrency, formatDate, statusLabel } from './mzigoDashboard.utils';
import { courierActions, deriveJourney, routeLink } from './mzigoJourney';
import { MzigoJourneyStepper } from './MzigoJourneyStepper';

function CallButton({ name, phone }: { name: string; phone?: string | null }) {
  if (!phone) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/40">
        <Phone size={13} />
        {name}: no number
      </span>
    );
  }
  return (
    <a
      href={`tel:${phone}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
    >
      <Phone size={13} />
      Call {name}
    </a>
  );
}

export function RequestCard({
  request,
  tone,
  now,
  onStatusUpdate,
  updatingStatusKey,
  readOnly = false,
}: {
  request: LogisticsRequestCard;
  tone: string;
  now: number;
  onStatusUpdate: (requestId: number, legType: LogisticsLegType, status: LogisticsStatusUpdate) => void;
  updatingStatusKey?: string | null;
  readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const primaryProduct = request.product.items[0];
  const productSummary = request.product.summary || primaryProduct?.name || 'Package';
  const imageSrc = primaryProduct?.imageUrl ? getImageUrl(primaryProduct.imageUrl) : '';
  const isCompleted = readOnly || request.isCompleted || request.status === 'completed';
  const completedAt = request.completedAt || request.order.completedAt || null;

  const journey = deriveJourney(request);
  const actions = isCompleted ? null : courierActions(request);
  const route = routeLink(request);

  const sellerDisplayName = request.seller.shopName || request.seller.name || 'Seller';
  const sellerAddress = request.seller.physicalAddress || request.seller.location || 'No seller address saved';
  const buyerName = request.buyer.name || 'Buyer';
  const buyerAddress = request.deliveryLeg?.destination.address
    || request.deliveryLeg?.destination.label
    || 'No door delivery — buyer collects.';

  const bannerTone = journey.state === 'attention'
    ? 'border-red-400/40 bg-red-400/10 text-red-200'
    : 'border-amber-400/40 bg-amber-400/10 text-amber-100';

  return (
    <article className={`rounded-2xl border p-4 text-white shadow-[0_18px_45px_rgba(0,0,0,0.45)] ${tone}`}>
      {/* Header — image, order, plain status, deadline. */}
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/45">
          {imageSrc ? (
            <img src={imageSrc} alt={productSummary} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/40">
              <ShoppingBag size={22} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-white/50">Order {request.order.orderNumber}</p>
          <h3 className="truncate text-base font-semibold text-white">{productSummary}</h3>
          <p className="mt-1 text-sm font-semibold text-yellow-300">{journey.label}</p>
        </div>

        <div className="shrink-0 rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-right">
          <p className="text-[11px] text-white/60">{isCompleted ? 'Completed' : 'Deadline'}</p>
          <p className={request.isOverdue && !isCompleted ? 'text-sm font-semibold text-red-300' : 'text-sm font-semibold text-yellow-200'}>
            {isCompleted ? 'Done' : deadlineText(request.deadlineAt, now)}
          </p>
          <p className="text-[11px] text-white/50">{formatDate(isCompleted ? completedAt : request.deadlineAt)}</p>
        </div>
      </div>

      {/* Journey stepper — the two legs shown as one linear story. */}
      <div className="mt-4 rounded-xl border border-white/10 bg-black/35 px-3 py-3">
        <MzigoJourneyStepper journey={journey} />
      </div>

      {/* Delayed / needs-attention overlay. */}
      {journey.state !== 'normal' && !isCompleted && (
        <p className={`mt-3 rounded-lg border px-3 py-2 text-xs font-medium ${bannerTone}`}>
          {journey.detail}
        </p>
      )}

      {/* Primary next action — one clear thing to do. */}
      {actions?.primary && (
        <button
          type="button"
          disabled={Boolean(updatingStatusKey)}
          onClick={() => onStatusUpdate(request.id, actions.primary!.legType, actions.primary!.status)}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-yellow-400 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {updatingStatusKey === `${request.id}:${actions.primary.legType}:${actions.primary.status}` && (
            <Loader2 size={15} className="animate-spin" />
          )}
          {actions.primary.label}
        </button>
      )}

      {/* Issue actions — smaller, secondary. */}
      {actions && actions.secondary.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.secondary.map((action) => (
            <button
              key={action.status}
              type="button"
              disabled={Boolean(updatingStatusKey)}
              onClick={() => onStatusUpdate(request.id, action.legType, action.status)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {updatingStatusKey === `${request.id}:${action.legType}:${action.status}` && (
                <Loader2 size={12} className="animate-spin" />
              )}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Quick contacts + one combined route link. */}
      <div className="mt-3 flex flex-wrap gap-2">
        <CallButton name="seller" phone={request.seller.phone} />
        <CallButton name="buyer" phone={request.buyer.phone} />
        {route && (
          <a
            href={route.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1.5 text-xs font-semibold text-yellow-200 transition hover:bg-yellow-400/20"
          >
            <Navigation size={13} />
            {route.label}
          </a>
        )}
      </div>

      {/* Details — collapsed by default so the queue scans fast. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10"
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {expanded ? 'Hide details' : 'Show details'}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 text-sm">
          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/55">
              <ShoppingBag size={13} />
              What&apos;s in the package
            </p>
            <div className="space-y-1 text-xs text-white/75">
              {request.product.items.map((item) => (
                <p key={item.id}>
                  {item.name} &times;{item.quantity} — {formatCurrency(item.subtotal)}
                </p>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/55">
                <Store size={13} />
                Pick up from
              </p>
              <p className="text-sm font-semibold text-white">{sellerDisplayName}</p>
              <p className="text-xs text-white/65">{sellerAddress}</p>
              <p className="mt-1 text-xs text-white/50">{request.seller.phone || 'No phone saved'}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/55">
                <UserRound size={13} />
                Deliver to
              </p>
              <p className="text-sm font-semibold text-white">{buyerName}</p>
              <p className="text-xs text-white/65">{buyerAddress}</p>
              <p className="mt-1 text-xs text-white/50">{request.buyer.phone || 'No phone saved'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 p-3 text-xs">
            <span className="flex items-center gap-1.5 text-white/55">
              <MapPin size={13} />
              Handover: {request.sellerDropoff.address || request.sellerDropoff.label || 'hub'}
            </span>
            <span className="text-white/70">
              Fees — pickup {statusLabel(request.pickupFeeStatus)}, delivery {statusLabel(request.deliveryFeeStatus)}
            </span>
          </div>

          {request.events[0]?.message && (
            <p className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/70">
              Latest update: {request.events[0].message}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
