import { ExternalLink, History, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LogisticsLeg, LogisticsLegType, LogisticsRequestCard, LogisticsStatusUpdate } from '@/api/logistics';
import { PICKUP_STATUSES, DELIVERY_STATUSES, label, formatDate, formatCurrency, normalizePhone } from './adminLogisticsTab.utils';

export function ContactLinks({ phone, email, label: contactLabel }: { phone?: string | null; email?: string | null; label: string }) {
  const normalized = normalizePhone(phone);
  return (
    <div className="flex flex-wrap gap-2">
      {normalized && (
        <>
          <a className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white hover:text-black" href={`tel:+${normalized}`}>
            <Phone size={12} />
            {contactLabel}
          </a>
          <a className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-green-400 hover:text-black" href={`https://wa.me/${normalized}`} target="_blank" rel="noreferrer">
            <ExternalLink size={12} />
            WhatsApp
          </a>
        </>
      )}
      {email && (
        <a className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-yellow-300 hover:text-black" href={`mailto:${email}`}>
          <Mail size={12} />
          Email
        </a>
      )}
    </div>
  );
}

export function LegAdminPanel({
  request,
  leg,
  legType,
  draftStatus,
  onDraftStatus,
  onOverride,
  isUpdating,
}: {
  request: LogisticsRequestCard;
  leg?: LogisticsLeg | null;
  legType: LogisticsLegType;
  draftStatus?: LogisticsStatusUpdate;
  onDraftStatus: (key: string, status: LogisticsStatusUpdate) => void;
  onOverride: (requestId: number, legType: LogisticsLegType, status: LogisticsStatusUpdate) => void;
  isUpdating: boolean;
}) {
  if (!leg) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black p-4">
        <p className="text-xs uppercase tracking-widest text-white/50">{legType}</p>
        <p className="mt-2 text-sm text-white">Not requested</p>
      </div>
    );
  }

  const key = `${request.id}:${legType}`;
  const options = legType === 'pickup' ? PICKUP_STATUSES : DELIVERY_STATUSES;
  const selected = draftStatus || options.find(option => option.endsWith(String(leg.status))) || options[0];

  return (
    <div className="rounded-2xl border border-white/10 bg-black p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/50">{legType}</p>
          <p className="mt-1 text-lg font-semibold capitalize text-white">{label(leg.status)}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase text-black">
          {formatCurrency(leg.feeAmount, leg.feeCurrency)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-white/80 md:grid-cols-2">
        <div>
          <p className="text-xs text-white/45">From</p>
          <p>{leg.origin.address || leg.origin.label || 'Not provided'}</p>
          {leg.origin.mapLink && <a className="text-xs text-yellow-200 underline" href={leg.origin.mapLink} target="_blank" rel="noreferrer">Open map</a>}
        </div>
        <div>
          <p className="text-xs text-white/45">To</p>
          <p>{leg.destination.address || leg.destination.label || 'Not provided'}</p>
          {leg.destination.mapLink && <a className="text-xs text-yellow-200 underline" href={leg.destination.mapLink} target="_blank" rel="noreferrer">Open map</a>}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <select
          className="min-h-10 flex-1 rounded-xl border border-white/10 bg-[#050505] px-3 text-sm capitalize text-white"
          value={selected}
          onChange={(event) => onDraftStatus(key, event.target.value as LogisticsStatusUpdate)}
        >
          {options.map(option => (
            <option key={option} value={option}>{label(option)}</option>
          ))}
        </select>
        <Button
          type="button"
          disabled={isUpdating}
          onClick={() => onOverride(request.id, legType, selected)}
          className="bg-yellow-300 text-black hover:bg-yellow-200"
        >
          Override
        </Button>
      </div>
    </div>
  );
}

