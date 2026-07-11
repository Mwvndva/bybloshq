import type { ReactNode } from 'react';
import { ExternalLink, Loader2, Mail, MapPin, PackageCheck, Phone, ShoppingBag, Store, UserRound } from 'lucide-react';
import { LogisticsLeg, LogisticsLegType, LogisticsRequestCard, LogisticsStatusUpdate } from '@/api/logistics';
import { deadlineText, formatCurrency, formatDate, nextActions, statusLabel } from './mzigoDashboard.utils';

function mapAnchor(label: string, href?: string | null) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600 underline-offset-4 hover:underline"
    >
      {label}
      <ExternalLink size={12} />
    </a>
  );
}

function DetailField({
  label,
  value,
  icon,
  children,
}: {
  label: string;
  value?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-stone-500">
        {icon}
        {label}
      </p>
      <div className="text-sm text-stone-950">{value || children || 'Not provided'}</div>
    </div>
  );
}

export function DashboardStat({
  label,
  value,
  icon,
  tone = 'border-stone-200 bg-white',
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="mb-3 flex items-center justify-between gap-3 text-stone-500">
        <span className="text-xs font-semibold">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function LegPanel({
  title,
  leg,
  legType,
  requestId,
  onStatusUpdate,
  updatingStatusKey,
  readOnly = false,
}: {
  title: string;
  leg?: LogisticsLeg | null;
  legType: LogisticsLegType;
  requestId: number;
  onStatusUpdate: (requestId: number, legType: LogisticsLegType, status: LogisticsStatusUpdate) => void;
  updatingStatusKey?: string | null;
  readOnly?: boolean;
}) {
  if (!leg) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs uppercase tracking-wide text-white/60">{title}</p>
        <p className="mt-1 text-sm text-white">Not requested</p>
      </div>
    );
  }

  const actions = readOnly ? [] : nextActions(legType, leg);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-white/60">{title}</p>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase text-black">
          {statusLabel(leg.status)}
        </span>
      </div>

      <div className="space-y-3 text-sm text-white">
        <div>
          <p className="text-xs text-white/60">From</p>
          <p>{leg.origin.address || leg.origin.label || 'Not provided'}</p>
          {mapAnchor('Open origin map', leg.origin.mapLink)}
        </div>
        <div>
          <p className="text-xs text-white/60">To</p>
          <p>{leg.destination.address || leg.destination.label || 'Not provided'}</p>
          {mapAnchor('Open destination map', leg.destination.mapLink)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-white/60">Fee</p>
            <p>{formatCurrency(leg.feeAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-white/60">Payment</p>
            <p className="capitalize">{statusLabel(leg.feeStatus)}</p>
          </div>
        </div>
      </div>

      {readOnly ? (
        <p className="mt-4 rounded-lg bg-black/35 px-3 py-2 text-xs text-white/60">
          Completed delivery history. Status changes are closed.
        </p>
      ) : actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => {
            const statusKey = `${requestId}:${legType}:${action.status}`;
            const isUpdating = updatingStatusKey === statusKey;
            return (
              <button
                key={action.status}
                type="button"
                disabled={Boolean(updatingStatusKey)}
                onClick={() => onStatusUpdate(requestId, legType, action.status)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-yellow-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isUpdating && <Loader2 size={13} className="animate-spin" />}
                {action.label}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-black/35 px-3 py-2 text-xs text-white/60">
          No further status update is available for this leg.
        </p>
      )}
    </div>
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
  const primaryProduct = request.product.items[0];
  const productSummary = request.product.summary || primaryProduct?.name || 'Package';
  const isCompleted = readOnly || request.isCompleted || request.status === 'completed';
  const completedAt = request.completedAt || request.order.completedAt || null;
  const sellerDisplayName = request.seller.shopName || request.seller.name || 'Seller not available';
  const sellerAddress = request.seller.physicalAddress || request.seller.location || 'No seller address saved';
  const buyerDeliveryAddress = request.deliveryLeg?.destination.address
    || request.deliveryLeg?.destination.label
    || null;
  const buyerMapLink = request.deliveryLeg?.destination.mapLink || null;

  return (
    <article className={`rounded-2xl border p-4 text-stone-950 shadow-[0_18px_45px_rgba(17,17,17,0.08)] ${tone}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">Order</p>
          <h3 className="text-lg font-semibold text-white">{request.order.orderNumber}</h3>
          <p className="text-sm text-white/75">{request.packageCode || `Package #${request.id}`}</p>
          <span className="mt-2 inline-flex rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[11px] font-semibold uppercase text-white/75">
            {isCompleted ? 'completed' : statusLabel(request.status)}
          </span>
        </div>
        <div className="rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-right">
          <p className="text-xs text-white/60">{isCompleted ? 'Completed' : 'Deadline'}</p>
          <p className={request.isOverdue ? 'text-sm font-semibold text-red-300' : 'text-sm font-semibold text-yellow-200'}>
            {isCompleted ? 'Done' : deadlineText(request.deadlineAt, now)}
          </p>
          <p className="text-[11px] text-white/60">{formatDate(isCompleted ? completedAt : request.deadlineAt)}</p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 xl:grid-cols-[1.1fr_1fr_1fr]">
        <div className="rounded-xl border border-white/10 bg-black/45 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
            <ShoppingBag size={15} />
            Product details
          </div>
          <p className="text-sm text-white">{productSummary}</p>
          <div className="mt-2 space-y-1 text-xs text-white/70">
            {request.product.items.map((item) => (
              <p key={item.id}>
                {item.name} x{item.quantity} - {formatCurrency(item.subtotal)}
              </p>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/45 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
            <Store size={15} />
            Seller details
          </div>
          <div className="space-y-2">
            <DetailField label="Shop" value={sellerDisplayName} icon={<Store size={12} />} />
            <DetailField label="Phone" value={request.seller.phone || 'No seller phone'} icon={<Phone size={12} />} />
            <DetailField label="Address" icon={<MapPin size={12} />}>
              <p>{sellerAddress}</p>
              {request.seller.mapLink ? (
                <div className="mt-1">{mapAnchor('Open seller map', request.seller.mapLink)}</div>
              ) : (
                <p className="mt-1 text-xs text-white/50">No seller map pin saved.</p>
              )}
            </DetailField>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/45 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
            <UserRound size={15} />
            Buyer details
          </div>
          <div className="space-y-2">
            <DetailField label="Buyer" value={request.buyer.name || 'Buyer not available'} icon={<UserRound size={12} />} />
            <DetailField label="Phone" value={request.buyer.phone || 'No buyer phone'} icon={<Phone size={12} />} />
            {request.buyer.email && (
              <DetailField label="Email" value={request.buyer.email} icon={<Mail size={12} />} />
            )}
            <DetailField label="Delivery" icon={<MapPin size={12} />}>
              <p>{buyerDeliveryAddress || 'No door delivery. Buyer follows hub or shop collection flow.'}</p>
              {buyerMapLink && <div className="mt-1">{mapAnchor('Open buyer map', buyerMapLink)}</div>}
            </DetailField>
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <LegPanel
          title="Pickup"
          leg={request.pickupLeg}
          legType="pickup"
          requestId={request.id}
          onStatusUpdate={onStatusUpdate}
          updatingStatusKey={updatingStatusKey}
          readOnly={isCompleted}
        />
        <LegPanel
          title="Delivery"
          leg={request.deliveryLeg}
          legType="delivery"
          requestId={request.id}
          onStatusUpdate={onStatusUpdate}
          updatingStatusKey={updatingStatusKey}
          readOnly={isCompleted}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/45 p-3">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
            <MapPin size={15} />
            Seller handoff / hub
          </p>
          <p className="text-sm text-white">{request.sellerDropoff.address || request.sellerDropoff.label || 'Not set'}</p>
          {mapAnchor('Open drop-off map', request.sellerDropoff.mapLink)}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/45 p-3">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
            <PackageCheck size={15} />
            Card classification
          </p>
          <p className="text-sm capitalize text-white">{request.group.replace(/_/g, ' ')}</p>
          <p className="mt-1 text-xs text-white/70">
            Pickup fee: {statusLabel(request.pickupFeeStatus)} | Delivery fee: {statusLabel(request.deliveryFeeStatus)}
          </p>
        </div>
      </div>

      {request.events[0]?.message && (
        <p className="mt-4 rounded-xl border border-white/10 bg-black/45 p-3 text-xs text-white/75">
          Latest update: {request.events[0].message}
        </p>
      )}
    </article>
  );
}
