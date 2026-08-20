import type { ReactNode } from 'react';

export type SellerTabId = 'overview' | 'products' | 'orders' | 'withdrawals' | 'settings';




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
  availableBalance?: number;
  pendingSettlementBalance?: number;
  withdrawalReservedBalance?: number;
  refundReservedBalance?: number;
  nextSettlementAt?: string | null;
  clientCount: number;
  creatorCount: number;
  creatorGeneratedSales: number;
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
  creatorCommissionRate: number;
}


