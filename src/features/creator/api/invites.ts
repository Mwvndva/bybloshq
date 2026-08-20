import apiClient from '@/infrastructure/http/apiClient';

export const getInvite = async (token: string) => {
  const response = await apiClient.get(`/creators/invites/${token}`);
  return response.data?.data?.invite;
};


