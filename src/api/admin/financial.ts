import { api } from './instance';

export async function getFinancialMetrics() {
  try {
    console.log('Fetching financial metrics from API...');
    const response = await api.get('/admin/metrics/financial');
    console.log('Financial metrics API response:', response);
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
    console.error('Error fetching financial metrics:', error);
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
    console.log('Fetching monthly financial data from API...');
    const response = await api.get('/admin/metrics/financial/monthly');
    console.log('Monthly financial data API response:', response);
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching monthly financial data:', error);
    return [];
  }
}

export async function getPaymentProviderBalances() {
  try {
    const response = await api.get('/admin/payment-provider/balances');
    return response.data.data || null;
  } catch (error) {
    console.error('Error fetching payment provider balance/status:', error);
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


