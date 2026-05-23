import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/GlobalAuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Search } from 'lucide-react';
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Calendar, Clock, Users, User, ShoppingCart, DollarSign, Activity, Store, UserPlus, Eye, MoreHorizontal, Loader2, Plus, Package, X, ShoppingBag, UserCheck, Box, UserCircle, MapPin, CheckCircle, XCircle, ArrowUpRight, Percent, TrendingUp, Lock, Unlock, Users2, Mail, Instagram, Facebook, Music2, Globe, Heart, Trash2 } from 'lucide-react';
import { adminApi } from '@/api/adminApi';
import { format } from 'date-fns';
import { toast } from 'sonner';
import RefundRequestsPage from './RefundRequestsPage';
import { AdminEntityModals } from './components/AdminEntityModals';
import { AdminDashboardHeader } from './components/AdminDashboardHeader';
import { AdminDashboardTabs } from './components/AdminDashboardTabs';
import { AdminOverviewTab } from './components/AdminOverviewTab';
import { AdminLogisticsTab } from './components/AdminLogisticsTab';
import {
  StatsCard,
  type StatsCardProps
} from './components/AdminDashboardCharts';

// Custom tooltip for the events chart

interface DashboardAnalytics {
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


interface MonthlyMetricsData {
  month: string;
  sellerCount: number;
  productCount: number;
  buyerCount: number;
}

interface WithdrawalRequest {
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

interface FinancialMetrics {
  totalSales: number;
  totalOrders: number;
  totalCommission: number;
  totalRefunds: number;
  totalRefundRequests: number;
  pendingRefunds: number;
  netRevenue: number;
}

interface MonthlyFinancialData {
  month: string;
  sales: number;
  commission: number;
  refunds: number;
}

interface DashboardState {
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
  clients: any[];
  topShops: any[];
  providerHealth: any;
}

const NewAdminDashboard = () => {
  // All hooks must be called unconditionally at the top level
  const { isAuthenticated, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
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
  const [selectedSeller, setSelectedSeller] = useState<any | null>(null);
  const [isLoadingSeller, setIsLoadingSeller] = useState(false);

  // State for buyer details modal
  const [selectedBuyer, setSelectedBuyer] = useState<any | null>(null);
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

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await Promise.allSettled([
          adminApi.getAnalytics(),
          adminApi.getSellers(),
          adminApi.getCreators(),
          adminApi.getBuyers(),
          adminApi.getWithdrawalRequests(),
          adminApi.getMonthlyMetrics(),
          adminApi.getFinancialMetrics(),
          adminApi.getMonthlyFinancialData(),
          adminApi.getDashboardStats(),
          adminApi.getClients(),
          adminApi.getPaymentProviderBalances()
        ]);

        const [
          analyticsRes,
          sellersRes,
          creatorsRes,
          buyersRes,
          withdrawalsRes,
          monthlyRes,
          financialRes,
          statsRes,
          dashboardStatsRes,
          clientsRes,
          providerHealthRes
        ] = results;

        const analytics = analyticsRes.status === 'fulfilled' ? analyticsRes.value : null;
        const sellers = sellersRes.status === 'fulfilled' ? sellersRes.value : [];
        const creators = creatorsRes.status === 'fulfilled' ? creatorsRes.value : [];
        const buyers = buyersRes.status === 'fulfilled' ? buyersRes.value : [];
        const withdrawalRequests = withdrawalsRes.status === 'fulfilled' ? withdrawalsRes.value : [];
        const monthlyMetrics = monthlyRes.status === 'fulfilled' ? monthlyRes.value : null;
        const financialMetrics = financialRes.status === 'fulfilled' ? financialRes.value : null;
        const monthlyFinancialData = statsRes.status === 'fulfilled' ? statsRes.value : [];
        const dashboardStats = dashboardStatsRes.status === 'fulfilled' ? dashboardStatsRes.value : null;
        const clients = clientsRes.status === 'fulfilled' ? clientsRes.value : [];
        const providerHealth = providerHealthRes.status === 'fulfilled' ? providerHealthRes.value : null;

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
        } else if (Array.isArray(monthlyMetrics?.data)) {
          metricsData = monthlyMetrics.data;
        } else if (monthlyMetrics?.data?.data && Array.isArray(monthlyMetrics.data.data)) {
          metricsData = monthlyMetrics.data.data;
        }

        setDashboardState({
          analytics: safeAnalytics,
          sellers: Array.isArray(sellers) ? sellers : [],
          creators: Array.isArray(creators) ? creators : [],
          buyers: Array.isArray(buyers) ? buyers : [],
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

        // Show warning if some requests failed
        if (results.some(r => r.status === 'rejected')) {
          console.warn('[DASHBOARD] Some partial data failed to load');
          toast.warning('Dashboard loaded with some missing data');
        }
      } catch (err: any) {
        console.error('Critical error fetching dashboard data:', err);
        setError(err.message || 'Failed to initialize dashboard');
        toast.error('Failed to load dashboard data');
      } finally {
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [authLoading, isAuthenticated, dashboardReloadToken]);

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

  const formatProviderBalance = (account: any) => {
    if (!account) return 'Unavailable';
    if (account.error) return 'Check needed';
    const balance = account.available_balance ?? account.availableBalance ?? account.balance;
    if (balance === undefined || balance === null || Number.isNaN(Number(balance))) return 'Connected';
    const currency = account.currency || 'KES';
    return `${currency} ${Number(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const providerHealthAvailable = Boolean(dashboardState.providerHealth);
  const providerHealthOk = providerHealthAvailable
    && !dashboardState.providerHealth?.payin?.error
    && !dashboardState.providerHealth?.payout?.error;

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
      title: 'Creators',
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

  const MetricsTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 p-4 border border-gray-700 rounded-lg shadow-lg">
          <p className="font-medium text-white">{data.fullDate || label}</p>
          {payload.map((entry: any) => (
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
      <div className="admin-light-dashboard flex items-center justify-center min-h-screen bg-[#f8f7f2]">
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
      <div className="admin-light-dashboard flex items-center justify-center min-h-screen bg-[#f8f7f2] p-6 text-center">
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
      const response = await adminApi.getSellerById(sellerId);
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
      const response = await adminApi.updateSellerStatus(sellerId, { status: newStatus });

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
      const response = await adminApi.getBuyerById(buyerId);
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
      await adminApi.deleteUser(userId);
      toast.success(`${role.charAt(0).toUpperCase() + role.slice(1)} user deleted. History was preserved.`);

      // Refresh data
      setDashboardState(prev => ({
        ...prev,
        sellers: role === 'seller' ? prev.sellers.filter(s => String(s.user_id) !== String(userId)) : prev.sellers,
        buyers: role === 'buyer' ? prev.buyers.filter(b => String(b.user_id) !== String(userId)) : prev.buyers
      }));
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error((error as any)?.response?.data?.message || 'Failed to delete user account');
    }
  };

  const handleDeleteCreator = async (creatorId: string, creatorName?: string) => {
    if (!window.confirm(`Delete ${creatorName || 'this creator'}'s account? Their earnings and sales history will be preserved for audit.`)) {
      return;
    }

    try {
      await adminApi.deleteCreator(creatorId);
      toast.success('Creator account deleted. History was preserved.');
      setDashboardState(prev => ({
        ...prev,
        creators: prev.creators.filter(creator => String(creator.id) !== String(creatorId))
      }));
    } catch (error) {
      console.error('Error deleting creator:', error);
      toast.error((error as any)?.response?.data?.message || 'Failed to delete creator account');
    }
  };

  // Handle toggling buyer status (active/inactive)
  const handleToggleBuyerStatus = async (buyerId: string, newStatus: 'active' | 'inactive') => {
    try {
      // Call the API to update the buyer status
      const response = await adminApi.updateBuyerStatus(buyerId, { status: newStatus });

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

  // Handle withdrawal request approval/rejection
  const handleWithdrawalRequestAction = async (requestId: string, action: 'approved' | 'rejected') => {
    try {
      const response = await adminApi.updateWithdrawalRequestStatus(requestId, action);

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
    <div className="admin-light-dashboard min-h-screen bg-[#f8f7f2] text-stone-950 font-sans selection:bg-yellow-500/30 selection:text-black">
        <div className="mx-auto w-full max-w-[1760px] p-4 md:p-8 lg:p-10 space-y-8">
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
              selectedSeller={selectedSeller}
              isLoadingSeller={isLoadingSeller}
              closeSellerModal={closeSellerModal}
              selectedBuyer={selectedBuyer}
              isLoadingBuyer={isLoadingBuyer}
              closeBuyerModal={closeBuyerModal}
              safeFormatDate={safeFormatDate}
              inspectionSessionId={inspectionSessionId}
            />
            <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <AdminOverviewTab
                dashboardState={dashboardState}
                safeFormatDate={safeFormatDate}
                onShowSellers={() => setActiveTab('sellers')}
              />
            </TabsContent>

            {/* Sellers Tab */}
            <TabsContent value="sellers" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Card className="bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <CardHeader className="p-5 md:p-8 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                  <div>
                    <CardTitle className="text-2xl md:text-3xl font-black text-white tracking-tighter">Marketplace Merchants</CardTitle>
                    <CardDescription className="text-xs md:text-sm text-gray-400 font-medium">Full directory of active and pending operators</CardDescription>
                  </div>
                  <div className="relative group w-full md:w-auto">
                    <div className="absolute -inset-0.5 bg-yellow-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-hover:text-yellow-500 transition-colors" />
                    <Input
                      type="text"
                      placeholder="Filter merchants..."
                      className="pl-12 w-full md:w-[320px] lg:w-[400px] h-11 md:h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-2xl focus:border-yellow-500/50 focus:ring-yellow-500/10 transition-all font-medium text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        <tr>
                          <th className="px-5 md:px-8 py-4 md:py-6">Merchant Identity</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 hidden lg:table-cell">Communications</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 hidden xl:table-cell">Geographic Hub</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">Protocol Status</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dashboardState.sellers?.filter(s =>
                          s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.email?.toLowerCase().includes(searchQuery.toLowerCase())
                        ).map((seller) => (
                          <tr key={seller.id} className="hover:bg-white/[0.02] transition-all group">
                            <td className="px-5 md:px-8 py-4 md:py-6">
                              <div className="flex items-center gap-3 md:gap-5">
                                <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-yellow-500/30 transition-all shadow-inner">
                                  <Store className="w-4 h-4 md:w-6 md:h-6 text-gray-500 group-hover:text-yellow-500 transition-all" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm md:text-base font-black text-white tracking-tight truncate">{seller.name}</p>
                                  <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-50 truncate">ID: {String(seller.id).slice(0, 12)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6 hidden lg:table-cell">
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-gray-300">{seller.email}</p>
                                <p className="text-xs text-gray-500 font-medium tabular-nums">{seller.phone || 'NO SECURE LINE'}</p>
                              </div>
                            </td>
                            <td className="px-8 py-6 hidden xl:table-cell">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                                  <MapPin className="h-4 w-4 text-gray-400" />
                                </div>
                                <span className="text-sm font-bold text-gray-300 tracking-tight">{seller.city || 'Global Hub'}</span>
                              </div>
                            </td>
                            <td className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">
                              <Badge className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-none ${seller.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                                {seller.status}
                              </Badge>
                            </td>
                            <td className="px-5 md:px-8 py-4 md:py-6 text-right">
                              <div className="flex items-center justify-end gap-2 md:gap-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 md:h-10 px-3 md:px-4 rounded-xl border-white/10 bg-white/5 text-yellow-500 hover:bg-yellow-500 hover:text-black font-black uppercase tracking-widest text-[9px] md:text-[10px] border transition-all"
                                  onClick={() => handleViewSeller(seller.id)}
                                >
                                  <Eye className="h-3 md:h-3.5 w-3 md:w-3.5" />
                                  <span className="hidden sm:inline ml-2">Inspect</span>
                                </Button>
                            <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 md:h-10 px-3 md:px-4 rounded-xl border-white/10 bg-white/5 text-red-400 hover:bg-red-500 hover:text-white font-black uppercase tracking-widest text-[9px] md:text-[10px] border transition-all"
                                  onClick={() => handleDeleteUser(seller.user_id, 'seller')}
                                >
                                  <XCircle className="h-3 md:h-3.5 w-3 md:w-3.5" />
                                  <span className="hidden sm:inline ml-2">Delete</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
                <CardFooter className="p-8 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
                    Active Operators: <span className="text-white ml-2 tabular-nums">{dashboardState.sellers?.length || 0}</span>
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" disabled className="text-gray-600 hover:bg-white/5 rounded-xl font-bold uppercase tracking-widest text-[10px]">Prev</Button>
                    <Button variant="ghost" disabled className="text-gray-600 hover:bg-white/5 rounded-xl font-bold uppercase tracking-widest text-[10px]">Next</Button>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>

            {/* Creators Tab */}
            <TabsContent value="creators" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Card className="bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <CardHeader className="p-5 md:p-8 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                  <div>
                    <CardTitle className="text-2xl md:text-3xl font-black text-white tracking-tighter">Creator Network</CardTitle>
                    <CardDescription className="text-xs md:text-sm text-gray-400 font-medium">Creator acquisition, shop links, clicks, and earnings performance</CardDescription>
                  </div>
                  <div className="relative group w-full md:w-auto">
                    <div className="absolute -inset-0.5 bg-yellow-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-hover:text-yellow-500 transition-colors" />
                    <Input
                      type="text"
                      placeholder="Filter creators..."
                      className="pl-12 w-full md:w-[320px] lg:w-[400px] h-11 md:h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-2xl focus:border-yellow-500/50 focus:ring-yellow-500/10 transition-all font-medium text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <div className="grid grid-cols-1 gap-3 border-b border-white/5 bg-white/[0.012] p-5 md:grid-cols-4 md:p-8">
                  <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.06] p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-yellow-200/70">Creators</p>
                    <p className="mt-3 text-2xl font-black text-white tabular-nums">{dashboardState.creators.length.toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-lime-500/20 bg-lime-500/[0.06] p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-lime-200/70">Creator sales</p>
                    <p className="mt-3 text-2xl font-black text-white tabular-nums">{dashboardState.creators.reduce((sum, creator) => sum + (Number(creator.totalSales) || 0), 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200/70">Link clicks</p>
                    <p className="mt-3 text-2xl font-black text-white tabular-nums">{dashboardState.creators.reduce((sum, creator) => sum + (Number(creator.linkClicks) || 0), 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200/70">Creator earnings</p>
                    <p className="mt-3 text-2xl font-black text-white tabular-nums">KSh {dashboardState.creators.reduce((sum, creator) => sum + (Number(creator.totalIncome) || 0), 0).toLocaleString()}</p>
                  </div>
                </div>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        <tr>
                          <th className="px-5 md:px-8 py-4 md:py-6">Creator Identity</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 hidden lg:table-cell">Contact</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 text-center hidden xl:table-cell">Linked Shops</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">Performance</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 text-right">Earnings</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dashboardState.creators.filter(creator =>
                          creator.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          creator.email?.toLowerCase().includes(searchQuery.toLowerCase())
                        ).map((creator) => (
                          <tr key={creator.id} className="hover:bg-white/[0.02] transition-all group">
                            <td className="px-5 md:px-8 py-4 md:py-6">
                              <div className="flex items-center gap-3 md:gap-5">
                                <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-yellow-500/30 transition-all shadow-inner">
                                  <UserPlus className="w-4 h-4 md:w-6 md:h-6 text-gray-500 group-hover:text-yellow-500 transition-all" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm md:text-base font-black text-white tracking-tight truncate">{creator.name}</p>
                                  <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-50 truncate">CID: {String(creator.id).slice(0, 12)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6 hidden lg:table-cell">
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-gray-300">{creator.email}</p>
                                <p className="text-xs text-gray-500 font-medium tabular-nums">{creator.whatsappNumber || creator.mpesaNumber || 'NO CREATOR LINE'}</p>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-center hidden xl:table-cell">
                              <p className="text-lg font-black text-white tabular-nums">{creator.linkedShops}</p>
                              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-500">{creator.pendingRequests} pending</p>
                            </td>
                            <td className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">
                              <p className="text-sm font-black text-white tabular-nums">{creator.totalSales} sales</p>
                              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-500">{creator.linkClicks} clicks</p>
                            </td>
                            <td className="px-5 md:px-8 py-4 md:py-6 text-right">
                              <p className="text-sm md:text-lg font-black text-white tracking-tighter tabular-nums">KSh {creator.totalIncome.toLocaleString()}</p>
                              <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-50">Balance KSh {creator.balance.toLocaleString()}</p>
                            </td>
                            <td className="px-5 md:px-8 py-4 md:py-6 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCreator(creator.id, creator.name)}
                                className="h-10 w-10 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-100"
                                aria-label={`Delete ${creator.name || 'creator'} account`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
                <CardFooter className="p-8 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
                    Active Creators: <span className="text-white ml-2 tabular-nums">{dashboardState.creators.length}</span>
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" disabled className="text-gray-600 hover:bg-white/5 rounded-xl font-bold uppercase tracking-widest text-[10px]">Prev</Button>
                    <Button variant="ghost" disabled className="text-gray-600 hover:bg-white/5 rounded-xl font-bold uppercase tracking-widest text-[10px]">Next</Button>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>

            {/* Buyers Tab */}
            <TabsContent value="buyers" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Card className="bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <CardHeader className="p-5 md:p-8 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                  <div>
                    <CardTitle className="text-2xl md:text-3xl font-black text-white tracking-tighter">Engagement Database</CardTitle>
                    <CardDescription className="text-xs md:text-sm text-gray-400 font-medium">Customer behavioral records and identity tracking</CardDescription>
                  </div>
                  <div className="relative group w-full md:w-auto">
                    <div className="absolute -inset-0.5 bg-cyan-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-hover:text-cyan-500 transition-colors" />
                    <Input
                      type="text"
                      placeholder="Search intelligence..."
                      className="pl-12 w-full md:w-[320px] lg:w-[400px] h-11 md:h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-2xl focus:border-cyan-500/50 focus:ring-cyan-500/10 transition-all font-medium text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        <tr>
                          <th className="px-5 md:px-8 py-4 md:py-6">Customer Profile</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 hidden lg:table-cell">Contact Protocol</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 hidden xl:table-cell">Activation Point</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">Security</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dashboardState.buyers?.filter(b =>
                          b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.email?.toLowerCase().includes(searchQuery.toLowerCase())
                        ).map((buyer) => (
                          <tr key={buyer.id} className="hover:bg-white/[0.02] transition-all group">
                            <td className="px-5 md:px-8 py-4 md:py-6">
                              <div className="flex items-center gap-3 md:gap-5">
                                <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-cyan-500/30 transition-all shadow-inner">
                                  <User className="w-4 h-4 md:w-6 md:h-6 text-gray-500 group-hover:text-cyan-500 transition-all" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm md:text-base font-black text-white tracking-tight truncate">{buyer.name}</p>
                                  <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-50 truncate">UID: {String(buyer.id).slice(0, 12)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6 hidden lg:table-cell">
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-gray-300">{buyer.email}</p>
                                <p className="text-xs text-gray-500 font-medium tabular-nums">{buyer.phone || 'DATA MISSING'}</p>
                              </div>
                            </td>
                            <td className="px-8 py-6 hidden xl:table-cell">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                </div>
                                <span className="text-sm font-bold text-gray-300 tracking-tight">{safeFormatDate(buyer.createdAt)}</span>
                              </div>
                            </td>
                            <td className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">
                              <Badge className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-none ${buyer.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                                {buyer.status}
                              </Badge>
                            </td>
                            <td className="px-5 md:px-8 py-4 md:py-6 text-right">
                              <div className="flex items-center justify-end gap-2 md:gap-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 md:h-10 px-3 md:px-4 rounded-xl border-white/10 bg-white/5 text-cyan-500 hover:bg-cyan-500 hover:text-black font-black uppercase tracking-widest text-[9px] md:text-[10px] border transition-all"
                                  onClick={() => handleViewBuyer(buyer.id)}
                                >
                                  <Eye className="h-3 md:h-3.5 w-3 md:w-3.5" />
                                  <span className="hidden sm:inline ml-2">Insights</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 md:h-10 px-3 md:px-4 rounded-xl border-white/10 bg-white/5 text-red-400 hover:bg-red-500 hover:text-white font-black uppercase tracking-widest text-[9px] md:text-[10px] border transition-all"
                                  onClick={() => handleDeleteUser(buyer.user_id, 'buyer')}
                                >
                                  <XCircle className="h-3 md:h-3.5 w-3 md:w-3.5" />
                                  <span className="hidden sm:inline ml-2">Delete</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
                <CardFooter className="p-8 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
                    Total Users: <span className="text-white ml-2 tabular-nums">{dashboardState.buyers?.length || 0}</span>
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" disabled className="text-gray-600 hover:bg-white/5 rounded-xl font-bold uppercase tracking-widest text-[10px]">Prev</Button>
                    <Button variant="ghost" disabled className="text-gray-600 hover:bg-white/5 rounded-xl font-bold uppercase tracking-widest text-[10px]">Next</Button>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>

            {/* Withdrawals Tab */}
            <TabsContent value="withdrawals" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Card className="bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <CardHeader className="p-5 md:p-8 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                  <div>
                    <CardTitle className="text-2xl md:text-3xl font-black text-white tracking-tighter">Liquidity Requests</CardTitle>
                    <CardDescription className="text-xs md:text-sm text-gray-400 font-medium">Outbound capital movements and merchant payouts</CardDescription>
                  </div>
                  <div className="relative group w-full md:w-auto">
                    <div className="absolute -inset-0.5 bg-green-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-hover:text-green-500 transition-colors" />
                    <Input
                      type="text"
                      placeholder="Filter transactions..."
                      className="pl-12 w-full md:w-[320px] lg:w-[400px] h-11 md:h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-2xl focus:border-green-500/50 focus:ring-green-500/10 transition-all font-medium text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <div className="grid grid-cols-1 gap-3 border-b border-white/5 bg-white/[0.012] p-5 md:grid-cols-3 md:p-8">
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-200/70">Open orders</p>
                      <Activity className="h-4 w-4 text-blue-300" />
                    </div>
                    <p className="mt-3 text-2xl font-black text-white tabular-nums">{dashboardState.analytics.activeOrders?.toLocaleString() || '0'}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-blue-100/50">Paid and not closed</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200/70">Pending payouts</p>
                      <DollarSign className="h-4 w-4 text-emerald-300" />
                    </div>
                    <p className="mt-3 text-2xl font-black text-white tabular-nums">{pendingPayoutRequests.length.toLocaleString()}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-emerald-100/50">Awaiting settlement</p>
                  </div>
                  <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.06] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-yellow-200/70">Pending payout value</p>
                      <TrendingUp className="h-4 w-4 text-yellow-300" />
                    </div>
                    <p className="mt-3 text-2xl font-black text-white tabular-nums">KSh {pendingPayoutAmount.toLocaleString()}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-yellow-100/50">Capital waiting to leave</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 border-b border-white/5 bg-white/[0.015] p-5 md:grid-cols-3 md:p-8">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Provider health</p>
                    <div className="mt-3 flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${providerHealthOk ? 'bg-green-400' : 'bg-yellow-400'}`} />
                      <p className="text-sm font-black text-white">{providerHealthOk ? 'Connected' : providerHealthAvailable ? 'Check needed' : 'Loading'}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Payment provider balance/status</p>
                    <p className="mt-3 text-sm font-black text-white">{formatProviderBalance(dashboardState.providerHealth?.payin)}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">Pay-in account</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Payment provider balance/status</p>
                    <p className="mt-3 text-sm font-black text-white">{formatProviderBalance(dashboardState.providerHealth?.payout)}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">Payout account</p>
                  </div>
                </div>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        <tr>
                          <th className="px-5 md:px-8 py-4 md:py-6">Merchant Beneficiary</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 text-right sm:text-left">Capital Amount</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 hidden xl:table-cell">Provider reference</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">Protocol Status</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 text-right">Settlement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dashboardState.withdrawalRequests?.map((request) => (
                          <tr key={request.id} className="hover:bg-white/[0.02] transition-all group">
                            <td className="px-5 md:px-8 py-4 md:py-6">
                              <div className="space-y-1">
                                <p className="text-sm md:text-base font-black text-white tracking-tight">{request.sellerName}</p>
                                <p className="text-[10px] text-gray-500 font-medium italic opacity-60 truncate max-w-[150px]">{request.sellerEmail}</p>
                              </div>
                            </td>
                            <td className="px-5 md:px-8 py-4 md:py-6 text-right sm:text-left">
                              <p className="text-sm md:text-lg font-black text-white tracking-tighter tabular-nums">KSh {request.amount.toLocaleString()}</p>
                              <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-50">{safeFormatDate(request.createdAt)}</p>
                            </td>
                            <td className="px-8 py-6 hidden xl:table-cell">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                                  <DollarSign className="h-4 w-4 text-green-500" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-300 font-mono">{request.providerReference || 'Pending provider reference'}</p>
                                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-50">{request.mpesaNumber} · {request.mpesaName}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">
                              <Badge className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-none 
                              ${request.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                  request.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                                    request.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                                      'bg-blue-500/10 text-blue-400'}`}>
                                {request.status}
                              </Badge>
                            </td>
                            <td className="px-5 md:px-8 py-4 md:py-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {request.status === 'pending' ? (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-9 md:h-10 px-3 md:px-4 rounded-xl border-white/10 bg-white/5 text-green-500 hover:bg-green-500 hover:text-black font-black uppercase tracking-widest text-[9px] border transition-all"
                                      onClick={() => handleWithdrawalRequestAction(request.id, 'approved')}
                                    >
                                      <CheckCircle className="h-3 md:h-3.5 w-3 md:w-3.5" />
                                      <span className="hidden sm:inline ml-2">Approve</span>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-9 md:h-10 px-3 md:px-4 rounded-xl border-white/10 bg-white/5 text-red-400 hover:bg-red-500 hover:text-white font-black uppercase tracking-widest text-[9px] border transition-all"
                                      onClick={() => handleWithdrawalRequestAction(request.id, 'rejected')}
                                    >
                                      <XCircle className="h-3 md:h-3.5 w-3 md:w-3.5" />
                                      <span className="hidden sm:inline ml-2">Veto</span>
                                    </Button>
                                  </>
                                ) : (
                                  <span className="text-[9px] md:text-[10px] font-black text-gray-600 uppercase tracking-widest italic">
                                    {request.status}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
                <CardFooter className="p-8 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
                    Total Liquidity Flow: <span className="text-white ml-2 tabular-nums">{dashboardState.withdrawalRequests?.length || 0} Entries</span>
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" disabled className="text-gray-600 hover:bg-white/5 rounded-xl font-bold uppercase tracking-widest text-[10px]">Prev</Button>
                    <Button variant="ghost" disabled className="text-gray-600 hover:bg-white/5 rounded-xl font-bold uppercase tracking-widest text-[10px]">Next</Button>
                  </div>
                </CardFooter>
              </Card>
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
              <Card className="bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <CardHeader className="p-5 md:p-8 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                  <div>
                    <CardTitle className="text-2xl md:text-3xl font-black text-white tracking-tighter">Client Network</CardTitle>
                    <CardDescription className="text-xs md:text-sm text-gray-400 font-medium">Global mapping of customers and their associated merchants</CardDescription>
                  </div>
                  <div className="relative group w-full md:w-auto">
                    <div className="absolute -inset-0.5 bg-pink-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-hover:text-pink-500 transition-colors" />
                    <Input
                      type="text"
                      placeholder="Search relations..."
                      className="pl-12 w-full md:w-[320px] lg:w-[400px] h-11 md:h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-2xl focus:border-pink-500/50 focus:ring-pink-500/10 transition-all font-medium text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        <tr>
                          <th className="px-5 md:px-8 py-4 md:py-6">Customer Network Node</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 hidden md:table-cell">Associated Merchant</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 hidden lg:table-cell">Contact Protocol</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 text-right">Activity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {(dashboardState.clients || []).filter(c =>
                          (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.sellerName || '').toLowerCase().includes(searchQuery.toLowerCase())
                        ).map((client) => (
                          <tr key={client.id} className="hover:bg-white/[0.02] transition-all group">
                            <td className="px-5 md:px-8 py-4 md:py-6">
                              <div className="flex items-center gap-3 md:gap-5">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-pink-500/30 transition-all shadow-inner">
                                  <Users2 className="w-4 h-4 md:w-5 md:h-5 text-gray-500 group-hover:text-pink-500 transition-all" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm md:text-base font-black text-white tracking-tight truncate">{client.name}</p>
                                  <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-50 truncate">CID: {String(client.id).slice(0, 12)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 md:px-8 py-4 md:py-6 hidden md:table-cell">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-yellow-500/5 flex items-center justify-center border border-yellow-500/10">
                                  <Store className="w-3.5 h-3.5 text-yellow-500/50" />
                                </div>
                                <span className="text-sm font-bold text-gray-300 tracking-tight">{client.sellerName}</span>
                              </div>
                            </td>
                            <td className="px-5 md:px-8 py-4 md:py-6 hidden lg:table-cell">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/5 flex items-center justify-center border border-blue-500/10">
                                  <Mail className="w-3.5 h-3.5 text-blue-500/50" />
                                </div>
                                <span className="text-sm font-medium text-gray-400 italic lowercase">{client.email}</span>
                              </div>
                            </td>
                            <td className="px-5 md:px-8 py-4 md:py-6 text-right">
                              <p className="text-[10px] md:text-sm font-bold text-gray-400 tabular-nums">{safeFormatDate(client.createdAt)}</p>
                              <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mt-0.5 hidden sm:block">First Seen</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
    </div>
  );
};

export default NewAdminDashboard;

