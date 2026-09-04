import apiClient from '@/infrastructure/http/apiClient';

export interface AvailableShop {
  id: number;
  shopName: string;
  slug: string;
  logoUrl?: string;
  location?: string;
  physicalAddress?: string;
  creatorCommissionRate: number;
  productCount: number;
  theme?: string;
  collaborationStatus: 'none' | 'pending' | 'active' | 'denied';
  linkCode?: string;
}

export const getAvailableShops = async (): Promise<AvailableShop[]> => {
  const response = await apiClient.get<{ status: string; data: { shops: AvailableShop[] } }>('/creators/available-shops');
  return response.data?.data?.shops || [];
};

export const requestCollaboration = async (sellerId: number, message?: string) => {
  const response = await apiClient.post(`/creators/shops/${sellerId}/request`, { message });
  return response.data;
};
