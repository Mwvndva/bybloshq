import apiClient from '@/lib/apiClient';

export const getDashboard = async (period: 'daily' | 'weekly' | 'monthly' = 'monthly') => {
  const response = await apiClient.get('/creators/dashboard', {
    params: { period }
  });
  return response.data?.data;
};


