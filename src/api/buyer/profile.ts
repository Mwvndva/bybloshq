import { buyerApiInstance, ApiError } from './instance';

export interface Buyer {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  mobilePayment: string;
  whatsappNumber: string;
  city?: string;
  location?: string;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;
  refunds?: number;
  createdAt: string;
  updatedAt?: string;
  hasLocation?: boolean;
  hasEmail?: boolean;
  is_verified: boolean;
}

export const transformBuyer = (data: unknown): Buyer => {
  const buyerData = data as Record<string, unknown>;
  return {
    id: Number(buyerData.id),
    fullName: String(buyerData.name || buyerData.fullName || buyerData.full_name || ''),
    email: String(buyerData.email || ''),
    phone: String(buyerData.mobilePayment || buyerData.whatsappNumber || ''),
    mobilePayment: String(buyerData.mobilePayment || ''),
    whatsappNumber: String(buyerData.whatsappNumber || ''),
    city: buyerData.city ? String(buyerData.city) : '',
    location: buyerData.location ? String(buyerData.location) : '',
    hasLocation: Boolean(buyerData.hasLocation),
    hasEmail: Boolean(buyerData.hasEmail),
    is_verified: !!(buyerData.is_verified || buyerData.isVerified),
    refunds: buyerData.refunds ? Number(buyerData.refunds) : 0,
    createdAt: buyerData.createdAt ? String(buyerData.createdAt) : new Date().toISOString(),
    updatedAt: buyerData.updatedAt ? String(buyerData.updatedAt) : undefined
  };
};

export const getBuyerProfile = () => buyerApiInstance.get('/buyers/profile');
export const updateBuyerProfile = (data: Record<string, unknown>) => buyerApiInstance.patch('/buyers/update-profile', data);

export async function getProfile(): Promise<Buyer> {
  try {
    interface ProfileResponse {
      status: string;
      data: {
        buyer: Buyer;
      };
    }
    const response = await buyerApiInstance.get<ProfileResponse>('/buyers/profile');
    const buyerData = response.data.data?.buyer;
    if (!buyerData) {
      throw new Error('No profile data received');
    }
    return transformBuyer(buyerData);
  } catch (error) {
    const err = error as ApiError;
    console.error('Error fetching profile:', err);
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    }
    throw error;
  }
}

export async function updateProfile(data: Record<string, unknown>): Promise<Buyer> {
  try {
    const response = await updateBuyerProfile(data) as import('axios').AxiosResponse;
    if (response.data?.data?.buyer) {
      return transformBuyer(response.data.data.buyer);
    }
    return transformBuyer(response.data?.data || response.data);
  } catch (error) {
    const err = error as ApiError;
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    }
    throw error;
  }
}


