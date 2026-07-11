export interface DashboardAnalytics {
  totalRevenue?: number;
  totalProducts?: number;
  totalSellers?: number;
  totalCreators?: number;
  totalBuyers?: number;
  totalClients?: number;
  monthlyGrowth?: {
    revenue?: number;
    products?: number;
    sellers?: number;
    buyers?: number;
    wishlists?: number;
  };
  totalWishlists?: number;
  activeOrders?: number;
  lowStockProducts?: number;
  pendingWithdrawals?: number;
  pendingCreatorRequests?: number;
  totalCreatorEarnings?: number;
  userGrowth?: Array<{ name: string; buyers: number; sellers: number }>;
  revenueTrends?: Array<{ name: string; revenue: number; orders: number }>;
  salesTrends?: Array<{ name: string; sales: number }>;
  productStatus?: Array<{ name: string; value: number }>;
  geoDistribution?: Array<{ name: string; value: number }>;
}

// ... (existing interfaces)

// ... (existing interfaces)


export interface MonthlyMetricsData {
  month: string;
  sellerCount: number;
  productCount: number;
  buyerCount: number;
}

export interface WithdrawalRequest {
  id: string;
  amount: number;
  mpesaNumber: string;
  mpesaName: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'processing' | 'failed' | string;
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  providerReference?: string | null;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
}

export interface FinancialMetrics {
  totalSales: number;
  totalOrders: number;
  totalCommission: number;
  totalRefunds: number;
  totalRefundRequests: number;
  pendingRefunds: number;
  netRevenue: number;
}

export interface MonthlyFinancialData {
  month: string;
  sales: number;
  commission: number;
  refunds: number;
}

export interface DashboardState {
  analytics: DashboardAnalytics;
  sellers: Array<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    status: string;
    phone?: string;
    city: string;
    location: string;
    createdAt: string;
  }>;
  creators: Array<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    mpesaNumber: string;
    whatsappNumber: string;
    instagramLink: string;
    tiktokLink: string;
    balance: number;
    totalSales: number;
    totalEarnings: number;
    totalReferralEarnings: number;
    totalIncome: number;
    linkedShops: number;
    linkClicks: number;
    pendingRequests: number;
    status: string;
    createdAt: string;
  }>;
  buyers: Array<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    phone?: string;
    status: string;
    city: string;
    location: string;
    createdAt: string;
  }>;
  withdrawalRequests: WithdrawalRequest[];
  monthlyMetrics: MonthlyMetricsData[];
  financialMetrics: FinancialMetrics;
  monthlyFinancialData: MonthlyFinancialData[];
  clients: unknown[];
  topShops: unknown[];
  providerHealth: unknown;
}
