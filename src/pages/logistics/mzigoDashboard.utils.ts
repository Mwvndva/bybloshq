import { DELIVERY_ACTIONS, PICKUP_ACTIONS } from './mzigoDashboard.constants';
import type { LogisticsLeg, LogisticsLegType } from '@/api/logistics';

export function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `KSh ${amount.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
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

export function deadlineText(value?: string | null, now = Date.now()) {
  if (!value) return 'No deadline';
  const deadline = new Date(value).getTime();
  const diff = deadline - now;
  const absoluteHours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
  const minutes = Math.floor((Math.abs(diff) % (1000 * 60 * 60)) / (1000 * 60));
  const label = absoluteHours > 0 ? `${absoluteHours}h ${minutes}m` : `${minutes}m`;
  return diff < 0 ? `Overdue by ${label}` : `${label} left`;
}

export function statusLabel(status?: string | null) {
  return String(status || 'not requested').replace(/_/g, ' ');
}

export function nextActions(legType: LogisticsLegType, leg?: LogisticsLeg | null) {
  if (!leg?.status) return [];
  const status = String(leg.status).toLowerCase();
  return legType === 'pickup' ? PICKUP_ACTIONS[status] || [] : DELIVERY_ACTIONS[status] || [];
}
