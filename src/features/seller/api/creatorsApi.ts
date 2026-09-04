import apiClient from '@/infrastructure/http/apiClient';

export interface SellerCreatorRequest {
  id: number;
  creatorId: number;
  creatorName: string;
  email: string;
  whatsappNumber?: string;
  instagramLink?: string;
  tiktokLink?: string;
  message?: string;
  createdAt: string;
  status: string;
}

export interface ActiveSellerCreator {
  id: number;
  creatorId: number;
  creatorName: string;
  email: string;
  whatsappNumber?: string;
  instagramLink?: string;
  tiktokLink?: string;
  code: string;
  commissionRate: number;
  clickCount: number;
  salesCount: number;
  revenueGenerated: number;
  earningsPaid: number;
  createdAt: string;
  shopUrl: string;
}

export interface SellerCreatorsDashboardData {
  isCreatorMarketplaceEnabled: boolean;
  creatorCommissionRate: number;
  incomingRequests: SellerCreatorRequest[];
  activeCreators: ActiveSellerCreator[];
  manualInvites: Array<{
    id: number | string;
    email: string;
    status: string;
    expiresAt?: string;
    createdAt?: string;
    creatorName?: string;
    code?: string;
    commissionRate?: number;
    shopUrl?: string;
  }>;
}

export const getSellerCreatorsDashboard = async (): Promise<SellerCreatorsDashboardData> => {
  const response = await apiClient.get<{ status: string; data: SellerCreatorsDashboardData }>('/sellers/creators/dashboard');
  return response.data?.data || {
    isCreatorMarketplaceEnabled: false,
    creatorCommissionRate: 0.01,
    incomingRequests: [],
    activeCreators: [],
    manualInvites: []
  };
};

export const updateCreatorListing = async (payload: {
  isCreatorMarketplaceEnabled?: boolean;
  creatorCommissionRate?: number;
}) => {
  const response = await apiClient.patch('/sellers/creators/listing', payload);
  return response.data;
};

export const respondToCreatorRequest = async (requestId: number, action: 'accept' | 'deny') => {
  const response = await apiClient.post(`/sellers/creators/requests/${requestId}/respond`, { action });
  return response.data;
};
