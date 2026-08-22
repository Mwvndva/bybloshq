import apiClient from '@/infrastructure/http/apiClient';

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

export const register = async (payload: CreatorRegistrationPayload) => {
  const response = await apiClient.post('/creators/register', payload);
  return response.data;
};

export const login = async (emailOrCredentials: string | { email: string; password: string }, maybePassword?: string) => {
  const credentials = typeof emailOrCredentials === 'string'
    ? { email: emailOrCredentials, password: maybePassword }
    : emailOrCredentials;
  const response = await apiClient.post('/creators/login', credentials);
  return {
    creator: response.data?.data?.creator,
    token: response.data?.data?.token,
    refreshToken: response.data?.data?.refreshToken,
    ...response.data
  };
};

export const logout = async () => {
  const response = await apiClient.post('/creators/logout');
  return response.data;
};

export const forgotPassword = async (email: string): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>('/creators/forgot-password', {
    email: email.trim().toLowerCase(),
  });
  return response.data ?? { message: 'Password reset email sent.' };
};

export const resetPassword = async (
  token: string,
  newPassword: string,
  email: string,
): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>('/creators/reset-password', {
    token,
    newPassword,
    email,
  });
  return response.data ?? { message: 'Password has been reset.' };
};

export const verifyEmail = async (token: string, email: string) => {
  const response = await apiClient.get('/creators/verify-email', {
    params: { token, email }
  });
  return response.data;
};

export const resendVerification = async (email: string) => {
  const response = await apiClient.post('/creators/resend-verification', { email });
  return response.data;
};


