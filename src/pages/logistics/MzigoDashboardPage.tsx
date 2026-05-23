import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  ShoppingBag,
  Store,
  Truck,
  UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  clearLogisticsSession,
  fetchLogisticsMe,
  fetchLogisticsRequests,
  getLogisticsToken,
  getStoredLogisticsPartner,
  LogisticsLeg,
  LogisticsLegType,
  LogisticsRequestCard,
  LogisticsSort,
  LogisticsStatusUpdate,
  updateLogisticsLegStatus,
} from '@/api/logisticsApi';
import { toast } from 'sonner';

const ACTIVE_GROUPS = [
  {
    key: 'pickupDelivery',
    title: 'Pickup + Delivery',
    description: 'Seller pickup and buyer delivery are both active for the same package.',
    tone: 'border-yellow-200 bg-yellow-50',
    pill: 'bg-yellow-400 text-black',
  },
  {
    key: 'deliveryOnly',
    title: 'Delivery Only',
    description: 'Buyer paid for door delivery. Seller is expected to drop off the package.',
    tone: 'border-stone-200 bg-white',
    pill: 'bg-stone-950 text-[#ffffff]',
  },
  {
    key: 'pickupOnly',
    title: 'Pickup Only',
    description: 'Seller paid for pickup. Buyer will collect separately or no door delivery exists.',
    tone: 'border-stone-200 bg-white',
    pill: 'bg-stone-200 text-stone-950',
  },
  {
    key: 'hubDropoff',
    title: 'Hub Drop-off / Hub Collection',
    description: 'Seller is dropping off at the hub without a paid Mzigo pickup leg.',
    tone: 'border-stone-200 bg-white',
    pill: 'bg-stone-200 text-stone-950',
  },
] as const;

const COMPLETED_GROUP = {
  key: 'completed',
  title: 'Completed Deliveries',
  description: 'Orders and logistics requests already completed. Cards are kept here for delivery history.',
  tone: 'border-stone-200 bg-white',
  pill: 'bg-stone-200 text-stone-950',
} as const;

const SORT_OPTIONS: Array<{ value: LogisticsSort; label: string }> = [
  { value: 'priority', label: 'Priority' },
  { value: 'deadline', label: 'Deadline Soon' },
  { value: 'oldest_paid', label: 'Oldest Paid' },
  { value: 'newest_paid', label: 'Newest Paid' },
];

const PICKUP_ACTIONS: Record<string, Array<{ status: LogisticsStatusUpdate; label: string }>> = {
  payment_pending: [
    { status: 'pickup_pending', label: 'Mark pickup pending' },
  ],
  pending: [
    { status: 'pickup_assigned', label: 'Assign pickup' },
    { status: 'pickup_failed', label: 'Mark failed' },
  ],
  assigned: [
    { status: 'pickup_started', label: 'Start pickup' },
    { status: 'pickup_failed', label: 'Mark failed' },
  ],
  started: [
    { status: 'picked_up_from_seller', label: 'Picked up' },
    { status: 'pickup_failed', label: 'Mark failed' },
  ],
  picked_up: [
    { status: 'dropped_at_hub', label: 'Dropped at hub' },
    { status: 'pickup_failed', label: 'Mark failed' },
  ],
};

