import type { OrderStatus } from '@/types/order';
import type { ProductType } from '@/types/index';

export type Theme = 'default' | 'black' | 'pink' | 'orange' | 'green' | 'red' | 'yellow' | 'brown';

export interface Seller {
  id: number;
  fullName: string;
  full_name?: string;
  shopName: string;
  shop_name?: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  city?: string;
  location?: string;
  hasPhysicalShop?: boolean;
  physicalAddress?: string;
  physical_address?: string;
  latitude?: number;
  longitude?: number;
  bannerImage?: string;
  banner_image?: string;
  bio?: string;
  avatarUrl?: string;
  avatar_url?: string;
  theme?: Theme;
  balance?: number;
  total_sales?: number;
  totalSales?: number;
  net_revenue?: number;
  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  instagramLink?: string;
  tiktokLink?: string;
  facebookLink?: string;
  creatorCommissionRate?: number;
  creator_commission_rate?: number;
  is_verified: boolean;
  clientCount?: number;
  client_count?: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  images?: string[];
  aesthetic: string;
  sellerId: string;
  isSold: boolean;
  status: 'available' | 'sold';
  soldAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  is_digital?: boolean;
  digital_file_path?: string;
  digital_file_name?: string;
  productType?: ProductType;
}

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

export interface WithdrawalRequest {
  id: string;
  amount: number;
  withdrawalFee?: number;
  totalDeducted?: number;
  mpesaNumber: string;
  mpesaName: string;
  status: 'processing' | 'completed' | 'failed' | 'compensation_required';
  createdAt: string;
  updatedAt?: string;
  processedAt?: string;
  processedBy?: string;
  providerReference?: string;
  mpesaReceipt?: string;
  failureReason?: string;
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
