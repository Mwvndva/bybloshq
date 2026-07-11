import type { OrderStatus, Theme } from '@/types';
import type { ProductType } from '@/types/index';



export interface SellerAnalytics {
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  totalPayout: number;
  balance: number;
  clientCount: number;
  creatorCount: number;
  creatorGeneratedSales: number;
  wishlistCount: number;
  clickCount: number;
  monthlySales: Array<{ month: string; sales: number }>;
  recentOrders?: Array<{
    id: number;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    items: Array<{
      id: number;
      product_name: string;
      quantity: number;
      price: number;
    }>;
  }>;
}



export interface ReferredSeller {
  id: number;
  shopName: string;
  referralActiveUntil: string | null;
  isActive: boolean;
  totalEarned: number;
}

export interface ReferralDashboard {
  referralCode: string | null;
  referralLink: string | null;
  totalReferralEarnings: number;
  referred: ReferredSeller[];
}

export interface RegisterSellerInput {
  fullName: string;
  shopName: string;
  email: string;
  whatsappNumber: string;
  password: string;
  confirmPassword: string;
  city?: string;
  location?: string;
  physicalAddress?: string;
  latitude?: number;
  longitude?: number;
  referralCode?: string;
  termsAccepted: boolean;
}

export interface UpdateSellerProfileInput {
  fullName?: string;
  shopName?: string;
  whatsappNumber?: string;
  city?: string;
  location?: string;
  theme?: Theme;
  physicalAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
  instagramLink?: string;
  tiktokLink?: string;
  facebookLink?: string;
  bio?: string;
  avatarUrl?: string | null;
  creatorCommissionRate?: number;
}

export interface OrdersAnalytics {
  total: number;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  revenue: number;
}

export interface OrderQueryParams {
  status?: OrderStatus;
}


