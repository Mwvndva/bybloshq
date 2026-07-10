import apiClient from '@/lib/apiClient';

export const requestWithdrawal = async (amount: number | string) => {
  const idempotencyKey = `creator-withdrawal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await apiClient.post(
    '/creators/withdrawals',
    { amount, idempotencyKey },
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
  return response.data?.data?.withdrawal;
};


