import apiClient from '@/infrastructure/http/apiClient';

export const getProfile = async () => {
  const response = await apiClient.get('/creators/profile');
  return response.data?.data?.creator;
};


