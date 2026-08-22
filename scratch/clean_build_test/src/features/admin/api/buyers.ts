import { api } from './instance';

export async function getBuyers() {
  try {
    const response = await api.get('/admin/buyers');

    let buyersData = [];
    if (response.data && Array.isArray(response.data.data)) {
      buyersData = response.data.data;
    } else if (Array.isArray(response.data)) {
      buyersData = response.data;
    } else {
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

    return buyers;
  } catch (error) {
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
    throw error;
  }
}


