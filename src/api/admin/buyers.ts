import { api } from './instance';

export async function getBuyers() {
  try {
    console.log('Fetching buyers from API...');
    const response = await api.get('/admin/buyers');
    console.log('Buyers API response:', response);

    let buyersData = [];
    if (response.data && Array.isArray(response.data.data)) {
      buyersData = response.data.data;
    } else if (Array.isArray(response.data)) {
      buyersData = response.data;
    } else {
      console.error('Unexpected API response format:', response);
      return [];
    }

    const buyers = buyersData.map((buyer: Record<string, unknown>) => ({
      id: String(buyer.id || `buyer-${globalThis.crypto.randomUUID()}`),
      name: String(buyer.name || buyer.full_name || 'Unnamed Buyer'),
      email: String(buyer.email || ''),
      phone: buyer.phone ? String(buyer.phone) : undefined,
      status: String(buyer.status || 'Active'),
      city: buyer.city || 'N/A',
      location: buyer.location || 'N/A',
      createdAt: buyer.created_at || buyer.createdAt || new Date().toISOString(),
      user_id: buyer.user_id
    }));

    console.log(`Fetched ${buyers.length} buyers with location data`);
    return buyers;
  } catch (error) {
    console.error('Error fetching buyers:', error);
    return [];
  }
}

export async function getBuyerById(id: string) {
  try {
    const response = await api.get(`/admin/buyers/${id}`);
    const buyer = response.data.data;
    if (!buyer) return null;
    return {
      ...buyer,
      id: String(buyer.id || ''),
      name: buyer.name || buyer.full_name || 'Unnamed Buyer',
      phone: buyer.phone || buyer.mobile_payment || '',
      createdAt: buyer.created_at || buyer.createdAt || new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching buyer details:', error);
    return null;
  }
}

export function updateBuyerStatus(buyerId: string, data: { status: string }) {
  return api.patch(`/admin/buyers/${buyerId}/status`, data);
}

export async function deleteUser(userId: string) {
  try {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}


