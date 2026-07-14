import type { LogisticsSort, LogisticsStatusUpdate } from '@/api/logistics';

export const ACTIVE_GROUPS = [
  {
    key: 'pickupDelivery',
    title: 'Pickup + Delivery',
    description: 'Seller pickup and buyer delivery are both active for the same package.',
    tone: 'border-yellow-400/25 bg-yellow-400/[0.08]',
    pill: 'bg-yellow-400 text-black',
  },
  {
    key: 'deliveryOnly',
    title: 'Delivery Only',
    description: 'Buyer paid for door delivery. Seller is expected to drop off the package.',
    tone: 'border-sky-400/25 bg-sky-400/[0.06]',
    pill: 'bg-white/10 text-white',
  },
  {
    key: 'pickupOnly',
    title: 'Pickup Only',
    description: 'Seller paid for pickup. Buyer will collect separately or no door delivery exists.',
    tone: 'border-violet-400/25 bg-violet-400/[0.06]',
    pill: 'bg-white/10 text-white',
  },
  {
    key: 'hubDropoff',
    title: 'Hub Drop-off / Hub Collection',
    description: 'Seller is dropping off at the hub without a paid Mzigo pickup leg.',
    tone: 'border-white/10 bg-white/[0.03]',
    pill: 'bg-white/10 text-white',
  },
] as const;

export const COMPLETED_GROUP = {
  key: 'completed',
  title: 'Completed Deliveries',
  description: 'Orders and logistics requests already completed. Cards are kept here for delivery history.',
  tone: 'border-emerald-400/20 bg-white/[0.02]',
  pill: 'bg-white/10 text-white',
} as const;

export const SORT_OPTIONS: Array<{ value: LogisticsSort; label: string }> = [
  { value: 'priority', label: 'Priority' },
  { value: 'deadline', label: 'Deadline Soon' },
  { value: 'oldest_paid', label: 'Oldest Paid' },
  { value: 'newest_paid', label: 'Newest Paid' },
];

export const PICKUP_ACTIONS: Record<string, Array<{ status: LogisticsStatusUpdate; label: string }>> = {
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

export const DELIVERY_ACTIONS: Record<string, Array<{ status: LogisticsStatusUpdate; label: string }>> = {
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
