
import type { ApiSeller } from '@/shared/types/api/seller';
import apiClient, { getFreshCsrfToken } from '@/infrastructure/http/apiClient';
import { storage } from '@/infrastructure/storage/storage';
import type {
  ReferralDashboard,
  RegisterSellerInput,
  SellerAnalytics,
  Theme,
  UpdateSellerProfileInput
} from '../types';

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
  status?: string;
  message?: string;
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
    let responseBody: any = null;

    try {
      const response = await sellerApiInstance.post<any>('/sellers/login', credentials);
      responseBody = response?.data !== undefined ? response.data : response;
      if (typeof responseBody === 'string' && responseBody.trim()) {
        try {
          responseBody = JSON.parse(responseBody);
        } catch {
          /* ignore json parse error */
        }
      }
    } catch {
      /* ignore Axios error to allow fetch fallback */
    }

    if (!responseBody || typeof responseBody !== 'object' || responseBody.status === 'error' || responseBody.status === 'fail') {
      try {
        const csrfToken = await getFreshCsrfToken();
        const fetchRes = await fetch('https://byblos-backend-fky5.onrender.com/api/sellers/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken || '',

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

    if (!responseBody || typeof responseBody !== 'object') {
      throw new Error('Malformed server response payload. Please try again.');
    }

    if (responseBody.status === 'error' || responseBody.status === 'fail') {
      throw new Error(responseBody.message || responseBody.error || 'Login failed');
    }

    const responseData = responseBody.data || responseBody;
    const rawSeller = responseData?.seller || responseData?.user || responseBody?.seller || responseBody?.user || (responseData?.id ? responseData : null);
    const token = responseData?.token || responseData?.accessToken || responseBody?.token || responseBody?.accessToken;
    const refreshToken = responseData?.refreshToken || responseBody?.refreshToken;

    if (!rawSeller) {
      throw new Error(responseBody.message || 'Login response incomplete: missing seller profile details.');
    }

    try {
      await getFreshCsrfToken();
    } catch {
      /* ignore post-login CSRF refresh errors */
    }

    return { seller: transformSeller(rawSeller), token, refreshToken };
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

      if (!responseBody || typeof responseBody !== 'object') {
        const httpStatus = response?.status;
        if (httpStatus && httpStatus >= 500) {
          throw new Error(`Server temporarily unavailable (HTTP ${httpStatus}). Please try again later.`);
        }
        throw new Error('Malformed server response payload. Please try again.');
      }

      if (responseBody.status === 'success' && responseData?.emailVerificationRequired) {
        return {
          status: 'pending_verification',
          message: responseBody.message
        };
      }

      const { seller } = responseData || {};

      if (!seller) {
        throw new Error('Registration response incomplete: missing seller profile details.');
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
    let bodyData: any = null;

    try {
      const response = await sellerApiInstance.get<any>('/sellers/profile');
      bodyData = response?.data !== undefined ? response.data : response;
      if (typeof bodyData === 'string' && bodyData.trim()) {
        try {
          bodyData = JSON.parse(bodyData);
        } catch {
          /* ignore json parse error */
        }
      }
    } catch {
      /* ignore Axios error for fetch fallback */
    }

    if (!bodyData || typeof bodyData !== 'object' || bodyData.status === 'error') {
      try {
        const token = (await storage.get('sellerToken')) || localStorage.getItem('sellerToken');
        const csrfToken = await getFreshCsrfToken();
        const fetchRes = await fetch('https://byblos-backend-fky5.onrender.com/api/sellers/profile', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            'X-CSRF-Token': csrfToken || '',

          },
          credentials: 'include'
        });
        const textData = await fetchRes.text();
        if (textData && typeof textData === 'string') {
          try {
            bodyData = JSON.parse(textData);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore fetch fallback error */
      }
    }

    const profileData = bodyData?.data?.seller || bodyData?.seller || bodyData?.data || bodyData;
    if (!profileData || typeof profileData !== 'object') {
      throw new Error('No profile data received');
    }
    return transformSeller(profileData);
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
    let bodyData: any = null;

    try {
      const response = await sellerApiInstance.get<any>('/sellers/analytics');
      bodyData = response?.data !== undefined ? response.data : response;
      if (typeof bodyData === 'string' && bodyData.trim()) {
        try {
          bodyData = JSON.parse(bodyData);
        } catch {
          /* ignore json parse error */
        }
      }
    } catch {
      /* ignore Axios error for fetch fallback */
    }

    if (!bodyData || typeof bodyData !== 'object' || bodyData.status === 'error') {
      try {
        const token = (await storage.get('sellerToken')) || localStorage.getItem('sellerToken');
        const csrfToken = await getFreshCsrfToken();
        const fetchRes = await fetch('https://byblos-backend-fky5.onrender.com/api/sellers/analytics', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            'X-CSRF-Token': csrfToken || '',

          },
          credentials: 'include'
        });
        const textData = await fetchRes.text();
        if (textData && typeof textData === 'string') {
          try {
            bodyData = JSON.parse(textData);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore fetch fallback error */
      }
    }

    const analyticsData = bodyData?.data || bodyData;
    if (!analyticsData || typeof analyticsData !== 'object') {
      return {
        totalProducts: 0,
        totalSales: 0,
        totalRevenue: 0,
        totalPayout: 0,
        balance: 0,
        clientCount: 0,
        creatorCount: 0,
        creatorGeneratedSales: 0,
        wishlistCount: 0,
        clickCount: 0,
        monthlySales: [],
        recentOrders: []
      } as unknown as SellerAnalytics;
    }
    return analyticsData;
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

if (typeof window !== 'undefined') {
  (window as any).sellerProfileApi = sellerProfileApi;
}


