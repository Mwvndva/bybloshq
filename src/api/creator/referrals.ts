import apiClient from '@/lib/apiClient';

export const getReferralDashboard = async () => {
  const response = await apiClient.get('/creators/referral/dashboard');
  return response.data?.data;
};

export const generateReferralCode = async () => {
  const response = await apiClient.post('/creators/referral/generate-code');
  return response.data?.data?.referralCode;
};

export const trackLinkClick = async (code: string) => {
  const response = await apiClient.post(`/creators/links/${encodeURIComponent(code)}/click`);
  return response.data;
};


