import apiClient from '@/lib/apiClient';

export const getProfile = async () => {
  const response = await apiClient.get('/creators/profile');
  return response.data?.data?.creator;
};


