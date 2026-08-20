import { api } from './instance';

export async function getAnalytics() {
  try {
    const { data } = await api.get('/admin/analytics');
    return {
      ...data.data,
      userGrowth: data.data?.userGrowth || [],
      revenueTrends: data.data?.revenueTrends || [],
      salesTrends: data.data?.salesTrends || [],
      productStatus: data.data?.productStatus || [],
      geoDistribution: data.data?.geoDistribution || []
    };
  } catch (error) {
    return {
      userGrowth: [],
      revenueTrends: [],
      salesTrends: [],
      productStatus: [],
      geoDistribution: []
    };
  }
}

export async function getMonthlyMetrics() {
  try {
    const response = await api.get('/admin/metrics/monthly');
    if (response.data && response.data.data) {
      return {
        ...response.data,
        data: response.data.data.map((item: Record<string, unknown>) => ({
          month: item.month,
          sellerCount: item.seller_count || 0,
          productCount: item.product_count || 0,
          buyerCount: item.buyer_count || 0
        }))
      };
    }

    return response.data;
  } catch (error) {
    throw error;
  }
}


