import apiClient, { getFreshCsrfToken } from '@/lib/apiClient';
import type {
  ReferralDashboard,
  RegisterSellerInput,
  Seller,
  SellerAnalytics,
  Theme,
  UpdateSellerProfileInput
} from './types';

const sellerApiInstance = apiClient;

export const transformSeller = (data: any): Seller => {
  const seller = data.seller || data;

  return {
    id: seller.id,
    fullName: seller.fullName || seller.full_name || '',
    shopName: seller.shopName || seller.shop_name || '',
    email: seller.email || '',
    phone: seller.phone || seller.whatsapp_number || '',
    whatsappNumber: seller.whatsapp_number || seller.whatsappNumber || seller.phone || '',
    city: seller.city || '',
    location: seller.location || '',
    physicalAddress: seller.physicalAddress || seller.physical_address || '',
    hasPhysicalShop: seller.hasPhysicalShop || !!seller.physicalAddress || !!seller.physical_address,
    latitude: seller.latitude,
    longitude: seller.longitude,
    bannerImage: seller.bannerImage || seller.banner_image || null,
    bio: seller.bio || '',
    avatarUrl: seller.avatarUrl || seller.avatar_url || '',
    theme: seller.theme || 'default',
    instagramLink: seller.instagramLink || seller.instagram_link || '',
    tiktokLink: seller.tiktokLink || seller.tiktok_link || '',
    facebookLink: seller.facebookLink || seller.facebook_link || '',
    creatorCommissionRate: Number(seller.creatorCommissionRate ?? seller.creator_commission_rate ?? 0.01),
    is_verified: !!(seller.is_verified || seller.isVerified || seller.user?.is_verified),
    clientCount: seller.clientCount !== undefined ? seller.clientCount : (seller.client_count || 0),
    totalSales: parseFloat(seller.totalSales || seller.total_sales || 0),
    createdAt: seller.createdAt || seller.created_at || new Date().toISOString(),
    updatedAt: seller.updatedAt || seller.updated_at || new Date().toISOString()
  };
};

interface ShopNameAvailabilityResponse {
  data: {
    available: boolean;
  };
}

interface LoginResponse {
  data: {
    seller: Seller;
  };
}

interface RegisterResponse {
  status: string;
  message?: string;
  data: {
    seller?: Seller;
    email?: string;
    emailVerificationRequired?: boolean;
    emailVerificationSent?: boolean;
  };
}

interface SellerResponse {
  data: any;
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

export const sellerProfileApi = {
  login: async (credentials: { email: string; password: string }): Promise<{ seller: Seller }> => {
    try {
      const response = await sellerApiInstance.post<LoginResponse>('/sellers/login', credentials);
      const responseData = response.data.data;

      if (!responseData) {
        throw new Error('Invalid response from server');
      }

      const { seller } = responseData;

      if (!seller) {
        throw new Error('Invalid response from server - missing seller');
      }

      await getFreshCsrfToken();

      return { seller: transformSeller(seller) };
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  register: async (data: RegisterSellerInput): Promise<{ seller?: Seller; status?: string; message?: string }> => {
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
    } catch (error: any) {
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
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to resend verification email');
    }
  },

  getProfile: async (): Promise<Seller> => {
    try {
      const response = await sellerApiInstance.get<SellerResponse>('/sellers/profile');
      const profileData = response.data?.data?.seller;
      if (!profileData) {
        throw new Error('No profile data received');
      }
      return transformSeller(profileData);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  getSellerById: async (id: string | number): Promise<Seller> => {
    try {
      const response = await sellerApiInstance.get<SellerResponse>(`/sellers/${id}`);
      const sellerData = response.data?.data;
      if (!sellerData) {
        throw new Error('No seller data received');
      }
      return transformSeller(sellerData);
    } catch (error: any) {
      console.error('Error fetching seller:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  async getSellerByShopName(shopName: string): Promise<Seller> {
    try {
      const response = await sellerApiInstance.get<SellerResponse>(`/sellers/shop/${encodeURIComponent(shopName)}`);
      const sellerData = response.data?.data;
      if (!sellerData) {
        throw new Error('No seller data received');
      }
      return transformSeller(sellerData);
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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

  updateProfile: async (data: UpdateSellerProfileInput): Promise<Seller> => {
    try {
      const response = await sellerApiInstance.patch<{ data: Seller }>('/sellers/profile', data);
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
        message: (response.data as any).message || 'Email verified successfully'
      };
    } catch (error: any) {
      console.error('Email verification error:', error);
      throw new Error(error.response?.data?.message || 'Email verification failed');
    }
  }
};
