import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/features/auth/contexts';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Search, Calendar, Clock, Users, User, ShoppingCart, DollarSign, Activity, Store, UserPlus, Eye, MoreHorizontal, Loader2, Plus, Package, X, ShoppingBag, UserCheck, Box, UserCircle, MapPin, CheckCircle, XCircle, ArrowUpRight, Percent, TrendingUp, Lock, Unlock, Users2, Mail, Instagram, Facebook, Music2, Globe, Heart, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useGetBuyerByIdMutation, useDeleteUserMutation, useDeleteCreatorMutation, useUpdateBuyerStatusMutation, useGetSellerByIdMutation, useUpdateSellerStatusMutation, useUpdateWithdrawalRequestStatusMutation } from '@/hooks/admin/mutations/useAdminMutations';
import {
  useAdminAnalyticsQuery,
  useAdminSellersQuery,
  useAdminCreatorsQuery,
  useAdminBuyersQuery,
  useAdminWithdrawalsQuery,
  useAdminMonthlyMetricsQuery,
  useAdminFinancialsQuery,
  useAdminMonthlyFinancialDataQuery,
  useAdminDashboardStatsQuery,
  useAdminClientsQuery,
  useAdminBalancesQuery
} from '@/hooks/admin/queries/useAdminQueries';
import RefundRequestsPage from './RefundRequestsPage';
import { AdminEntityModals } from './components/AdminEntityModals';
import { AdminDashboardHeader } from './components/AdminDashboardHeader';
import { AdminDashboardTabs } from './components/AdminDashboardTabs';
import { AdminOverviewTab } from './components/AdminOverviewTab';
import { AdminLogisticsTab } from './components/AdminLogisticsTab';
import { AdminSellersTab } from './components/AdminSellersTab';
import { AdminCreatorsTab } from './components/AdminCreatorsTab';
import { AdminBuyersTab } from './components/AdminBuyersTab';
import { AdminWithdrawalsTab } from './components/AdminWithdrawalsTab';
import { AdminClientsTab } from './components/AdminClientsTab';
import {
  StatsCard,
  type StatsCardProps
} from './components/AdminDashboardCharts';

// Custom tooltip for the events chart

import type { DashboardAnalytics, MonthlyMetricsData, WithdrawalRequest, FinancialMetrics, MonthlyFinancialData, DashboardState } from './adminDashboardTypes';

