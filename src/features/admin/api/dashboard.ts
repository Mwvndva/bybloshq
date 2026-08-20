import { api } from './instance';

export async function getDashboardStats() {
  try {
    const { data } = await api.get('/admin/stats');
    return data.data;
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      totalBuyers: 0,
      totalClients: 0,
      totalCreators: 0,
      pendingCreatorRequests: 0,
      totalCreatorEarnings: 0,
      totalProducts: 0,
      totalOrders: 0,
      totalWishlists: 0,
      topShops: []
    };
  }
}


