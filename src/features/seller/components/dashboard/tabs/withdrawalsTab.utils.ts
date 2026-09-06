export const formatKes = (amount?: number | null) => {
  const safe = Number(amount);
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(Number.isFinite(safe) ? safe : 0);
};

const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  manual_review: 'Under Review',
  rejected: 'Rejected',
};

/**
 * Maps a raw withdrawal status to a buyer/seller-friendly label. Unknown
 * statuses are Title-Cased (underscores -> spaces) rather than shown raw so no
 * backend enum term (e.g. "manual_review") leaks into the UI.
 */
export const getWithdrawalStatusLabel = (status?: string | null): string => {
  const key = (status || '').toLowerCase();
  if (WITHDRAWAL_STATUS_LABELS[key]) return WITHDRAWAL_STATUS_LABELS[key];
  if (!key) return 'Pending';
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const formatSettlementDate = (value?: string | null) => {
  if (!value) return 'Pending schedule';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending schedule';
  return new Intl.DateTimeFormat('en-KE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

export const formatSettlementTimeOnly = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-KE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
};

export const formatSettlementTime = (value?: string | null) => {
  if (!value) return 'Pending schedule';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending schedule';
  return new Intl.DateTimeFormat('en-KE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
};
