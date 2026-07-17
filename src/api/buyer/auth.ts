import apiClient, { getFreshCsrfToken } from '@/lib/apiClient';
import { buyerApiInstance, ApiError } from './instance';
import { Buyer, transformBuyer } from './profile';

interface LoginApiResponse {
  status: string;
  data: {
    buyer: Buyer;
    token?: string;
    refreshToken?: string;
  };
}

export interface LoginResponse {
  buyer?: Buyer;
  token?: string;
  refreshToken?: string;
  status?: string;
  message?: string;
}

interface RegisterResponse {
  status: string;
  message?: string;
  data: {
    buyer?: Buyer;
    email?: string;
    emailVerificationRequired?: boolean;
    emailVerificationSent?: boolean;
  };
}

export interface RegisterData {
  fullName: string;
  email: string;
  mobilePayment: string;
  whatsappNumber: string;
  password: string;
  confirmPassword: string;
  city: string;
  location: string;
}

export async function login(credentials: { email: string; password: string }): Promise<LoginResponse> {
  try {
    const loginUrl = '/buyers/login';

    if (import.meta.env.DEV) {
      console.log('=== LOGIN ATTEMPT ===');
    }
    const response = await apiClient.post<LoginApiResponse>(
      loginUrl,
      credentials
    );

    const responseData = response.data;

    if (!responseData) {
      throw new Error('Invalid response from server - no data received');
    }

    const { data } = responseData;

    if (!data?.buyer) {
      throw new Error('Invalid response from server - missing buyer data');
    }

    const { buyer, token, refreshToken } = data;

    delete buyerApiInstance.defaults.headers.common['Authorization'];

    await getFreshCsrfToken();

    return { buyer: transformBuyer(buyer), token, refreshToken };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function register(data: RegisterData): Promise<LoginResponse> {
  try {
    const payload = {
      fullName: data.fullName,
      email: data.email,
      mobile_payment: data.mobilePayment,
      whatsapp_number: data.whatsappNumber,
      password: data.password,
      confirmPassword: data.confirmPassword,
      city: data.city,
      location: data.location,
      termsAccepted: (data as unknown as Record<string, unknown>).termsAccepted === true
    };

    const response = await buyerApiInstance.post<RegisterResponse>('/buyers/register', payload);
    const responseBody = response.data;
    const responseData = responseBody?.data;

    if (!responseBody) {
      throw new Error('Invalid response from server');
    }

    if (responseBody.status === 'success' && responseData?.emailVerificationRequired) {
      return {
        status: 'pending_verification',
        message: responseBody.message
      };
    }

    const { buyer } = responseData || {};

    if (!buyer) {
      throw new Error('Invalid response from server - missing buyer profile');
    }

    await getFreshCsrfToken();

    return { buyer: transformBuyer(buyer) };
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  try {
    const response = await buyerApiInstance.post<{ message: string }>(
      '/buyers/resend-verification',
      { email: email.trim().toLowerCase() }
    );
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    throw new Error(err.response?.data?.message || 'Failed to resend verification email');
  }
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  try {
    const response = await apiClient.post<{ message: string }>(
      `/buyers/forgot-password`,
      { email: email.trim().toLowerCase() }
    );

    if (!response.data || typeof response.data.message !== 'string') {
      return { message: 'Password reset email sent successfully' };
    }

    return response.data;
  } catch (error) {
    const err = error as ApiError;
    console.error('Forgot password error:', err);
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    }
    throw error;
  }
}

export async function resetPassword(token: string, newPassword: string, email: string): Promise<{ message: string }> {
  try {
    const response = await apiClient.post<{ message: string }>(
      `/buyers/reset-password`,
      { token, newPassword, email }
    );

    if (!response.data || typeof response.data.message !== 'string') {
      return { message: 'Password has been reset successfully' };
    }

    return response.data;
  } catch (error) {
    const err = error as ApiError;
    console.error('Reset password error:', err);
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    } else if (err.response?.data?.error) {
      throw new Error(err.response.data.error);
    } else if (err.message) {
      throw new Error(err.message);
    }
    throw new Error('An unknown error occurred while resetting your password.');
  }
}

export async function checkBuyerByPhone(phone: string): Promise<{
  exists: boolean;
  buyer?: Buyer;
  token?: string;
}> {
  try {
    if (import.meta.env.DEV) {
      console.log('Checking buyer by phone...');
    }
    const response = await apiClient.post<{
      status: string;
      data: {
        exists: boolean;
        buyer?: Buyer;
        token?: string;
      }
    }>(
      `/buyers/check-phone`,
      { phone }
    );

    if (!response.data || response.data.status !== 'success') {
      throw new Error('Failed to check buyer information');
    }
    return response.data.data;
  } catch (error) {
    const err = error as ApiError;
    console.error('Error checking buyer by phone:', err);
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    }
    throw new Error('Failed to check buyer information. Please try again.');
  }
}

export async function saveBuyerInfo(buyerInfo: {
  fullName: string;
  email: string;
  mobilePayment: string;
  whatsappNumber: string;
  city?: string;
  location?: string;
  password?: string;
}): Promise<{ buyer?: Buyer; token?: string; message?: string; requiresLogin?: boolean; exists?: boolean }> {
  try {
    if (import.meta.env.DEV) {
      console.log('Saving buyer info...');
    }

    const response = await apiClient.post<{ status: string; data: { buyer?: Buyer; token?: string; message?: string } }>(
      `/buyers/save-info`,
      {
        ...buyerInfo,
        phone: buyerInfo.mobilePayment || buyerInfo.whatsappNumber
      }
    );

    if (!response.data || response.data.status !== 'success') {
      throw new Error(response.data?.data?.message || 'Failed to save buyer information');
    }

    return response.data.data;
  } catch (error) {
    const err = error as ApiError;
    console.error('Error saving buyer info:', err);

    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    }

    throw new Error('Failed to save buyer information. Please try again.');
  }
}

export async function verifyEmail(email: string, token: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await apiClient.get(`/buyers/verify-email`, {
      params: { email, token }
    });
    return {
      success: true,
      message: response.data.message || 'Email verified successfully'
    };
  } catch (error) {
    const err = error as ApiError;
    console.error('Email verification error:', err);
    throw new Error(err.response?.data?.message || 'Email verification failed');
  }
}

export async function autoLogin(autoLoginToken: string): Promise<unknown> {
  try {
    const response = await apiClient.post('/buyers/auto-login', { autoLoginToken });
    return response.data;
  } catch (error) {
    console.error('Auto-login error:', error);
    throw error;
  }
}


