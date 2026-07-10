import type { AnalyticsData } from './types';
import type { ProductSummary } from '@/types/view/productSummary';

export const MIN_WITHDRAWAL_AMOUNT = 50;
export const WITHDRAWAL_FEE_TIERS = [
  { min: 50, max: 1500, fee: 21, label: 'KSh 50 - KSh 1,500' },
  { min: 1501, max: 19999.99, fee: 45, label: 'KSh 1,501 - KSh 19,999' },
  { min: 20000, max: Number.POSITIVE_INFINITY, fee: 63, label: 'KSh 20,000 and above' }
] as const;

export const getWithdrawalFee = (amount: number) => {
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) return 0;
  return WITHDRAWAL_FEE_TIERS.find(({ min, max }) => amount >= min && amount <= max)?.fee || 0;
};

export const pendingOverviewStatuses = new Set([
  'PAID',
  'AWAITING_SELLER_ACTION',
  'FULFILLING',
  'READY_FOR_BUYER',
  'SERVICE_PENDING',
  'COLLECTION_PENDING',
  'DELIVERY_PENDING',
  'PROCESSING',
  'READY_FOR_COLLECTION'
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
    case 'READY_FOR_COLLECTION':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'DELIVERY_PENDING':
      return 'border-cyan-200 bg-cyan-50 text-cyan-900';
    case 'AWAITING_SELLER_ACTION':
    case 'PAID':
      return 'border-yellow-200 bg-yellow-50 text-yellow-900';
    case 'FULFILLING':
    case 'PROCESSING':
      return 'border-blue-200 bg-blue-50 text-blue-900';
    case 'READY_FOR_BUYER':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-900';
  }
};

export const normalizeSellerAnalytics = (productsData: ProductSummary[], analyticsData: unknown): AnalyticsData => {
  if (!analyticsData) {
    return {
      totalProducts: productsData.length || 0,
      totalSales: 0,
      totalRevenue: 0,
      totalPayout: 0,
      balance: 0,
      availableBalance: 0,
      pendingSettlementBalance: 0,
      withdrawalReservedBalance: 0,
      refundReservedBalance: 0,
      nextSettlementAt: null,
      clientCount: 0,
      creatorCount: 0,
      creatorGeneratedSales: 0,
      wishlistCount: 0,
      clickCount: 0,
      monthlySales: [],
      recentOrders: []
    };
  }

  const a = analyticsData as Record<string, unknown>;
  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const monthlySales = (Array.isArray(a.monthlySales) ? a.monthlySales : []) as AnalyticsData['monthlySales'];
  const salesTotal = monthlySales.reduce(
    (sum: number, monthData: { sales?: number }) => sum + (monthData.sales || 0),
    0
  );
  const totalRevenue = num(a.totalRevenue ?? salesTotal);

  return {
    totalProducts: num(a.totalProducts),
    totalSales: num(a.totalSales),
    totalRevenue,
    totalPayout: totalRevenue,
    balance: num(a.balance),
    availableBalance: num(a.availableBalance ?? a.balance),
    pendingSettlementBalance: num(a.pendingSettlementBalance),
    withdrawalReservedBalance: num(a.withdrawalReservedBalance),
    refundReservedBalance: num(a.refundReservedBalance),
    nextSettlementAt: (a.nextSettlementAt as string | null) || null,
    clientCount: num(a.clientCount || a.client_count),
    creatorCount: num(a.creatorCount || a.creator_count),
    creatorGeneratedSales: num(a.creatorGeneratedSales || a.creator_generated_sales),
    wishlistCount: num(a.wishlistCount || a.wishlist_count),
    clickCount: num(a.clickCount || a.click_count || a.knockCount || a.knock_count),
    monthlySales,
    recentOrders: (Array.isArray(a.recentOrders) ? a.recentOrders : []) as AnalyticsData['recentOrders']
  };
};


