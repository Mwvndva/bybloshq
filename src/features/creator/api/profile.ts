import apiClient from '@/infrastructure/http/apiClient';

export const getProfile = async () => {
  const response = await apiClient.get('/creators/profile');
  const resBody = response.data;
  const resData = resBody?.data;
  return resData?.creator || resData?.user || resBody?.creator || resBody?.user || (resData?.id ? resData : null);
};


