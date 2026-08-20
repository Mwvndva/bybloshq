import { api } from './instance';

export async function getFinancialMetrics() {
  try {
    const response = await api.get('/admin/metrics/financial');
    return response.data.data || {
      totalSales: 0,
      totalOrders: 0,
      totalCommission: 0,
      totalRefunds: 0,
      totalRefundRequests: 0,
      pendingRefunds: 0,
      netRevenue: 0
    };
  } catch (error) {
    return {
      totalSales: 0,
      totalOrders: 0,
      totalCommission: 0,
      totalRefunds: 0,
      totalRefundRequests: 0,
      pendingRefunds: 0,
      netRevenue: 0
    };
  }
}

export async function getMonthlyFinancialData() {
  try {
    const response = await api.get('/admin/metrics/financial/monthly');
    return response.data.data || [];
  } catch (error) {
    return [];
  }
}

export async function getPaymentProviderBalances() {
  try {
    const response = await api.get('/admin/payment-provider/balances');
    return response.data.data || null;
  } catch (error) {
    return {
      payin: { error: 'Unavailable' },
      payout: { error: 'Unavailable' },
      timestamp: new Date().toISOString()
    };
  }
}

export async function getRefundRequests(status: string) {
  const response = await api.get(`/admin/refunds?status=${status}`);
  return response.data;
}

export async function confirmRefund(id: number | string, data: { adminNotes: string }, headers: Record<string, string>) {
  const response = await api.patch(`/admin/refunds/${id}/confirm`, data, { headers });
  return response.data;
}

export async function rejectRefund(id: number | string, data: { adminNotes: string }, headers: Record<string, string>) {
  const response = await api.patch(`/admin/refunds/${id}/reject`, data, { headers });
  return response.data;
}


