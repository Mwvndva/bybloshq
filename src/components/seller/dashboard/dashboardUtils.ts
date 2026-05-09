import type { AnalyticsData, Product } from './types';

export const MIN_WITHDRAWAL_AMOUNT = 50;

export const pendingOverviewStatuses = new Set([
  'SERVICE_PENDING',
  'COLLECTION_PENDING',
  'DELIVERY_PENDING'
]);

export const sellerDashboardTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'withdrawals', label: 'Withdrawals' },
  { id: 'settings', label: 'Settings' }
] as const;

export const getSellerInitials = (name?: string, fallback?: string) => {
  const source = (name || fallback || 'Shop').trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'S';
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
};

export const formatOrderStatusLabel = (status: string) => {
  return status
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};

export const getPendingStatusStyles = (status: string) => {
  switch (status) {
    case 'SERVICE_PENDING':
      return 'border-purple-200 bg-purple-50 text-purple-900';
    case 'COLLECTION_PENDING':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'DELIVERY_PENDING':
      return 'border-cyan-200 bg-cyan-50 text-cyan-900';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-900';
  }
};

export const normalizeSellerAnalytics = (productsData: Product[], analyticsData: any): AnalyticsData => {
  if (!analyticsData) {
    return {
      totalProducts: productsData.length || 0,
      totalSales: 0,
      totalRevenue: 0,
      totalPayout: 0,
      balance: 0,
      clientCount: 0,
      wishlistCount: 0,
      clickCount: 0,
      monthlySales: [],
      recentOrders: []
    };
  }

  const salesTotal = (analyticsData.monthlySales || []).reduce(
    (sum: number, monthData: { sales?: number }) => sum + (monthData.sales || 0),
    0
  );
  const totalRevenue = analyticsData.totalRevenue || salesTotal || 0;

  return {
    totalProducts: analyticsData.totalProducts,
    totalSales: analyticsData.totalSales || 0,
    totalRevenue,
    totalPayout: totalRevenue,
    balance: analyticsData.balance || 0,
    clientCount: analyticsData.clientCount || analyticsData.client_count || 0,
    wishlistCount: analyticsData.wishlistCount || analyticsData.wishlist_count || 0,
    clickCount: analyticsData.clickCount || analyticsData.click_count || analyticsData.knockCount || analyticsData.knock_count || 0,
    monthlySales: analyticsData.monthlySales || [],
    recentOrders: analyticsData.recentOrders || []
  };
};
