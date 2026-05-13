import type { ReactNode } from 'react';

export type SellerTabId = 'overview' | 'products' | 'orders' | 'withdrawals' | 'settings';

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

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  imageUrl?: string;
  aesthetic: string;
  createdAt: string;
  updatedAt?: string;
  sold?: number;
  status?: 'available' | 'sold';
  isSold?: boolean;
}

export interface OrderItem {
  id: number;
  product_name: string;
  quantity: number;
  price: number;
}

export interface RecentOrder {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
}

export interface AnalyticsData {
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  totalPayout: number;
  balance: number;
  clientCount: number;
  wishlistCount: number;
  clickCount: number;
  monthlySales: Array<{ month: string; sales: number }>;
  recentOrders?: RecentOrder[];
}

export interface SellerDashboardProps {
  children?: (props: {
    fetchData: () => Promise<AnalyticsData>;
  }) => ReactNode;
}

export interface SellerSettingsFormData {
  fullName: string;
  shopName: string;
  city: string;
  location: string;
  physicalAddress: string;
  latitude: number | null;
  longitude: number | null;
  instagramLink: string;
  tiktokLink: string;
  facebookLink: string;
  whatsappNumber: string;
  bio: string;
}
