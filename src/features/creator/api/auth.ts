import apiClient, { getFreshCsrfToken } from '@/infrastructure/http/apiClient';
import { buildApiBaseUrl } from '@/infrastructure/http/apiBaseUrl';

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

  let responseBody: any = null;

  try {
    const response = await apiClient.post<any>('/creators/login', credentials);
    responseBody = response?.data !== undefined ? response.data : response;
    if (typeof responseBody === 'string' && responseBody.trim()) {
      try {
        responseBody = JSON.parse(responseBody);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore Axios error for fetch fallback */
  }

  if (!responseBody || typeof responseBody !== 'object' || responseBody.status === 'error' || responseBody.status === 'fail') {
    try {
      const csrfToken = await getFreshCsrfToken();
      const baseUrl = buildApiBaseUrl();
      const fetchRes = await fetch(`${baseUrl}/creators/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify(credentials),
        credentials: 'include'
      });
      const textData = await fetchRes.text();
      if (textData && typeof textData === 'string') {
        try {
          responseBody = JSON.parse(textData);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore fetch fallback error */
    }
  }

  const responseData = responseBody?.data || responseBody;
  const rawCreator = responseData?.creator || responseData?.user || responseBody?.creator || responseBody?.user;
  const token = responseData?.token || responseData?.accessToken || responseBody?.token || responseBody?.accessToken;
  const refreshToken = responseData?.refreshToken || responseBody?.refreshToken;

  return {
    creator: rawCreator,
    token,
    refreshToken,
    ...responseBody
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


