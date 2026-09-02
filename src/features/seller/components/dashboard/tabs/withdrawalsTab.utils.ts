export const formatKes = (amount?: number | null) => {
  const safe = Number(amount);
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(Number.isFinite(safe) ? safe : 0);
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
    minute: '2-digit'
  }).format(date);
};
