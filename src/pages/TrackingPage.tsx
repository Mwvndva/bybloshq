import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, MapPin, Package, ShieldCheck, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchPublicTracking, type PublicTrackingLeg } from '@/api/trackingApi';

function label(value?: string | null) {
  return String(value || 'pending').replace(/_/g, ' ');
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-KE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function safeDecodeToken(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function LegCard({ title, leg }: { title: string; leg?: PublicTrackingLeg | null }) {
  if (!leg) return null;

  const origin = leg.origin?.address || leg.origin?.label;
  const destination = leg.destination?.address || leg.destination?.label;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-yellow-300">{title}</p>
          <h2 className="mt-1 text-xl font-semibold capitalize text-white">{label(leg.status)}</h2>
        </div>
        <Truck className="h-5 w-5 text-yellow-300" />
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {origin && (
          <div className="rounded-xl border border-white/10 bg-black p-3">
            <p className="flex items-center gap-2 text-xs text-white/60">
              <MapPin className="h-3.5 w-3.5 text-yellow-300" />
              From
            </p>
            <p className="mt-1 text-white">{origin}</p>
          </div>
        )}
        {destination && (
          <div className="rounded-xl border border-white/10 bg-black p-3">
            <p className="flex items-center gap-2 text-xs text-white/60">
              <MapPin className="h-3.5 w-3.5 text-yellow-300" />
              To
            </p>
            <p className="mt-1 text-white">{destination}</p>
          </div>
        )}
      </div>

      {leg.safeNote && (
        <p className="mt-3 rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-100">
          {leg.safeNote}
        </p>
      )}
    </section>
  );
}

export default function TrackingPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const decodedToken = useMemo(() => safeDecodeToken(token), [token]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-tracking', decodedToken],
    queryFn: () => fetchPublicTracking(decodedToken),
    enabled: Boolean(decodedToken),
    retry: false,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f8f7f2] text-stone-950">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="rounded-3xl border border-stone-200 bg-white px-6 py-5 text-center shadow-[0_18px_45px_rgba(17,17,17,0.08)]">
            <Clock className="mx-auto h-6 w-6 animate-pulse text-yellow-500" />
            <p className="mt-3 text-sm font-medium text-stone-600">Loading tracking details...</p>
          </div>
        </div>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="min-h-screen bg-[#f8f7f2] text-stone-950">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-[0_18px_45px_rgba(17,17,17,0.08)]">
            <ShieldCheck className="mx-auto h-8 w-8 text-yellow-500" />
            <h1 className="mt-4 text-2xl font-semibold text-stone-950">Tracking link unavailable</h1>
            <p className="mt-2 text-sm text-stone-600">
              This link is invalid, expired, or the delivery has not been activated yet.
            </p>
            <Button onClick={() => navigate('/')} className="mt-5 bg-yellow-400 text-black hover:bg-yellow-300">
              Back to Home
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6 px-0 text-white hover:bg-transparent hover:text-yellow-300"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Home
        </Button>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-yellow-300">Byblos tracking</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Order #{data.orderNumber}</h1>
              <p className="mt-2 text-sm text-white/70">{data.shopName}</p>
            </div>
            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-yellow-200">ETA</p>
              <p className="mt-1 text-sm font-semibold text-white">{formatDateTime(data.eta)}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black p-4">
              <p className="text-[10px] uppercase tracking-wide text-white/50">Current status</p>
              <p className="mt-1 text-lg font-semibold capitalize text-white">{label(data.status)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black p-4">
              <p className="text-[10px] uppercase tracking-wide text-white/50">Viewer</p>
              <p className="mt-1 text-lg font-semibold capitalize text-white">{data.audience}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black p-4">
              <p className="text-[10px] uppercase tracking-wide text-white/50">Protection</p>
              <p className="mt-1 text-lg font-semibold text-white">Escrow safe</p>
            </div>
          </div>

          <p className="mt-5 rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white/75">
            {data.estimate}
          </p>
        </section>

        <div className="mt-5 grid gap-5">
          <LegCard title="Delivery" leg={data.delivery} />
          <LegCard title="Pickup" leg={data.pickup} />
        </div>

        {data.items.length > 0 && (
          <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Package className="h-4 w-4 text-yellow-300" />
              Package
            </div>
            <div className="mt-3 space-y-2">
              {data.items.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex items-center justify-between rounded-xl bg-black px-3 py-2 text-sm">
                  <span className="text-white">{item.name}</span>
                  <span className="text-white/60">Qty {item.quantity}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Clock className="h-4 w-4 text-yellow-300" />
            Timeline
          </div>
          <div className="mt-4 space-y-3">
            {data.timeline.length === 0 ? (
              <p className="rounded-xl bg-black px-3 py-2 text-sm text-white/65">No tracking updates yet.</p>
            ) : (
              data.timeline.map((event, index) => (
                <div key={`${event.createdAt}-${index}`} className="flex gap-3 rounded-xl bg-black p-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-300" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold capitalize text-white">{label(event.status || event.type)}</p>
                    {event.message && <p className="mt-1 text-sm text-white/70">{event.message}</p>}
                    <p className="mt-1 text-xs text-white/45">{formatDateTime(event.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
