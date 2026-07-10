import apiClient from '@/lib/apiClient';

export const acceptShopRequest = async (inviteId: number | string) => {
  const response = await apiClient.post(`/creators/shop-requests/${inviteId}/accept`);
  return response.data?.data;
};

export const denyShopRequest = async (inviteId: number | string) => {
  const response = await apiClient.post(`/creators/shop-requests/${inviteId}/deny`);
  return response.data?.data;
};