const DELIVERY_ACTIONS: Record<string, Array<{ status: LogisticsStatusUpdate; label: string }>> = {
  payment_pending: [
    { status: 'delivery_pending', label: 'Mark delivery pending' },
  ],
  delivery_pending: [
    { status: 'courier_assigned', label: 'Assign courier' },
    { status: 'delivery_delayed', label: 'Mark delayed' },
    { status: 'delivery_failed', label: 'Mark failed' },
  ],
  assigned: [
    { status: 'out_for_delivery', label: 'Out for delivery' },
    { status: 'delivery_delayed', label: 'Mark delayed' },
    { status: 'delivery_failed', label: 'Mark failed' },
  ],
  out_for_delivery: [
    { status: 'delivered', label: 'Delivered' },
    { status: 'delivery_delayed', label: 'Mark delayed' },
    { status: 'delivery_failed', label: 'Mark failed' },
  ],
  delayed: [
    { status: 'courier_assigned', label: 'Assign courier' },
    { status: 'out_for_delivery', label: 'Out for delivery' },
    { status: 'delivered', label: 'Delivered' },
    { status: 'delivery_failed', label: 'Mark failed' },
  ],
};

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `KSh ${amount.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-KE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function deadlineText(value?: string | null, now = Date.now()) {
  if (!value) return 'No deadline';
  const deadline = new Date(value).getTime();
  const diff = deadline - now;
  const absoluteHours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
  const minutes = Math.floor((Math.abs(diff) % (1000 * 60 * 60)) / (1000 * 60));
  const label = absoluteHours > 0 ? `${absoluteHours}h ${minutes}m` : `${minutes}m`;
  return diff < 0 ? `Overdue by ${label}` : `${label} left`;
}

function statusLabel(status?: string | null) {
  return String(status || 'not requested').replace(/_/g, ' ');
}

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

function DashboardStat({
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

function nextActions(legType: LogisticsLegType, leg?: LogisticsLeg | null) {
  if (!leg?.status) return [];
  const status = String(leg.status).toLowerCase();
  return legType === 'pickup' ? PICKUP_ACTIONS[status] || [] : DELIVERY_ACTIONS[status] || [];
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

function RequestCard({
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

const MzigoDashboardPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<LogisticsSort>('priority');
  const [now, setNow] = useState(Date.now());
  const [updatingStatusKey, setUpdatingStatusKey] = useState<string | null>(null);

  useEffect(() => {
    if (!getLogisticsToken()) {
      navigate('/mzigo/login', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const partnerQuery = useQuery({
    queryKey: ['logistics', 'me'],
    queryFn: fetchLogisticsMe,
    enabled: Boolean(getLogisticsToken()),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const requestsQuery = useQuery({
    queryKey: ['logistics', 'requests', sort],
    queryFn: () => fetchLogisticsRequests(sort),
    enabled: Boolean(getLogisticsToken()),
    refetchInterval: 60_000,
    staleTime: 20_000,
    retry: 1,
  });

  const statusMutation = useMutation({
    mutationFn: updateLogisticsLegStatus,
    onSuccess: (result) => {
      toast.success(result.updated ? 'Status updated' : 'Status already up to date');
      queryClient.invalidateQueries({ queryKey: ['logistics', 'requests'] });
    },
    onError: (error: any) => {
      toast.error('Status update failed', {
        description: error?.response?.data?.message || error?.message || 'Mzigo status was not updated.',
      });
    },
    onSettled: () => {
      setUpdatingStatusKey(null);
    },
  });

  useEffect(() => {
    if (partnerQuery.isError || requestsQuery.isError) {
      const status = (partnerQuery.error as any)?.response?.status || (requestsQuery.error as any)?.response?.status;
      if (status === 401 || status === 403) {
        clearLogisticsSession();
        navigate('/mzigo/login', { replace: true });
      }
    }
  }, [navigate, partnerQuery.error, partnerQuery.isError, requestsQuery.error, requestsQuery.isError]);

  const partner = partnerQuery.data || getStoredLogisticsPartner();
  const dashboard = requestsQuery.data;

  const grouped = useMemo(() => ({
    pickupDelivery: dashboard?.groups?.pickupDelivery || [],
    deliveryOnly: dashboard?.groups?.deliveryOnly || [],
    pickupOnly: dashboard?.groups?.pickupOnly || [],
    hubDropoff: dashboard?.groups?.hubDropoff || [],
    completed: dashboard?.groups?.completed || [],
  }), [dashboard]);

  const activeCount = grouped.pickupDelivery.length
    + grouped.deliveryOnly.length
    + grouped.pickupOnly.length
    + grouped.hubDropoff.length;
  const overdueCount = [
    ...grouped.pickupDelivery,
    ...grouped.deliveryOnly,
    ...grouped.pickupOnly,
    ...grouped.hubDropoff,
  ].filter((request) => request.isOverdue).length;

  const handleLogout = () => {
    clearLogisticsSession();
    navigate('/mzigo/login', { replace: true });
  };

  const handleStatusUpdate = (
    requestId: number,
    legType: LogisticsLegType,
    status: LogisticsStatusUpdate
  ) => {
    setUpdatingStatusKey(`${requestId}:${legType}:${status}`);
    statusMutation.mutate({ requestId, legType, status });
  };

  return (
    <main className="mzigo-light-dashboard min-h-[100svh] overflow-x-hidden bg-[#f8f7f2] text-stone-950">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-yellow-300 hover:bg-yellow-50 hover:text-black"
          >
            <ArrowLeft size={16} />
            Home
          </button>

          <div className="order-first text-center sm:order-none">
            <p className="text-xs font-semibold text-yellow-600">Mzigo Ego</p>
            <h1 className="text-xl font-semibold text-stone-950">Delivery Orders</h1>
            <p className="text-xs text-stone-500">{partner?.name || 'Logistics partner'} workspace</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      <section className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <Truck size={16} />
              {activeCount} active logistics orders
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Completed orders are separated from active work so dispatch can focus on open movement.
            </p>
          </div>

          <div className="w-full overflow-x-auto pb-1 sm:w-auto">
            <div className="flex min-w-max items-center gap-2">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSort(option.value)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${
                    sort === option.value
                      ? 'bg-yellow-300 text-black'
                      : 'border border-stone-200 bg-white text-stone-700 hover:bg-yellow-50 hover:text-black'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => requestsQuery.refetch()}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-yellow-50 hover:text-black"
              >
                <RefreshCw size={15} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStat
            label="Active"
            value={activeCount}
            icon={<Truck size={18} />}
            tone="border-yellow-300/25 bg-yellow-300/10"
          />
          <DashboardStat
            label="Overdue"
            value={overdueCount}
            icon={<CalendarClock size={18} />}
            tone={overdueCount > 0 ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-white'}
          />
          <DashboardStat
            label="Completed"
            value={grouped.completed.length}
            icon={<CheckCircle2 size={18} />}
            tone="border-emerald-300/25 bg-emerald-300/10"
          />
          <DashboardStat
            label="Total Visible"
            value={dashboard?.count || 0}
            icon={<PackageCheck size={18} />}
          />
        </div>

        {requestsQuery.isLoading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-64 animate-pulse rounded-2xl border border-stone-200 bg-white" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {ACTIVE_GROUPS.map((group) => {
              const cards = grouped[group.key];
              return (
                <section key={group.key}>
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-stone-950">{group.title}</h2>
                      <p className="text-sm text-stone-500">{group.description}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${group.pill}`}>
                      {cards.length} orders
                    </span>
                  </div>

                  {cards.length === 0 ? (
                    <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
                      No {group.title.toLowerCase()} orders right now.
                    </div>
                  ) : (
                    <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                      {cards.map((request) => (
                        <RequestCard
                          key={request.id}
                          request={request}
                          tone={group.tone}
                          now={now}
                          onStatusUpdate={handleStatusUpdate}
                          updatingStatusKey={updatingStatusKey}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-stone-950">{COMPLETED_GROUP.title}</h2>
                  <p className="text-sm text-stone-500">{COMPLETED_GROUP.description}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${COMPLETED_GROUP.pill}`}>
                  {grouped.completed.length} orders
                </span>
              </div>

              {grouped.completed.length === 0 ? (
                <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
                  No completed deliveries yet.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {grouped.completed.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      tone={COMPLETED_GROUP.tone}
                      now={now}
                      onStatusUpdate={handleStatusUpdate}
                      updatingStatusKey={updatingStatusKey}
                      readOnly
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>

      <footer className="border-t border-stone-200 px-4 py-4 text-center text-xs text-stone-500">
        <CalendarClock size={14} className="mr-1 inline-block" />
        Deliveries are organized against the 24 hour logistics window.
      </footer>
    </main>
  );
};

export default MzigoDashboardPage;
