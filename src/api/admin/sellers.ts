import { api } from './instance';

export async function getSellers() {
  try {
    console.log('Fetching sellers from API...');
    const response = await api.get('/admin/sellers');
    console.log('Sellers API response:', response);
    const sellersData = Array.isArray(response.data.data) ? response.data.data : [];
    return sellersData.map((seller: Record<string, unknown>) => ({
      ...seller,
      id: String(seller.id || ''),
      name: seller.name || seller.full_name || 'Unnamed Seller',
      phone: seller.phone || seller.whatsapp_number || '',
      createdAt: seller.created_at || seller.createdAt || new Date().toISOString(),
      user_id: seller.user_id
    }));
  } catch (error) {
    console.error('Error fetching sellers:', error);
    return [];
  }
}

export async function getSellerById(id: string) {
  try {
    const response = await api.get(`/admin/sellers/${id}`);
    const seller = response.data.data;
    if (!seller) return null;
    return {
      ...seller,
      id: String(seller.id || ''),
      name: seller.name || seller.full_name || 'Unnamed Seller',
      phone: seller.phone || seller.whatsapp_number || '',
      createdAt: seller.created_at || seller.createdAt || new Date().toISOString(),
      recentOrders: (seller.recentOrders || []).map((o: Record<string, unknown>) => ({
        ...o,
        id: String(o.id || '')
      }))
    };
  } catch (error) {
    console.error('Error fetching seller details:', error);
    return null;
  }
}

export function updateSellerStatus(sellerId: string, data: { status: string }) {
  return api.patch(`/admin/sellers/${sellerId}/status`, data);
}


