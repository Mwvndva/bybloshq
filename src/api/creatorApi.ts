import apiClient from '@/lib/apiClient';

export interface CreatorRegistrationPayload {
  token: string;
  firstName: string;
  lastName: string;
  email: string;
  mpesaNumber: string;
  whatsappNumber: string;
  password: string;
  confirmPassword: string;
  referralCode?: string;
}

export const creatorApi = {
  getInvite: async (token: string) => {
    const response = await apiClient.get(`/creators/invites/${token}`);
    return response.data?.data?.invite;
  },

  register: async (payload: CreatorRegistrationPayload) => {
    const response = await apiClient.post('/creators/register', payload);
    return response.data;
  },

  login: async (emailOrCredentials: string | { email: string; password: string }, maybePassword?: string) => {
    const credentials = typeof emailOrCredentials === 'string'
      ? { email: emailOrCredentials, password: maybePassword }
      : emailOrCredentials;
    const response = await apiClient.post('/creators/login', credentials);
    return {
      creator: response.data?.data?.creator,
      token: response.data?.data?.token,
      ...response.data
    };
  },

  logout: async () => {
    const response = await apiClient.post('/creators/logout');
    return response.data;
  },

  verifyEmail: async (token: string, email: string) => {
    const response = await apiClient.get('/creators/verify-email', {
      params: { token, email }
    });
    return response.data;
  },

  resendVerification: async (email: string) => {
    const response = await apiClient.post('/creators/resend-verification', { email });
    return response.data;
  },

  getProfile: async () => {
    const response = await apiClient.get('/creators/profile');
    return response.data?.data?.creator;
  },

  getDashboard: async (period: 'daily' | 'weekly' | 'monthly' = 'monthly') => {
    const response = await apiClient.get('/creators/dashboard', {
      params: { period }
    });
    return response.data?.data;
  },

  getReferralDashboard: async () => {
    const response = await apiClient.get('/creators/referral/dashboard');
    return response.data?.data;
  },

  generateReferralCode: async () => {
    const response = await apiClient.post('/creators/referral/generate-code');
    return response.data?.data?.referralCode;
  },

  trackLinkClick: async (code: string) => {
    const response = await apiClient.post(`/creators/links/${encodeURIComponent(code)}/click`);
    return response.data;
  },

  requestWithdrawal: async (amount: number | string) => {
    const idempotencyKey = `creator-withdrawal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await apiClient.post(
      '/creators/withdrawals',
      { amount, idempotencyKey },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    return response.data?.data?.withdrawal;
  },

  acceptShopRequest: async (inviteId: number | string) => {
    const response = await apiClient.post(`/creators/shop-requests/${inviteId}/accept`);
    return response.data?.data;
  },

  denyShopRequest: async (inviteId: number | string) => {
    const response = await apiClient.post(`/creators/shop-requests/${inviteId}/deny`);
    return response.data?.data;
  }
};

export default creatorApi;
