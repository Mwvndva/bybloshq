export const formatKes = (amount: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
};

export const formatSettlementTime = (value: string) => {
  return new Intl.DateTimeFormat('en-KE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
};
