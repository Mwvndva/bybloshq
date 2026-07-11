import type { AdminLogisticsStatusFilter } from '@/api/admin';
import type { LogisticsSort, LogisticsStatusUpdate } from '@/api/logistics';

export export const STATUS_FILTERS: Array<{ value: AdminLogisticsStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'failed', label: 'Failed' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'manual_review', label: 'Review' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Done' },
];

export const SORT_OPTIONS: Array<{ value: LogisticsSort; label: string }> = [
  { value: 'priority', label: 'Priority' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'oldest_paid', label: 'Oldest' },
  { value: 'newest_paid', label: 'Newest' },
];

export const PICKUP_STATUSES: LogisticsStatusUpdate[] = [
  'pickup_pending',
  'pickup_assigned',
  'pickup_started',
  'picked_up_from_seller',
  'dropped_at_hub',
  'pickup_failed',
];

export const DELIVERY_STATUSES: LogisticsStatusUpdate[] = [
  'delivery_pending',
  'courier_assigned',
  'out_for_delivery',
  'delivered',
  'delivery_delayed',
  'delivery_failed',
];

export function label(value?: string | null) {
  return String(value || 'not set').replace(/_/g, ' ');
}

export function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-KE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatCurrency(value: number | string | null | undefined, currency = 'KES') {
  const amount = Number(value || 0);
  const prefix = currency === 'KES' ? 'KSh' : currency;
  return `${prefix} ${amount.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

export function normalizePhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) return `254${digits.slice(1)}`;
  if (digits.startsWith('254')) return digits;
  return digits;
}