const NewAdminDashboard = () => {
  // All hooks must be called unconditionally at the top level
  const { isAuthenticated, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();

  const getBuyerByIdMutation = useGetBuyerByIdMutation();
  const deleteUserMutation = useDeleteUserMutation();
  const deleteCreatorMutation = useDeleteCreatorMutation();
  const updateBuyerStatusMutation = useUpdateBuyerStatusMutation();
  const getSellerByIdMutation = useGetSellerByIdMutation();
  const updateSellerStatusMutation = useUpdateSellerStatusMutation();
  const updateWithdrawalRequestStatusMutation = useUpdateWithdrawalRequestStatusMutation();

  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardReloadToken, setDashboardReloadToken] = useState(0);
  const inspectionSessionId = useMemo(() => {
    const bytes = new Uint32Array(2);
    globalThis.crypto?.getRandomValues?.(bytes);
    return Array.from(bytes).map(value => value.toString(36)).join('').toUpperCase() || String(Date.now());
  }, []);

  // Initialize state for dashboard data with proper typing
  // State for ticket buyers modal
  const [error, setError] = useState<string | null>(null);

  // State for seller details modal
  const [selectedSeller, setSelectedSeller] = useState<unknown | null>(null);
  const [isLoadingSeller, setIsLoadingSeller] = useState(false);

  // State for buyer details modal
  const [selectedBuyer, setSelectedBuyer] = useState<unknown | null>(null);
  const [isLoadingBuyer, setIsLoadingBuyer] = useState(false);

  const [dashboardState, setDashboardState] = React.useState<DashboardState>({
    analytics: {
      totalRevenue: 0,
      totalProducts: 0,
      totalSellers: 0,
      totalBuyers: 0,
      monthlyGrowth: {
        revenue: 0,
        products: 0,
        sellers: 0,
        buyers: 0
      }
    },
    sellers: [],
    creators: [],
    buyers: [],
    withdrawalRequests: [],
    monthlyMetrics: [],
    financialMetrics: {
      totalSales: 0,
      totalOrders: 0,
      totalCommission: 0,
      totalRefunds: 0,
      totalRefundRequests: 0,
      pendingRefunds: 0,
      netRevenue: 0
    },
    monthlyFinancialData: [],
    clients: [],
    topShops: [],
    providerHealth: null
  });

  const isEnabled = isAuthenticated && !authLoading;
  const analyticsQuery = useAdminAnalyticsQuery(isEnabled);
  const sellersQuery = useAdminSellersQuery(isEnabled);
  const creatorsQuery = useAdminCreatorsQuery(isEnabled);
  const buyersQuery = useAdminBuyersQuery(isEnabled);
  const withdrawalsQuery = useAdminWithdrawalsQuery(isEnabled);
  const monthlyMetricsQuery = useAdminMonthlyMetricsQuery(isEnabled);
  const financialsQuery = useAdminFinancialsQuery(isEnabled);
  const monthlyFinancialDataQuery = useAdminMonthlyFinancialDataQuery(isEnabled);
  const dashboardStatsQuery = useAdminDashboardStatsQuery(isEnabled);
  const clientsQuery = useAdminClientsQuery(isEnabled);
  const balancesQuery = useAdminBalancesQuery(isEnabled);

  const queryClient = useQueryClient();

  const refetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.allSettled([
      analyticsQuery.refetch(),
      sellersQuery.refetch(),
      creatorsQuery.refetch(),
      buyersQuery.refetch(),
      withdrawalsQuery.refetch(),
      monthlyMetricsQuery.refetch(),
      financialsQuery.refetch(),
      monthlyFinancialDataQuery.refetch(),
      dashboardStatsQuery.refetch(),
      clientsQuery.refetch(),
      balancesQuery.refetch()
    ]);
    setIsLoading(false);
  }, [
    analyticsQuery,
    sellersQuery,
    creatorsQuery,
    buyersQuery,
    withdrawalsQuery,
    monthlyMetricsQuery,
    financialsQuery,
    monthlyFinancialDataQuery,
    dashboardStatsQuery,
    clientsQuery,
    balancesQuery
  ]);

  useEffect(() => {
    if (!isEnabled) return;

    const fetchDashboardData = () => {
      setIsLoading(true);
      setError(null);
      try {
        const analytics = analyticsQuery.data || null;
        const sellers = sellersQuery.data || [];
        const creators = creatorsQuery.data || [];
        const buyers = buyersQuery.data || [];
        const withdrawalRequests = withdrawalsQuery.data || [];
        const monthlyMetrics = monthlyMetricsQuery.data || null;
        const financialMetrics = financialsQuery.data || null;
        const monthlyFinancialData = monthlyFinancialDataQuery.data || [];
        const dashboardStats = dashboardStatsQuery.data || null;
        const clients = clientsQuery.data || [];
        const providerHealth = balancesQuery.data || null;

        const totalSellersCount = Array.isArray(sellers) ? sellers.length : 0;
        const totalCreatorsCount = Array.isArray(creators) ? creators.length : 0;
        const totalBuyersCount = Array.isArray(buyers) ? buyers.length : 0;

        const safeAnalytics: DashboardAnalytics = {
          totalRevenue: financialMetrics?.totalSales || 0,
          totalProducts: dashboardStats?.totalProducts || 0,
          totalSellers: dashboardStats?.totalSellers || totalSellersCount,
          totalCreators: dashboardStats?.totalCreators || totalCreatorsCount,
          totalBuyers: dashboardStats?.totalBuyers || totalBuyersCount,
          totalClients: dashboardStats?.totalClients || 0,
          totalWishlists: dashboardStats?.totalWishlists || 0,
          activeOrders: dashboardStats?.activeOrders || 0,
          lowStockProducts: dashboardStats?.lowStockProducts || 0,
          pendingWithdrawals: dashboardStats?.pendingWithdrawals || 0,
          pendingCreatorRequests: dashboardStats?.pendingCreatorRequests || 0,
          totalCreatorEarnings: dashboardStats?.totalCreatorEarnings || 0,
          userGrowth: analytics?.userGrowth || [],
          revenueTrends: analytics?.revenueTrends || [],
          salesTrends: analytics?.salesTrends || [],
          productStatus: analytics?.productStatus || [],
          geoDistribution: analytics?.geoDistribution || [],
          monthlyGrowth: {
            revenue: analytics?.monthlyGrowth?.revenue || 0,
            products: analytics?.monthlyGrowth?.products || 0,
            sellers: analytics?.monthlyGrowth?.sellers || 0,
            buyers: analytics?.monthlyGrowth?.buyers || 0
          }
        };

        let metricsData = [];
        if (Array.isArray(monthlyMetrics)) {
          metricsData = monthlyMetrics;
        } else if (Array.isArray((monthlyMetrics as { data?: unknown })?.data)) {
          metricsData = (monthlyMetrics as { data: unknown[] }).data as MonthlyMetricsData[];
        } else if ((monthlyMetrics as { data?: { data?: unknown } })?.data?.data && Array.isArray((monthlyMetrics as { data: { data: unknown[] } }).data.data)) {
          metricsData = (monthlyMetrics as { data: { data: MonthlyMetricsData[] } }).data.data;
        }

        setDashboardState({
          analytics: safeAnalytics,
          sellers: Array.isArray(sellers) ? sellers : [],
          creators: Array.isArray(creators) ? creators : [],
          buyers: Array.isArray(buyers) ? (buyers as DashboardState['buyers']) : [],
          withdrawalRequests: Array.isArray(withdrawalRequests) ? (withdrawalRequests as WithdrawalRequest[]) : [],
          monthlyMetrics: metricsData,
          financialMetrics: financialMetrics || {
            totalSales: 0,
            totalOrders: 0,
            totalCommission: 0,
            totalRefunds: 0,
            totalRefundRequests: 0,
            pendingRefunds: 0,
            netRevenue: 0
          },
          monthlyFinancialData: Array.isArray(monthlyFinancialData) ? monthlyFinancialData : [],
          clients: Array.isArray(clients) ? clients : [],
          topShops: dashboardStats?.topShops || [],
          providerHealth
        });

      } catch (err: unknown) {
        const error = err as Error;
        console.error('Critical error fetching dashboard data:', error);
        setError(error.message || 'Failed to initialize dashboard');
        toast.error('Failed to load dashboard data');
      } finally {
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [
    isEnabled,
    analyticsQuery.data,
    sellersQuery.data,
    creatorsQuery.data,
    buyersQuery.data,
    withdrawalsQuery.data,
    monthlyMetricsQuery.data,
    financialsQuery.data,
    monthlyFinancialDataQuery.data,
    dashboardStatsQuery.data,
    clientsQuery.data,
    balancesQuery.data
  ]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/admin/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const shouldShowTrend = (trend: number) => {
    return trend !== 0 || dashboardState.analytics.monthlyGrowth?.revenue !== 0;
  };

  const safeFormatDate = (dateString: string | null | undefined, formatStr: string = 'MMM d, yyyy') => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return format(date, formatStr);
    } catch (error) {
      return 'N/A';
    }
  };

  const formatProviderBalance = (account: unknown) => {
    if (!account) return 'Unavailable';
    const acc = account as Record<string, unknown>;
    if (acc.error) return 'Check needed';
    const balance = acc.available_balance ?? acc.availableBalance ?? acc.balance;
    if (balance === undefined || balance === null || Number.isNaN(Number(balance))) return 'Connected';
    const currency = acc.currency || 'KES';
    return `${currency} ${Number(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const providerHealth = dashboardState.providerHealth as {
    payin?: Record<string, unknown>;
    payout?: Record<string, unknown>;
  } | null;
  const providerHealthAvailable = Boolean(providerHealth);
  const providerHealthOk = providerHealthAvailable
    && !providerHealth?.payin?.error
    && !providerHealth?.payout?.error;

  const statsCards: StatsCardProps[] = [
    {
      title: 'Products',
      value: dashboardState.analytics.totalProducts.toLocaleString(),
      icon: <Package className="h-4 w-4 text-orange-500" />,
      description: `${dashboardState.analytics.lowStockProducts || 0} low stock`,
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.products ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.products ?? 0
        : null
    },
    {
      title: 'Sellers',
      value: dashboardState.analytics.totalSellers?.toLocaleString() || '0',
      icon: <ShoppingCart className="h-4 w-4 text-purple-500" />,
      description: 'Active sellers',
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.sellers ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.sellers ?? 0
        : null
    },
    {
      title: 'Ambassadors',
      value: dashboardState.analytics.totalCreators?.toLocaleString() || '0',
      icon: <UserPlus className="h-4 w-4 text-yellow-500" />,
      description: `${dashboardState.analytics.pendingCreatorRequests || 0} pending requests`,
      trend: null
    },
    {
      title: 'Buyers',
      value: dashboardState.analytics.totalBuyers?.toLocaleString() || '0',
      icon: <UserCircle className="h-4 w-4 text-cyan-500" />,
      description: 'Registered buyers',
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.buyers ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.buyers ?? 0
        : null
    },
    {
      title: 'Sales',
      value: `KSh ${dashboardState.financialMetrics.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign className="h-4 w-4 text-green-600" />,
      description: `${dashboardState.financialMetrics.totalOrders} orders`,
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.revenue ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.revenue ?? 0
        : null
    },
    {
      title: 'Commission',
      value: `KSh ${dashboardState.financialMetrics.totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign className="h-4 w-4 text-yellow-600" />,
      description: 'Platform earnings',
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.revenue ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.revenue ?? 0
        : null
    },
    {
      title: 'Refunds',
      value: `KSh ${dashboardState.financialMetrics.totalRefunds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign className="h-4 w-4 text-red-600" />,
      description: `${dashboardState.financialMetrics.totalRefundRequests} completed`,
      trend: null
    },
    {
      title: 'Open Orders',
      value: dashboardState.analytics.activeOrders?.toLocaleString() || '0',
      icon: <Activity className="h-4 w-4 text-blue-500" />,
      description: 'Paid but not closed',
      trend: null
    },
    {
      title: 'Pending Payouts',
      value: dashboardState.analytics.pendingWithdrawals?.toLocaleString() || '0',
      icon: <Users className="h-4 w-4 text-blue-400" />,
      description: `${dashboardState.analytics.totalClients?.toLocaleString() || '0'} paying clients`,
      trend: null
    }
  ];

  const pendingPayoutRequests = useMemo(() => (
    dashboardState.withdrawalRequests.filter(request =>
      !['completed', 'failed', 'rejected'].includes(String(request.status).toLowerCase())
    )
  ), [dashboardState.withdrawalRequests]);

  const pendingPayoutAmount = useMemo(() => (
    pendingPayoutRequests.reduce((sum, request) => sum + (Number(request.amount) || 0), 0)
  ), [pendingPayoutRequests]);

  const metricsData = useMemo(() => {
    if (!dashboardState.monthlyMetrics?.length) {
      return [];
    }

    try {
      return dashboardState.monthlyMetrics.map(metric => {
        const date = new Date(metric.month);
        if (isNaN(date.getTime())) {
          return null;
        }

        return {
          name: date.toLocaleString('default', { month: 'short' }),
          fullDate: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
          sellers: Number(metric.sellerCount) || 0,
          products: Number(metric.productCount) || 0,
          buyers: Number(metric.buyerCount) || 0
        };
      }).filter(Boolean);
    } catch (error) {
      return [];
    }
  }, [dashboardState.monthlyMetrics]);

  const MetricsTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string; dataKey?: string; payload?: { fullDate?: string } }>; label?: string }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 p-4 border border-gray-700 rounded-lg shadow-lg">
          <p className="font-medium text-white">{data?.fullDate || label}</p>
          {payload.map((entry: { name: string; value: number; color?: string; dataKey?: string }) => (
            <p key={entry.dataKey} className="text-sm text-gray-300 mt-1">
              <span style={{ color: entry.color }}>
                {entry.dataKey === 'sellers' ? (
                  <UserCheck className="w-3 h-3 inline mr-1" />
                ) : entry.dataKey === 'products' ? (
                  <Package className="w-3 h-3 inline mr-1" />
                ) : entry.dataKey === 'buyers' ? (
                  <UserCircle className="w-3 h-3 inline mr-1" />
                ) : null}
                {entry.dataKey.charAt(0).toUpperCase() + entry.dataKey.slice(1)}:
              </span>{' '}
              {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };


  if (authLoading || !isInitialized) {
    return (
      <div className="admin-light-dashboard flex min-h-[100svh] items-center justify-center overflow-x-hidden bg-[#f8f7f2]">
        <div className="flex flex-col items-center gap-4 rounded-full border border-stone-200 bg-white px-6 py-4 shadow-[0_18px_45px_rgba(17,17,17,0.08)]">
          <Spinner className="h-12 w-12 text-yellow-500" />
          <p className="text-stone-600 font-semibold text-sm animate-pulse">Initializing admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate('/admin/login', { replace: true });
    return null;
  }

  if (error) {
    return (
      <div className="admin-light-dashboard flex min-h-[100svh] items-center justify-center overflow-x-hidden bg-[#f8f7f2] p-4 text-center sm:p-6">
        <div className="max-w-md space-y-6 rounded-3xl border border-stone-200 bg-white p-8 shadow-[0_18px_45px_rgba(17,17,17,0.08)]">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto border border-red-100">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-stone-950 tracking-tight">System error</h2>
            <p className="text-stone-600 font-medium">{error}</p>
          </div>
          <Button
            onClick={() => {
              setError(null);
              setIsInitialized(false);
              setDashboardReloadToken(token => token + 1);
            }}
            className="w-full h-12 bg-yellow-400 text-black font-semibold rounded-2xl hover:bg-yellow-300 transition-all"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const handleViewSeller = async (sellerId: string) => {
    try {
      setIsLoadingSeller(true);
      const response = await getSellerByIdMutation.mutateAsync(sellerId);
      setSelectedSeller(response);
    } catch (error) {
      toast.error('Failed to load seller details');
    } finally {
      setIsLoadingSeller(false);
    }
  };

  const closeSellerModal = () => {
    setSelectedSeller(null);
  };

  const handleToggleSellerStatus = async (sellerId: string, newStatus: 'active' | 'inactive') => {
    try {
      const response = await updateSellerStatusMutation.mutateAsync({ sellerId, status: newStatus }) as { data: { status: string } };

      if (response.data.status === 'success') {
        setDashboardState(prevState => ({
          ...prevState,
          sellers: prevState.sellers.map(seller =>
            seller.id === sellerId
              ? { ...seller, status: newStatus }
              : seller
          )
        }));

        // Show success message
        toast.success(`Seller has been ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      }
    } catch (error) {
      console.error('Error updating seller status:', error);
      toast.error('Failed to update seller status');
    }
  };

  // Handle viewing buyer details
  const handleViewBuyer = async (buyerId: string) => {
    try {
      setIsLoadingBuyer(true);
      const response = await getBuyerByIdMutation.mutateAsync(buyerId);
      setSelectedBuyer(response);
    } catch (error) {
      console.error('Error fetching buyer details:', error);
      toast.error('Failed to load buyer details');
    } finally {
      setIsLoadingBuyer(false);
    }
  };

  // Close buyer details modal
  const closeBuyerModal = () => {
    setSelectedBuyer(null);
  };

  // Handle deleting/blocking user
  const handleDeleteUser = async (userId: string | undefined, role: 'seller' | 'buyer') => {
    if (!userId) {
      toast.error(`This ${role} is already detached from a login user`);
      return;
    }

    if (!window.confirm(`Delete this ${role}'s login account? Financial history and order records will be preserved for audit.`)) {
      return;
    }

    try {
      await deleteUserMutation.mutateAsync(userId);
      toast.success(`${role.charAt(0).toUpperCase() + role.slice(1)} user deleted. History was preserved.`);

      // Refresh data
      setDashboardState(prev => ({
        ...prev,
        sellers: role === 'seller' ? prev.sellers.filter(s => String(s.user_id) !== String(userId)) : prev.sellers,
        buyers: role === 'buyer' ? prev.buyers.filter(b => String(b.user_id) !== String(userId)) : prev.buyers
      }));
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete user account');
    }
  };

  const handleDeleteCreator = async (creatorId: string, creatorName?: string) => {
    if (!window.confirm(`Delete ${creatorName || 'this ambassador'}'s account? Their earnings and sales history will be preserved for audit.`)) {
      return;
    }

    try {
      await deleteCreatorMutation.mutateAsync(creatorId);
      toast.success('Ambassador account deleted. History was preserved.');
      setDashboardState(prev => ({
        ...prev,
        creators: prev.creators.filter(creator => String(creator.id) !== String(creatorId))
      }));
    } catch (error) {
      console.error('Error deleting creator:', error);
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete ambassador account');
    }
  };

  // Handle toggling buyer status (active/inactive)
  const handleToggleBuyerStatus = async (buyerId: string, newStatus: 'active' | 'inactive') => {
    try {
      // Call the API to update the buyer status
      const response = await updateBuyerStatusMutation.mutateAsync({ buyerId, status: newStatus });

      if (response.data.status === 'success') {
        // Update the UI to reflect the new status
        setDashboardState(prevState => ({
          ...prevState,
          buyers: prevState.buyers.map(buyer =>
            buyer.id === buyerId
               ? { ...buyer, status: newStatus }
              : buyer
          )
        }));

        // Show success message
        toast.success(`Buyer has been ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      }
    } catch (error) {
      console.error('Error updating buyer status:', error);
      toast.error('Failed to update buyer status');
    }
  };

  const handleWithdrawalRequestAction = async (requestId: string, action: 'approved' | 'rejected') => {
    try {
      const apiAction = action === 'approved' ? 'approve' : 'deny';
      const response = await updateWithdrawalRequestStatusMutation.mutateAsync({ requestId, action: apiAction }) as { data: { status: string } };

      if (response.data.status === 'success') {
        // Update the UI to reflect the new status
        setDashboardState(prevState => ({
          ...prevState,
          withdrawalRequests: prevState.withdrawalRequests.map(request =>
            request.id === requestId
              ? {
                ...request,
                status: action,
                processedAt: new Date().toISOString(),
                processedBy: 'Admin' // You might want to get the actual admin name
              }
              : request
          )
        }));

        // Show success message
        toast.success(`Withdrawal request has been ${action}`);
      }
    } catch (error) {
      console.error('Error updating withdrawal request status:', error);
      toast.error('Failed to update withdrawal request status');
    }
  };

  // Loading and error states are now handled at the top of the component

  // Accessibility labels and aria roles were missing on modals

  return (
    <div className="admin-light-dashboard min-h-[100svh] overflow-x-hidden bg-[#f8f7f2] text-stone-950 font-sans selection:bg-yellow-500/30 selection:text-black">
        <div className="mx-auto w-full max-w-[1760px] p-3 sm:p-5 md:p-8 lg:p-10 space-y-6 sm:space-y-8">
          <AdminDashboardHeader />

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statsCards.map((stat) => (
              <StatsCard key={stat.title} {...stat} />
            ))}
          </div>

          {/* Navigation & Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <AdminDashboardTabs />

            <AdminEntityModals
              selectedSeller={selectedSeller as Record<string, unknown> | null}
              isLoadingSeller={isLoadingSeller}
              closeSellerModal={closeSellerModal}
              selectedBuyer={selectedBuyer as Record<string, unknown> | null}
              isLoadingBuyer={isLoadingBuyer}
              closeBuyerModal={closeBuyerModal}
              safeFormatDate={safeFormatDate}
              inspectionSessionId={inspectionSessionId}
            />
            <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <AdminOverviewTab
                dashboardState={{
                  analytics: dashboardState.analytics as unknown as Record<string, unknown>,
                  topShops: dashboardState.topShops as Record<string, unknown>[],
                  sellers: dashboardState.sellers as unknown as Record<string, unknown>[],
                }}
                safeFormatDate={safeFormatDate}
                onShowSellers={() => setActiveTab('sellers')}
              />
            </TabsContent>

            {/* Sellers Tab */}
            <TabsContent value="sellers" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <AdminSellersTab
                sellers={dashboardState.sellers}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onView={handleViewSeller}
                onDelete={handleDeleteUser}
              />
            </TabsContent>

            {/* Creators Tab */}
            <TabsContent value="creators" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <AdminCreatorsTab
                creators={dashboardState.creators}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onDelete={handleDeleteCreator}
              />
            </TabsContent>

            {/* Buyers Tab */}
            <TabsContent value="buyers" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <AdminBuyersTab
                buyers={dashboardState.buyers}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onView={handleViewBuyer}
                onDelete={handleDeleteUser}
                formatDate={safeFormatDate}
              />
            </TabsContent>

            {/* Withdrawals Tab */}
            <TabsContent value="withdrawals" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <AdminWithdrawalsTab
                withdrawalRequests={dashboardState.withdrawalRequests}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                activeOrders={dashboardState.analytics.activeOrders}
                pendingPayoutCount={pendingPayoutRequests.length}
                pendingPayoutAmount={pendingPayoutAmount}
                providerHealth={providerHealth}
                providerHealthOk={providerHealthOk}
                providerHealthAvailable={providerHealthAvailable}
                formatProviderBalance={formatProviderBalance}
                formatDate={safeFormatDate}
                onAction={handleWithdrawalRequestAction}
              />
            </TabsContent>

            <TabsContent value="logistics" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <AdminLogisticsTab />
            </TabsContent>

            {/* Refunds Tab */}
            <TabsContent value="refunds" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                <RefundRequestsPage />
              </div>
            </TabsContent>

            {/* Clients Tab */}
            <TabsContent value="clients" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <AdminClientsTab
                clients={dashboardState.clients}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                formatDate={safeFormatDate}
              />
            </TabsContent>
          </Tabs>
        </div>
    </div>
  );
};

export default NewAdminDashboard;



