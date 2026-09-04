import apiClient from '@/infrastructure/http/apiClient';

export const getProfile = async () => {
  const response = await apiClient.get('/creators/profile');
  const resBody = response.data;
  const resData = resBody?.data;
  return resData?.creator || resData?.user || resBody?.creator || resBody?.user || (resData?.id ? resData : null);
};

export interface UpdateCreatorProfilePayload {
  instagramLink?: string | null;
  tiktokLink?: string | null;
  whatsappNumber?: string | null;
}

export const updateProfile = async (payload: UpdateCreatorProfilePayload) => {
  const response = await apiClient.patch('/creators/profile', payload);
  const resBody = response.data;
  const resData = resBody?.data;
  return resData?.creator || resData?.user || resBody?.creator || resBody?.user || (resData?.id ? resData : null);
};
