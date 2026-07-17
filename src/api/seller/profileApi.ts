import type { ApiSeller } from '@/types/api/seller';
import apiClient, { getFreshCsrfToken } from '@/lib/apiClient';
import type {
  ReferralDashboard,
  RegisterSellerInput,
  SellerAnalytics,
  Theme,
  UpdateSellerProfileInput
} from './types';

const sellerApiInstance = apiClient;

export const transformSeller = (data: unknown): ApiSeller => {
  const dataObj = (data && typeof data === 'object') ? (data as Record<string, unknown>) : {};
  const seller = (dataObj.seller && typeof dataObj.seller === 'object' ? dataObj.seller : dataObj) as Record<string, unknown>;
  const user = (seller.user && typeof seller.user === 'object') ? (seller.user as Record<string, unknown>) : undefined;

  // Backend responses mix snake_case and camelCase; coerce each field to the
  // ApiSeller contract without altering the original selection semantics.
  const str = (v: unknown, fallback = ''): string => (v === null || v === undefined || v === '') ? fallback : String(v);
  const optNum = (v: unknown): number | undefined => {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  return {
    id: Number(seller.id),
    fullName: str(seller.fullName || seller.full_name),
    shopName: str(seller.shopName || seller.shop_name),
    email: str(seller.email),
    phone: str(seller.phone || seller.whatsapp_number),
    whatsappNumber: str(seller.whatsapp_number || seller.whatsappNumber || seller.phone),
    city: str(seller.city),
    location: str(seller.location),
    physicalAddress: str(seller.physicalAddress || seller.physical_address),
    hasPhysicalShop: Boolean(seller.hasPhysicalShop || seller.physicalAddress || seller.physical_address),
    latitude: optNum(seller.latitude),
    longitude: optNum(seller.longitude),
    bannerImage: str(seller.bannerImage || seller.banner_image) || undefined,
    bio: str(seller.bio),
    avatarUrl: str(seller.avatarUrl || seller.avatar_url),
    theme: (seller.theme || 'default') as ApiSeller['theme'],
    instagramLink: str(seller.instagramLink || seller.instagram_link),
    tiktokLink: str(seller.tiktokLink || seller.tiktok_link),
    facebookLink: str(seller.facebookLink || seller.facebook_link),
    creatorCommissionRate: Number(seller.creatorCommissionRate ?? seller.creator_commission_rate ?? 0.01),
    is_verified: !!(seller.is_verified || seller.isVerified || user?.is_verified),
    clientCount: seller.clientCount !== undefined ? optNum(seller.clientCount) : optNum(seller.client_count),
    totalSales: optNum(seller.totalSales || seller.total_sales) ?? 0,
    createdAt: str(seller.createdAt || seller.created_at, new Date().toISOString()),
    updatedAt: str(seller.updatedAt || seller.updated_at, new Date().toISOString())
  };
};

interface ShopNameAvailabilityResponse {
  data: {
    available: boolean;
  };
}

interface LoginResponse {
  data: {
    seller: ApiSeller;
    token?: string;
    refreshToken?: string;
  };
}

interface RegisterResponse {
  status: string;
  message?: string;
  data: {
    seller?: ApiSeller;
    email?: string;
    emailVerificationRequired?: boolean;
    emailVerificationSent?: boolean;
  };
}

interface SellerResponse {
  data: unknown;
}

interface AnalyticsResponse {
  data: SellerAnalytics;
}

interface ForgotPasswordResponse {
  message: string;
}

interface ResetPasswordResponse {
  message: string;
}

interface ReferralDashboardResponse {
  data: ReferralDashboard;
}

interface ReferralCodeResponse {
  data: {
    referralCode: string;
    referralLink: string;
  };
}

export const checkShopNameAvailability = async (shopName: string): Promise<{ available: boolean }> => {
  try {
    const response = await sellerApiInstance.get<ShopNameAvailabilityResponse>(`/sellers/check-shop-name?shopName=${encodeURIComponent(shopName)}`);
    return response.data.data;
  } catch (error) {
    console.error('Error checking shop name availability:', error);
    return { available: false };
  }
};

export const deleteSellerAccount = () => sellerApiInstance.delete('/sellers/account');

export const sellerProfileApi = {
  login: async (credentials: { email: string; password: string }): Promise<{ seller: ApiSeller; token?: string; refreshToken?: string }> => {
    try {
      const response = await sellerApiInstance.post<LoginResponse>('/sellers/login', credentials);
      const responseData = response.data.data;

      if (!responseData) {
        throw new Error('Invalid response from server');
      }

      const { seller, token, refreshToken } = responseData;

      if (!seller) {
        throw new Error('Invalid response from server - missing seller');
      }

      await getFreshCsrfToken();

      return { seller: transformSeller(seller), token, refreshToken };
    } catch (error) {
      console.error('Login error:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  register: async (data: RegisterSellerInput): Promise<{ seller?: ApiSeller; status?: string; message?: string }> => {
    try {
      const response = await sellerApiInstance.post<RegisterResponse>('/sellers/register', {
        fullName: data.fullName,
        shopName: data.shopName,
        email: data.email,
        whatsappNumber: data.whatsappNumber,
        password: data.password,
        confirmPassword: data.confirmPassword,
        city: data.city,
        location: data.location,
        physicalAddress: data.physicalAddress,
        latitude: data.latitude,
        longitude: data.longitude,
        referralCode: data.referralCode || undefined,
        termsAccepted: data.termsAccepted
      });

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

      const { seller } = responseData || {};

      if (!seller) {
        throw new Error('Invalid response from server - missing seller profile');
      }

      await getFreshCsrfToken();

      return { seller: transformSeller(seller) };
    } catch (error) {
      console.error('Registration error:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  resendVerification: async (email: string): Promise<{ message: string }> => {
    try {
      const response = await sellerApiInstance.post<{ message: string }>(
        '/sellers/resend-verification',
        { email: email.trim().toLowerCase() }
      );
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to resend verification email');
    }
  },

  getProfile: async (): Promise<ApiSeller> => {
    try {
      const response = await sellerApiInstance.get<SellerResponse>('/sellers/profile');
      const profileData = (response.data?.data as Record<string, unknown>)?.seller;
      if (!profileData) {
        throw new Error('No profile data received');
      }
      return transformSeller(profileData);
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  getSellerById: async (id: string | number): Promise<ApiSeller> => {
    try {
      const response = await sellerApiInstance.get<SellerResponse>(`/sellers/${id}`);
      const sellerData = response.data?.data;
      if (!sellerData) {
        throw new Error('No seller data received');
      }
      return transformSeller(sellerData);
    } catch (error) {
      console.error('Error fetching seller:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  async getSellerByShopName(shopName: string): Promise<ApiSeller> {
    try {
      const response = await sellerApiInstance.get<SellerResponse>(`/sellers/shop/${encodeURIComponent(shopName)}`);
      const sellerData = response.data?.data;
      if (!sellerData) {
        throw new Error('No seller data received');
      }
      return transformSeller(sellerData);
    } catch (error) {
      console.error('Error fetching seller by shop name:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  getAnalytics: async (): Promise<SellerAnalytics> => {
    try {
      const response = await sellerApiInstance.get<AnalyticsResponse>('/sellers/analytics');
      if (!response.data?.data) {
        throw new Error('No analytics data received');
      }
      return response.data.data;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    try {
      const response = await apiClient.post<ForgotPasswordResponse>(
        `/sellers/forgot-password`,
        {
          email: email.trim().toLowerCase()
        }
      );

      if (!response.data?.message) {
        throw new Error('Invalid response format from server');
      }

      return { message: response.data.message };
    } catch (error) {
      console.error('Forgot password error:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  resetPassword: async (token: string, newPassword: string, email: string): Promise<{ message: string }> => {
    try {
      const response = await apiClient.post<ResetPasswordResponse>(
        `/sellers/reset-password`,
        { token, newPassword, email }
      );

      if (!response.data?.message) {
        throw new Error('Invalid response format from server');
      }

      return { message: response.data.message };
    } catch (error) {
      console.error('Reset password error:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      } else if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      } else if (error.message) {
        throw new Error(error.message);
      }
      throw new Error('An unknown error occurred while resetting your password.');
    }
  },

  updateProfile: async (data: UpdateSellerProfileInput): Promise<ApiSeller> => {
    try {
      const response = await sellerApiInstance.patch<{ data: ApiSeller }>('/sellers/profile', data);
      return transformSeller(response.data.data);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  async updateTheme(theme: Theme): Promise<{ theme: Theme }> {
    const response = await sellerApiInstance.patch<{ data: { theme: Theme } }>('/sellers/theme', { theme });
    return response.data.data;
  },

  async uploadBanner(bannerImage: string): Promise<{ bannerUrl: string }> {
    const response = await sellerApiInstance.post<{ data: { bannerUrl: string } }>('/sellers/upload-banner', { bannerImage }, {
      timeout: 2 * 60 * 1000,
    });
    return response.data.data;
  },

  async uploadBusinessPhoto(businessPhoto: string): Promise<{ businessPhotoUrl: string; avatarUrl: string }> {
    const response = await sellerApiInstance.post<{ data: { businessPhotoUrl: string; avatarUrl: string } }>('/sellers/upload-business-photo', { businessPhoto }, {
      timeout: 2 * 60 * 1000,
    });
    return response.data.data;
  },

  async getReferralDashboard(): Promise<ReferralDashboard> {
    const response = await sellerApiInstance.get<ReferralDashboardResponse>('/sellers/referral/dashboard');
    return response.data.data;
  },

  async generateReferralCode(): Promise<{ referralCode: string; referralLink: string }> {
    const response = await sellerApiInstance.post<ReferralCodeResponse>('/sellers/referral/generate-code');
    return response.data.data;
  },

  async inviteCreator(email: string) {
    const response = await sellerApiInstance.post('/sellers/creator-invites', { email });
    return response.data?.data?.invite;
  },

  async getCreatorInvites() {
    const response = await sellerApiInstance.get('/sellers/creator-invites');
    return response.data?.data?.invites || [];
  },

  verifyEmail: async (email: string, token: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.get(`/sellers/verify-email`, {
        params: { email, token }
      });
      return {
        success: true,
        message: ((response.data as Record<string, unknown>)?.message as string) || 'Email verified successfully'
      };
    } catch (error) {
      console.error('Email verification error:', error);
      throw new Error(error.response?.data?.message || 'Email verification failed');
    }
  }
};


