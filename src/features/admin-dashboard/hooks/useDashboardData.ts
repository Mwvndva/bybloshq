/**
 * useDashboardData.ts
 *
 * Extracted from NewAdminDashboard.tsx.
 * Encapsulates all data-fetching and state for the Admin Dashboard.
 * Using this hook prevents the entire dashboard from re-rendering when
 * only one data slice changes (e.g., a withdrawal approval).
 *
 * Usage: const { analytics, sellers, buyers, withdrawals, refresh } = useDashboardData();
 */
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/api/adminApi';
import { toast } from 'sonner';

// ── Types (extracted from NewDashboardPage.tsx) ────────────────────────────

export interface DashboardAnalytics {
    totalRevenue?: number;
    totalProducts?: number;
    totalSellers?: number;
    totalBuyers?: number;
    totalClients?: number;
    totalWishlists?: number;
    monthlyGrowth?: {
        revenue?: number;
        products?: number;
        sellers?: number;
        buyers?: number;
    };
    userGrowth?: Array<{ name: string; buyers: number; sellers: number }>;
    revenueTrends?: Array<{ name: string; revenue: number; orders: number }>;
    salesTrends?: Array<{ name: string; sales: number }>;
    productStatus?: Array<{ name: string; value: number }>;
    geoDistribution?: Array<{ name: string; value: number }>;
}

export interface WithdrawalRequest {
    id: string;
    amount: number;
    mpesaNumber: string;
    mpesaName: string;
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    sellerId: string;
    sellerName: string;
    sellerEmail: string;
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

interface DashboardData {
    analytics: DashboardAnalytics;
    sellers: any[];
    buyers: any[];
    withdrawalRequests: WithdrawalRequest[];
    monthlyMetrics: any[];
    financialMetrics: FinancialMetrics;
    monthlyFinancialData: any[];
    clients: any[];
    topShops: any[];
}

const EMPTY_FINANCIAL: FinancialMetrics = {
    totalSales: 0, totalOrders: 0, totalCommission: 0,
    totalRefunds: 0, totalRefundRequests: 0, pendingRefunds: 0, netRevenue: 0,
};

const EMPTY_DATA: DashboardData = {
    analytics: {
        totalRevenue: 0, totalProducts: 0, totalSellers: 0, totalBuyers: 0,
        monthlyGrowth: { revenue: 0, products: 0, sellers: 0, buyers: 0 }
    },
    sellers: [], buyers: [], withdrawalRequests: [], monthlyMetrics: [],
    financialMetrics: EMPTY_FINANCIAL, monthlyFinancialData: [], clients: [], topShops: [],
};

// ── Hook ────────────────────────────────────────────────────────────────────

export function useDashboardData(isAuthenticated: boolean, authLoading: boolean) {
    const [data, setData] = useState<DashboardData>(EMPTY_DATA);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAll = useCallback(async () => {
        if (authLoading || !isAuthenticated) return;

        setIsLoading(true);
        setError(null);

        try {
            const results = await Promise.allSettled([
                adminApi.getAnalytics(),
                adminApi.getSellers(),
                adminApi.getBuyers(),
                adminApi.getWithdrawalRequests(),
                adminApi.getMonthlyMetrics(),
                adminApi.getFinancialMetrics(),
                adminApi.getMonthlyFinancialData(),
                adminApi.getDashboardStats(),
                adminApi.getClients(),
            ]);

            const [
                analyticsRes, sellersRes, buyersRes, withdrawalsRes, monthlyRes,
                financialRes, statsRes, dashboardStatsRes, clientsRes,
            ] = results;

            const get = <T>(res: PromiseSettledResult<T>, fallback: T): T =>
                res.status === 'fulfilled' ? res.value : fallback;

            const analytics = get(analyticsRes, null);
            const sellers = get(sellersRes, []);
            const buyers = get(buyersRes, []);
            const withdrawals = get(withdrawalsRes, []);
            const monthlyMet = get(monthlyRes, null);
            const financial = get(financialRes, null);
            const monthlyFin = get(statsRes, []);
            const dashStats = get(dashboardStatsRes, null);
            const clients = get(clientsRes, []);

            // Normalise monthlyMetrics (handle wrapped vs unwrapped API responses)
            let metricsData: any[] = [];
            if (Array.isArray(monthlyMet)) metricsData = monthlyMet;
            else if (Array.isArray(monthlyMet?.data)) metricsData = monthlyMet.data;
            else if (Array.isArray(monthlyMet?.data?.data)) metricsData = monthlyMet.data.data;

            setData({
                analytics: {
                    totalRevenue: financial?.totalSales || 0,
                    totalProducts: dashStats?.totalProducts || 0,
                    totalSellers: dashStats?.totalSellers || (Array.isArray(sellers) ? sellers.length : 0),
                    totalBuyers: dashStats?.totalBuyers || (Array.isArray(buyers) ? buyers.length : 0),
                    totalClients: dashStats?.totalClients || 0,
                    totalWishlists: dashStats?.totalWishlists || 0,
                    userGrowth: analytics?.userGrowth || [],
                    revenueTrends: analytics?.revenueTrends || [],
                    salesTrends: analytics?.salesTrends || [],
                    productStatus: analytics?.productStatus || [],
                    geoDistribution: analytics?.geoDistribution || [],
                    monthlyGrowth: {
                        revenue: analytics?.monthlyGrowth?.revenue || 0,
                        products: analytics?.monthlyGrowth?.products || 0,
                        sellers: analytics?.monthlyGrowth?.sellers || 0,
                        buyers: analytics?.monthlyGrowth?.buyers || 0,
                    },
                },
                sellers: Array.isArray(sellers) ? sellers : [],
                buyers: Array.isArray(buyers) ? buyers : [],
                withdrawalRequests: Array.isArray(withdrawals) ? withdrawals : [],
                monthlyMetrics: metricsData,
                financialMetrics: financial || EMPTY_FINANCIAL,
                monthlyFinancialData: Array.isArray(monthlyFin) ? monthlyFin : [],
                clients: Array.isArray(clients) ? clients : [],
                topShops: dashStats?.topShops || [],
            });

            if (results.some(r => r.status === 'rejected')) {
                toast.warning('Dashboard loaded with some missing data');
            }
        } catch (err: any) {
            console.error('[useDashboardData] Critical error:', err);
            setError(err.message || 'Failed to initialize dashboard');
            toast.error('Failed to load dashboard data');
        } finally {
            setIsInitialized(true);
            setIsLoading(false);
        }
    }, [isAuthenticated, authLoading]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    return { data, isLoading, isInitialized, error, refresh: fetchAll };
}