export function LogisticsAdminCard({
  request,
  draftStatuses,
  onDraftStatus,
  onOverride,
  onResolveDispute,
  updatingKey,
}: {
  request: LogisticsRequestCard;
  draftStatuses: Record<string, LogisticsStatusUpdate>;
  onDraftStatus: (key: string, status: LogisticsStatusUpdate) => void;
  onOverride: (requestId: number, legType: LogisticsLegType, status: LogisticsStatusUpdate) => void;
  onResolveDispute: (requestId: number, resolution: 'manual_review' | 'continue_delivery' | 'mark_failed' | 'resolved') => void;
  updatingKey: string | null;
}) {
  const isProblem = request.status === 'failed'
    || request.status === 'manual_review'
    || request.pickupLeg?.status === 'failed'
    || request.deliveryLeg?.status === 'failed'
    || request.deliveryLeg?.status === 'delayed';

  return (
    <article className={`rounded-3xl border p-5 ${isProblem ? 'border-red-300/50 bg-red-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-yellow-200">Order {request.order.orderNumber}</p>
          <h3 className="mt-1 text-xl font-semibold text-white">{request.product.summary || 'Logistics package'}</h3>
          <p className="mt-1 text-sm text-white/60">
            {request.seller.shopName || request.seller.name || 'Shop'} - {request.partner?.name || 'Mzigo Ego'}
          </p>
        </div>
        <div className="grid gap-2 text-right text-sm text-white/70">
          <span className="rounded-full bg-white px-3 py-1 text-center text-xs font-semibold uppercase text-black">{label(request.status)}</span>
          <span>{formatDate(request.deadlineAt)}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <LegAdminPanel
          request={request}
          leg={request.pickupLeg}
          legType="pickup"
          draftStatus={draftStatuses[`${request.id}:pickup`]}
          onDraftStatus={onDraftStatus}
          onOverride={onOverride}
          isUpdating={updatingKey === `${request.id}:pickup`}
        />
        <LegAdminPanel
          request={request}
          leg={request.deliveryLeg}
          legType="delivery"
          draftStatus={draftStatuses[`${request.id}:delivery`]}
          onDraftStatus={onDraftStatus}
          onOverride={onOverride}
          isUpdating={updatingKey === `${request.id}:delivery`}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black p-4">
          <p className="mb-2 text-xs uppercase tracking-widest text-white/50">Buyer</p>
          <p className="text-sm font-semibold text-white">{request.buyer.name || 'Buyer'}</p>
          <ContactLinks phone={request.buyer.phone} email={request.buyer.email} label="Call buyer" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-black p-4">
          <p className="mb-2 text-xs uppercase tracking-widest text-white/50">Seller</p>
          <p className="text-sm font-semibold text-white">{request.seller.shopName || request.seller.name || 'Seller'}</p>
          <ContactLinks phone={request.seller.phone} label="Call seller" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-black p-4">
          <p className="mb-2 text-xs uppercase tracking-widest text-white/50">Mzigo</p>
          <p className="text-sm font-semibold text-white">{request.partner?.name || 'Mzigo Ego'}</p>
          <ContactLinks phone={request.partner?.whatsappNumber || request.partner?.phone} label="Call Mzigo" />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="border-yellow-300/40 bg-black text-yellow-200 hover:bg-yellow-300 hover:text-black" onClick={() => onResolveDispute(request.id, 'manual_review')}>
          Flag review
        </Button>
        <Button type="button" variant="outline" className="border-white/10 bg-black text-white hover:bg-white hover:text-black" onClick={() => onResolveDispute(request.id, 'continue_delivery')}>
          Continue delivery
        </Button>
        <Button type="button" variant="outline" className="border-red-300/40 bg-black text-red-200 hover:bg-red-400 hover:text-black" onClick={() => onResolveDispute(request.id, 'mark_failed')}>
          Mark failed
        </Button>
        <Button type="button" variant="outline" className="border-green-300/40 bg-black text-green-200 hover:bg-green-300 hover:text-black" onClick={() => onResolveDispute(request.id, 'resolved')}>
          Resolve dispute
        </Button>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <History size={15} />
          Tracking history
        </div>
        <div className="space-y-3">
          {request.events.length === 0 ? (
            <p className="text-sm text-white/55">No tracking events yet.</p>
          ) : (
            request.events.map((event) => (
              <div key={event.id} className="border-l border-yellow-300/40 pl-3">
                <p className="text-sm font-semibold capitalize text-white">{label(event.status || event.type)}</p>
                {event.message && <p className="text-sm text-white/70">{event.message}</p>}
                <p className="text-xs text-white/45">{formatDate(event.createdAt)} - {event.source || 'system'}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </article>
  );
}

