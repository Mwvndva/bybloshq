import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/GlobalAuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Search } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Clock, Users, Ticket, User, ShoppingCart, DollarSign, Activity, Store, UserPlus, Eye, MoreHorizontal, Loader2, Plus, Package, X, ShoppingBag, UserCheck, Box, Shield, UserCircle, MapPin, CheckCircle, XCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { adminApi } from '@/api/adminApi';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Lock, Unlock } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/utils';
import RefundRequestsPage from './RefundRequestsPage';

// Custom tooltip for the events chart

// Types
interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  trend: number | null;
}


interface DashboardAnalytics {
  totalRevenue?: number;
  totalProducts?: number;
  totalSellers?: number;
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
  userGrowth?: Array<{ name: string; buyers: number; sellers: number }>;
  revenueTrends?: Array<{ name: string; revenue: number; orders: number }>;
  salesTrends?: Array<{ name: string; sales: number }>;
  productStatus?: Array<{ name: string; value: number }>;
  geoDistribution?: Array<{ name: string; value: number }>;
}

// ... (existing interfaces)

// ... (existing interfaces)


// ... (Render logic to include these charts in the 'overview' tab)
// In the TabsContent value="overview" section:
/*
  <div className="grid gap-6 grid-cols-4 mt-6">
      <UserGrowthChart />
      <RevenueChart />
      <ProductStatusChart />
      <GeoDistributionChart />
  </div>
*/

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
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
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
    name: string;
    email: string;
    status: string;
    phone?: string;
    city: string;
    location: string;
    createdAt: string;
  }>;
  buyers: Array<{
    id: string;
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
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// Chart Components
const StatsCard = ({ title, value, icon, description, trend }: StatsCardProps) => (
  <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden hover:shadow-yellow-500/10 transition-all duration-300 group">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
      <CardTitle className="text-sm font-medium text-gray-400">
        {title}
      </CardTitle>
      <div className="h-10 w-10 rounded-2xl bg-gray-800 flex items-center justify-center text-yellow-500 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-black/20">
        {icon}
      </div>
    </CardHeader>
    <CardContent className="relative z-10">
      <div className="text-2xl font-bold text-white">{value}</div>
      <p className="text-xs text-gray-500 mt-1 flex items-center">
        {trend !== null && trend !== undefined && (
          <span className={`flex items-center ${trend >= 0 ? 'text-green-400' : 'text-red-400'} mr-1`}>
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
            {Math.abs(trend)}%
          </span>
        )}
        <span className="truncate">{description}</span>
      </p>
    </CardContent>
  </Card>
);
const UserGrowthChart = ({ data }: { data: any[] }) => (
  <Card className="col-span-4 lg:col-span-2 bg-gray-900/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
    <CardHeader className="relative z-10">
      <CardTitle className="text-white">User Growth</CardTitle>
      <CardDescription className="text-gray-400">New buyers and sellers over time</CardDescription>
    </CardHeader>
    <CardContent className="relative z-10">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis dataKey="name" stroke="#9ca3af" axisLine={false} tickLine={false} tickMargin={10} />
            <YAxis stroke="#9ca3af" axisLine={false} tickLine={false} tickMargin={10} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }}
              itemStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Line type="monotone" dataKey="buyers" stroke="#06b6d4" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="Buyers" />
            <Line type="monotone" dataKey="sellers" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="Sellers" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
);

const RevenueChart = ({ data }: { data: any[] }) => (
  <Card className="col-span-4 lg:col-span-2 bg-gray-900/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
    <CardHeader className="relative z-10">
      <CardTitle className="text-white">Revenue Trends</CardTitle>
      <CardDescription className="text-gray-400">Platform revenue (commission) over time</CardDescription>
    </CardHeader>
    <CardContent className="relative z-10">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis dataKey="name" stroke="#9ca3af" axisLine={false} tickLine={false} tickMargin={10} />
            <YAxis stroke="#9ca3af" axisLine={false} tickLine={false} tickMargin={10} />
            <Tooltip
              cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }}
              itemStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Revenue (KSh)">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="url(#colorRevenue)" />
              ))}
            </Bar>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.3} />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
);

const SalesChart = ({ data }: { data: any[] }) => (
  <Card className="col-span-4 lg:col-span-2 bg-gray-900/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
    <CardHeader className="relative z-10">
      <CardTitle className="text-white">Sales Volume</CardTitle>
      <CardDescription className="text-gray-400">Total transaction volume over time</CardDescription>
    </CardHeader>
    <CardContent className="relative z-10">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis dataKey="name" stroke="#9ca3af" axisLine={false} tickLine={false} tickMargin={10} />
            <YAxis stroke="#9ca3af" axisLine={false} tickLine={false} tickMargin={10} />
            <Tooltip
              cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }}
              itemStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} name="Sales (KSh)">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="url(#colorSales)" />
              ))}
            </Bar>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.3} />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
);



const NewAdminDashboard = () => {
  // All hooks must be called unconditionally at the top level
  const { isAuthenticated, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

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
    topShops: []
  });

  // Fetch dashboard data in a separate effect
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    const fetchData = async () => {
      try {
        const [
          analytics,
          sellers,
          buyers,
          withdrawalRequests,
          monthlyMetrics,
          financialMetrics,
          monthlyFinancialData,
          dashboardStats,
          clients
        ] = await Promise.all([
          adminApi.getAnalytics().then(data => {
            return data;
          }),
          adminApi.getSellers().then(data => {
            return data;
          }),
          adminApi.getBuyers().then(data => {
            return data;
          }),
          adminApi.getWithdrawalRequests().then(data => {
            return data;
          }),
          adminApi.getMonthlyMetrics().then(data => {
            return data;
          }),
          adminApi.getFinancialMetrics().then(data => {
            return data;
          }),
          adminApi.getMonthlyFinancialData().then(data => {
            return data;
          }),
          adminApi.getDashboardStats().then(data => {
            return data;
          }),
          adminApi.getClients().then(data => {
            return data;
          })
        ]);

        // Ensure we have safe defaults if any data is missing
        const totalSellersCount = Array.isArray(sellers) ? sellers.length : 0;
        const totalBuyersCount = Array.isArray(buyers) ? buyers.length : 0;
        const totalClientsCount = dashboardStats?.totalClients || 0;

        const safeAnalytics: DashboardAnalytics = {
          totalRevenue: financialMetrics?.totalSales || 0,
          totalProducts: dashboardStats?.totalProducts || 0,
          totalSellers: dashboardStats?.totalSellers || totalSellersCount,
          totalBuyers: dashboardStats?.totalBuyers || totalBuyersCount,
          totalClients: dashboardStats?.totalClients || 0,
          totalWishlists: dashboardStats?.totalWishlists || 0,
          userGrowth: analytics?.userGrowth || [],
          revenueTrends: analytics?.revenueTrends || [],
          salesTrends: analytics?.salesTrends || [],
          monthlyGrowth: {
            revenue: analytics?.monthlyGrowth?.revenue || 0,
            products: analytics?.monthlyGrowth?.products || 0,
            sellers: analytics?.monthlyGrowth?.sellers || 0,
            buyers: analytics?.monthlyGrowth?.buyers || 0
          }
        };


        // Extract the data properly - handle both direct array and nested data structure
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
          topShops: dashboardStats?.topShops || []
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setIsInitialized(true);
      }
    };

    fetchData();
  }, [authLoading, isAuthenticated]);


  // Helper function to determine if trend should be shown
  const shouldShowTrend = (trend: number) => {
    return trend !== 0 || dashboardState.analytics.monthlyGrowth?.revenue !== 0;
  };


  // Stats cards data with proper type safety
  const statsCards: StatsCardProps[] = [
    {
      title: 'Total Products',
      value: dashboardState.analytics.totalProducts.toLocaleString(),
      icon: <Package className="h-4 w-4 text-orange-500" />,
      description: 'Available products',
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.products ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.products ?? 0
        : null
    },
    {
      title: 'Total Sellers',
      value: dashboardState.analytics.totalSellers?.toLocaleString() || '0',
      icon: <ShoppingCart className="h-4 w-4 text-purple-500" />,
      description: 'Active sellers',
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.sellers ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.sellers ?? 0
        : null
    },
    {
      title: 'Total Buyers',
      value: dashboardState.analytics.totalBuyers?.toLocaleString() || '0',
      icon: <UserCircle className="h-4 w-4 text-cyan-500" />,
      description: 'Registered buyers',
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.buyers ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.buyers ?? 0
        : null
    },
    {
      title: 'Total Sales',
      value: `KSh ${dashboardState.financialMetrics.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign className="h-4 w-4 text-green-600" />,
      description: `${dashboardState.financialMetrics.totalOrders} orders`,
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.revenue ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.revenue ?? 0
        : null
    },
    {
      title: 'Total Commission',
      value: `KSh ${dashboardState.financialMetrics.totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign className="h-4 w-4 text-yellow-600" />,
      description: 'Platform earnings',
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.revenue ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.revenue ?? 0
        : null
    },
    {
      title: 'Total Refunds',
      value: `KSh ${dashboardState.financialMetrics.totalRefunds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign className="h-4 w-4 text-red-600" />,
      description: `${dashboardState.financialMetrics.totalRefundRequests} completed`,
      trend: null // Refunds don't have growth tracking
    },
    {
      title: 'Total Wishlists',
      value: dashboardState.analytics.totalWishlists?.toLocaleString() || '0',
      icon: <Package className="h-4 w-4 text-pink-500" />,
      description: 'Items in wishlists',
      trend: null
    },
    {
      title: 'Total Clients',
      value: dashboardState.analytics.totalClients?.toLocaleString() || '0',
      icon: <Users className="h-4 w-4 text-blue-400" />,
      description: 'Purchasing customers',
      trend: null
    }
  ];

  // Format metrics data for the chart
  const metricsData = useMemo(() => {
    if (!dashboardState.monthlyMetrics?.length) {
      return [];
    }

    try {
      return dashboardState.monthlyMetrics.map(metric => {
        const date = new Date(metric.month);
        if (isNaN(date.getTime())) {
          console.warn('Invalid date in metric:', metric);
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
      console.error('Error processing metrics data:', error);
      return [];
    }
  }, [dashboardState.monthlyMetrics]);

  // Custom tooltip for metrics chart
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


  // Show loading state while checking auth or loading data
  if (authLoading || !isAuthenticated || !isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  // Loading and error states are already handled at the top of the component



  // Handle viewing seller details
  const handleViewSeller = async (sellerId: string) => {
    try {
      setIsLoadingSeller(true);
      const response = await adminApi.getSellerById(sellerId);
      setSelectedSeller(response);
    } catch (error) {
      console.error('Error fetching seller details:', error);
      toast.error('Failed to load seller details');
    } finally {
      setIsLoadingSeller(false);
    }
  };

  // Close seller details modal
  const closeSellerModal = () => {
    setSelectedSeller(null);
  };

  // Handle toggling seller status (active/inactive)
  const handleToggleSellerStatus = async (sellerId: string, newStatus: 'active' | 'inactive') => {
    try {
      // Call the API to update the seller status
      const response = await adminApi.updateSellerStatus(sellerId, { status: newStatus });

      if (response.data.status === 'success') {
        // Update the UI to reflect the new status
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
  const handleDeleteUser = async (userId: string, role: 'seller' | 'buyer') => {
    if (!window.confirm(`Are you sure you want to block and delete this ${role}? This action cannot be undone.`)) {
      return;
    }

    try {
      await adminApi.deleteUser(userId);
      toast.success(`${role.charAt(0).toUpperCase() + role.slice(1)} account deleted successfully`);

      // Refresh data
      setDashboardState(prev => ({
        ...prev,
        sellers: role === 'seller' ? prev.sellers.filter(s => s.id !== userId) : prev.sellers,
        buyers: role === 'buyer' ? prev.buyers.filter(b => b.id !== userId) : prev.buyers
      }));
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user account');
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


  return (
    <div className="min-h-screen bg-black relative overflow-hidden p-4 md:p-8">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-yellow-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-500/10 blur-[120px]" />
      </div>

      {/* Seller Details Modal */}
      {selectedSeller && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-2xl bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30">
                  <Store className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Seller Details
                  </h3>
                  <p className="text-sm text-gray-400">
                    {selectedSeller.name || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeSellerModal}
                className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors duration-200 border border-white/5"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-auto flex-1 p-6 custom-scrollbar">
              {isLoadingSeller ? (
                <div className="flex flex-col items-center justify-center h-40 space-y-4">
                  <div className="h-12 w-12 rounded-2xl bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30 animate-pulse">
                    <Loader2 className="h-6 w-6 text-yellow-500 animate-spin" />
                  </div>
                  <p className="text-gray-400 font-medium">Loading seller details...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Basic Info */}
                  <Card className="bg-gray-800/40 border border-white/10 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold text-white">Basic Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Full Name</p>
                        <p className="text-base text-gray-200">{selectedSeller.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Email</p>
                        <p className="text-base text-gray-200">{selectedSeller.email || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Phone</p>
                        <p className="text-base text-gray-200">{selectedSeller.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Shop Name</p>
                        <p className="text-base text-gray-200">{selectedSeller.shop_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">City</p>
                        <p className="text-base text-gray-200">{selectedSeller.city || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Location</p>
                        <p className="text-base text-gray-200">{selectedSeller.location || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Status</p>
                        <Badge className={selectedSeller.status === 'active'
                          ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                          : 'bg-gray-500/10 text-gray-400 border border-white/10'}>
                          {selectedSeller.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Wallet Balance</p>
                        <p className="text-base text-yellow-500 font-bold">KSh {parseFloat(selectedSeller.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Member Since</p>
                        <p className="text-base text-gray-200">
                          {formatDate(selectedSeller.createdAt || selectedSeller.created_at)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sales Metrics */}
                  <Card className="bg-gray-800/40 border border-white/10 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold text-white">Sales Metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-green-500/10 rounded-2xl p-4 border border-green-500/20 hover:bg-green-500/15 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded-xl bg-green-500/20 flex items-center justify-center">
                              <DollarSign className="h-4 w-4 text-green-500" />
                            </div>
                            <div>
                              <p className="text-sm text-green-400 font-medium">Total Sales</p>
                              <p className="text-lg font-bold text-green-200">
                                KSh {selectedSeller.metrics?.totalSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-blue-500/10 rounded-2xl p-4 border border-blue-500/20 hover:bg-blue-500/15 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
                              <DollarSign className="h-4 w-4 text-blue-500" />
                            </div>
                            <div>
                              <p className="text-sm text-blue-400 font-medium">Net Sales</p>
                              <p className="text-lg font-bold text-blue-200">
                                KSh {selectedSeller.metrics?.netSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-yellow-500/10 rounded-2xl p-4 border border-yellow-500/20 hover:bg-yellow-500/15 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                              <DollarSign className="h-4 w-4 text-yellow-500" />
                            </div>
                            <div>
                              <p className="text-sm text-yellow-400 font-medium">Commission</p>
                              <p className="text-lg font-bold text-yellow-200">
                                KSh {selectedSeller.metrics?.totalCommission?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-purple-500/10 rounded-2xl p-4 border border-purple-500/20 hover:bg-purple-500/15 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
                              <ShoppingCart className="h-4 w-4 text-purple-500" />
                            </div>
                            <div>
                              <p className="text-sm text-purple-400 font-medium">Total Orders</p>
                              <p className="text-lg font-bold text-purple-200">
                                {selectedSeller.metrics?.totalOrders || 0}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="text-center p-3 bg-white/5 rounded-xl border border-white/10">
                          <p className="text-2xl font-bold text-white">{selectedSeller.metrics?.totalProducts || 0}</p>
                          <p className="text-xs text-gray-500 mt-1">Products</p>
                        </div>
                        <div className="text-center p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                          <p className="text-2xl font-bold text-orange-400">{selectedSeller.metrics?.pendingOrders || 0}</p>
                          <p className="text-xs text-orange-400/80 mt-1">Pending</p>
                        </div>
                        <div className="text-center p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                          <p className="text-2xl font-bold text-blue-400">{selectedSeller.metrics?.readyForPickup || 0}</p>
                          <p className="text-xs text-blue-400/80 mt-1">Ready</p>
                        </div>
                        <div className="text-center p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                          <p className="text-2xl font-bold text-green-400">{selectedSeller.metrics?.completedOrders || 0}</p>
                          <p className="text-xs text-green-400/80 mt-1">Completed</p>
                        </div>
                        <div className="text-center p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                          <p className="text-2xl font-bold text-red-400">{selectedSeller.metrics?.cancelledOrders || 0}</p>
                          <p className="text-xs text-red-400/80 mt-1">Cancelled</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Orders */}
                  {selectedSeller.recentOrders && selectedSeller.recentOrders.length > 0 && (
                    <Card className="bg-gray-800/40 border border-white/10 backdrop-blur-sm">
                      <CardHeader>
                        <CardTitle className="text-lg font-bold text-white">Recent Orders</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {selectedSeller.recentOrders.map((order: any) => (
                            <div key={order.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors border border-white/5">
                              <div className="flex-1">
                                <p className="font-semibold text-white">Order #{order.orderNumber || order.id}</p>
                                <p className="text-sm text-gray-400">{order.buyerName}</p>
                                <p className="text-xs text-gray-500">{formatDateTime(order.createdAt)}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-white">KSh {(order.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                <div className="flex gap-2 mt-1 justify-end">
                                  <Badge className={
                                    order.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                      order.status === 'PENDING' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' :
                                        order.status === 'READY_FOR_PICKUP' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                                          'bg-red-500/10 text-red-500 border border-red-500/20'
                                  }>
                                    {order.status}
                                  </Badge>
                                  <Badge className={
                                    order.paymentStatus === 'completed' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                      'bg-gray-500/10 text-gray-400 border border-white/10'
                                  }>
                                    {order.paymentStatus}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10 flex justify-end">
              <Button
                onClick={closeSellerModal}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-6 py-2 rounded-2xl shadow-lg shadow-yellow-500/20 transition-all duration-200"
              >
                Close
              </Button>
            </div>
          </div>
        </div >
      )}

      {/* Buyer Details Modal */}
      {
        selectedBuyer && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-2xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                    <UserCircle className="h-5 w-5 text-cyan-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Buyer Details
                    </h3>
                    <p className="text-sm text-gray-400">
                      {selectedBuyer.name || 'N/A'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeBuyerModal}
                  className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors duration-200 border border-white/5"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-auto flex-1 p-6 custom-scrollbar">
                {isLoadingBuyer ? (
                  <div className="flex flex-col items-center justify-center h-40 space-y-4">
                    <div className="h-12 w-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30 animate-pulse">
                      <Loader2 className="h-6 w-6 text-cyan-500 animate-spin" />
                    </div>
                    <p className="text-gray-400 font-medium">Loading buyer details...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <Card className="bg-gray-800/40 border border-white/10 backdrop-blur-sm">
                      <CardHeader>
                        <CardTitle className="text-lg font-bold text-white">Basic Information</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500 font-medium">Full Name</p>
                          <p className="text-base text-gray-200">{selectedBuyer.name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 font-medium">Email</p>
                          <p className="text-base text-gray-200">{selectedBuyer.email || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 font-medium">Phone (Mobile Payment)</p>
                          <p className="text-base text-gray-200">{selectedBuyer.phone || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 font-medium">WhatsApp Number</p>
                          <p className="text-base text-gray-200">{selectedBuyer.whatsapp_number || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 font-medium">City</p>
                          <p className="text-base text-gray-200">{selectedBuyer.city || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 font-medium">Location</p>
                          <p className="text-base text-gray-200">{selectedBuyer.location || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 font-medium">Status</p>
                          <Badge className={selectedBuyer.status === 'Active' || selectedBuyer.status === 'active'
                            ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                            : 'bg-gray-500/10 text-gray-400 border border-white/10'}>
                            {selectedBuyer.status}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 font-medium">Member Since</p>
                          <p className="text-base text-gray-200">
                            {formatDate(selectedBuyer.created_at || selectedBuyer.createdAt)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-white/10 flex justify-end">
                <Button
                  onClick={closeBuyerModal}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-6 py-2 rounded-2xl shadow-lg shadow-yellow-500/20 transition-all duration-200"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )
      }

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Modern Header */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl relative z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-3xl"></div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between relative z-10">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3 sm:mb-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-800 rounded-2xl flex items-center justify-center shadow-lg shadow-black/20 flex-shrink-0 border border-white/10">
                    <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-1 sm:mb-2">Admin Dashboard</h1>
                    <p className="text-sm sm:text-base text-gray-400 font-medium">Welcome back, Administrator</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 sm:mt-0 flex items-center gap-3">
                <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-yellow-100 text-yellow-800 rounded-full text-xs sm:text-sm font-semibold">
                  System Admin
                </div>
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {statsCards.map((stat, index) => (
            <div key={index} className="w-full">
              <StatsCard {...stat} />
            </div>
          ))}
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <div className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-1 sm:p-2 shadow-xl overflow-x-auto">
            <TabsList className="bg-transparent border-0 p-0 h-auto w-max min-w-full">
              <TabsTrigger
                value="overview"
                className="rounded-2xl px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-600 data-[state=active]:text-black data-[state=active]:shadow-lg text-gray-600 hover:text-black hover:bg-white/50 transition-all duration-300 font-semibold whitespace-nowrap"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="sellers"
                className="rounded-2xl px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-600 data-[state=active]:text-black data-[state=active]:shadow-lg text-gray-600 hover:text-black hover:bg-white/50 transition-all duration-300 font-semibold whitespace-nowrap"
              >
                Sellers
              </TabsTrigger>
              <TabsTrigger
                value="buyers"
                className="rounded-2xl px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-600 data-[state=active]:text-black data-[state=active]:shadow-lg text-gray-600 hover:text-black hover:bg-white/50 transition-all duration-300 font-semibold whitespace-nowrap"
              >
                Buyers
              </TabsTrigger>
              <TabsTrigger
                value="withdrawals"
                className="rounded-2xl px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-600 data-[state=active]:text-black data-[state=active]:shadow-lg text-gray-600 hover:text-black hover:bg-white/50 transition-all duration-300 font-semibold whitespace-nowrap"
              >
                Withdrawals
              </TabsTrigger>
              <TabsTrigger
                value="refunds"
                className="rounded-2xl px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-400 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-600 hover:text-black hover:bg-white/50 transition-all duration-300 font-semibold whitespace-nowrap"
              >
                Refunds
              </TabsTrigger>
              <TabsTrigger
                value="clients"
                className="rounded-2xl px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-400 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-600 hover:text-black hover:bg-white/50 transition-all duration-300 font-semibold whitespace-nowrap"
              >
                Clients
              </TabsTrigger>
            </TabsList>
          </div>
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* User Growth Chart */}
            <UserGrowthChart data={dashboardState.analytics.userGrowth || []} />

            {/* Revenue Trends Chart (Commission) */}
            <RevenueChart data={dashboardState.analytics.revenueTrends || []} />

            {/* Total Sales Chart */}
            <SalesChart data={dashboardState.analytics.salesTrends || []} />

            {/* Top Shops Section */}
            <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">Top 3 Shops</CardTitle>
                <CardDescription className="text-gray-400">By client count</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardState.topShops?.map((shop, index) => (
                    <div key={shop.id} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                          index === 1 ? 'bg-gray-300/20 text-gray-300' :
                            'bg-orange-700/20 text-orange-700'
                          }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{shop.shopName || shop.name}</p>
                          <p className="text-xs text-gray-500">{shop.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-yellow-500">{shop.clientCount}</p>
                        <p className="text-[10px] text-gray-500 uppercase font-black">Clients</p>
                      </div>
                    </div>
                  ))}
                  {!dashboardState.topShops?.length && (
                    <p className="text-center text-gray-500 py-4">No shop data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Sellers */}
              <Card className="lg:col-span-2 bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-white">Recent Sellers</CardTitle>
                    <CardDescription className="text-gray-400">Latest shops to join the platform</CardDescription>
                  </div>
                  <Button variant="ghost" className="text-yellow-500 hover:bg-yellow-500/10" onClick={() => setActiveTab('sellers')}>
                    View All
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider font-medium">
                        <tr>
                          <th className="px-6 py-3">Seller</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dashboardState.sellers.slice(0, 5).map((seller) => (
                          <tr key={seller.id} className="hover:bg-white/5 transition-all">
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                  <Store className="w-4 h-4 text-yellow-500" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-white">{seller.name}</p>
                                  <p className="text-xs text-gray-500">{seller.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm capitalize">
                              <Badge variant="outline" className={seller.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}>
                                {seller.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-400">
                              {formatDate(seller.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions / Summary */}
              <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-white">Platform Health</CardTitle>
                  <CardDescription className="text-gray-400">Current status overview</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-400">Active Sellers</p>
                      <span className="text-xs font-bold text-green-400">Healthy</span>
                    </div>
                    <p className="text-2xl font-black text-white">{dashboardState.analytics.totalSellers || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-400">Total Products</p>
                      <span className="text-xs font-bold text-blue-400">Growing</span>
                    </div>
                    <p className="text-2xl font-black text-white">{dashboardState.analytics.totalProducts || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <p className="text-sm text-gray-400 mb-2">Total Revenue</p>
                    <p className="text-2xl font-black text-white">KSh {(dashboardState.analytics.totalRevenue || 0).toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Sellers Tab */}
          <TabsContent value="sellers" className="space-y-4 sm:space-y-6">
            <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <CardHeader className="pb-3 sm:pb-4 relative z-10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-bold text-white">Sellers</CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-gray-400">
                      Manage all sellers in the platform
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search sellers..."
                      className="pl-12 w-full text-sm sm:text-base sm:w-[250px] md:w-[300px] h-10 sm:h-11 bg-black/20 border-white/10 text-white placeholder:text-gray-500 focus:border-yellow-500/50 focus:ring-yellow-500/20"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 relative z-10">
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-white/10">
                      <thead className="bg-gray-800/50">
                        <tr className="border-b border-white/10">
                          <th className="py-3 px-3 sm:px-4 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Seller</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Contact</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Location</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider">Status</th>
                          <th className="py-3 pr-3 sm:pr-4 text-right text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {dashboardState.sellers?.map((seller) => (
                          <tr key={seller.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-3 sm:px-4">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                  <User className="h-5 w-5 text-yellow-500" />
                                </div>
                                <div className="ml-3">
                                  <div className="text-sm font-medium text-white">{seller.name}</div>
                                  <div className="text-xs text-gray-500">ID: {seller.id}</div>
                                  <div className="sm:hidden text-xs text-gray-400 mt-1">
                                    <div>{seller.email}</div>
                                    {seller.phone && <div>{seller.phone}</div>}
                                    <div className="flex items-center mt-1">
                                      <MapPin className="h-3.5 w-3.5 mr-1 text-gray-500" />
                                      <span>{seller.city || 'N/A'}</span>
                                    </div>
                                    {seller.location && (
                                      <div className="text-xs text-gray-400 truncate">{seller.location}</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-2 sm:px-3 text-sm text-gray-300 hidden sm:table-cell">
                              <div className="font-medium text-white">{seller.email}</div>
                              <div className="text-xs text-gray-400">{seller.phone || 'N/A'}</div>
                            </td>
                            <td className="py-3 px-2 sm:px-3 text-sm text-gray-300 hidden md:table-cell">
                              <div className="flex items-center">
                                <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                                <span className="text-gray-300">{seller.city || 'N/A'}</span>
                              </div>
                              {seller.location && (
                                <div className="text-xs text-gray-400 truncate max-w-[200px]" title={seller.location}>
                                  {seller.location}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-2 sm:px-3">
                              <Badge
                                variant="outline"
                                className={
                                  seller.status === 'active'
                                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                    : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                }
                              >
                                {seller.status}
                              </Badge>
                            </td>
                            <td className="py-3 pr-3 sm:pr-4 text-right">
                              <div className="flex items-center justify-end space-x-1 sm:space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 h-8 px-2 sm:px-3 text-xs sm:text-sm"
                                  onClick={() => handleViewSeller(seller.id)}
                                >
                                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                  <span className="hidden sm:inline">View</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2 sm:px-3 text-xs sm:text-sm"
                                  onClick={() => handleDeleteUser(seller.id, 'seller')}
                                >
                                  <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                  <span className="hidden sm:inline">Block</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-white/10 px-4 sm:px-6 py-3 sm:py-4 relative z-10">
                <div className="flex items-center justify-between w-full">
                  <div className="text-sm text-gray-400">
                    Showing <span className="font-medium">1</span> to <span className="font-medium">{dashboardState.sellers?.length || 0}</span> of{' '}
                    <span className="font-medium">{dashboardState.sellers?.length || 0}</span> sellers
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" disabled={true} className="border-white/10 text-gray-400 hover:bg-white/5 bg-transparent">
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={true} className="border-white/10 text-gray-400 hover:bg-white/5 bg-transparent">
                      Next
                    </Button>
                  </div>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Buyers Tab */}
          <TabsContent value="buyers" className="space-y-4 sm:space-y-6">
            <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <CardHeader className="pb-3 sm:pb-4 relative z-10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-bold text-white">Buyers</CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-gray-400">
                      Manage all buyers in the platform
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search buyers..."
                      className="pl-12 w-full text-sm sm:text-base sm:w-[250px] md:w-[300px] h-10 sm:h-11 bg-black/20 border-white/10 text-white placeholder:text-gray-500 focus:border-yellow-500/50 focus:ring-yellow-500/20"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 relative z-10">
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-white/10">
                      <thead className="bg-gray-800/50">
                        <tr className="border-b border-white/10">
                          <th className="py-3 px-3 sm:px-4 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Buyer</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Contact</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Location</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider">Status</th>
                          <th className="py-3 pr-3 sm:pr-4 text-right text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {dashboardState.buyers?.map((buyer) => (
                          <tr key={buyer.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-3 sm:px-4">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                  <User className="h-5 w-5 text-blue-500" />
                                </div>
                                <div className="ml-3">
                                  <div className="text-sm font-medium text-white">{buyer.name}</div>
                                  <div className="text-xs text-gray-500">ID: {buyer.id}</div>
                                  <div className="sm:hidden text-xs text-gray-400 mt-1">
                                    <div>{buyer.email}</div>
                                    {buyer.phone && <div>{buyer.phone}</div>}
                                    <div className="flex items-center mt-1">
                                      <MapPin className="h-3.5 w-3.5 mr-1 text-gray-500" />
                                      <span>{buyer.city || 'N/A'}</span>
                                    </div>
                                    {buyer.location && (
                                      <div className="text-xs text-gray-400 truncate">{buyer.location}</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-2 sm:px-3 text-sm text-gray-300 hidden sm:table-cell">
                              <div className="font-medium text-white">{buyer.email}</div>
                              <div className="text-xs text-gray-400">{buyer.phone || 'N/A'}</div>
                            </td>
                            <td className="py-3 px-2 sm:px-3 text-sm text-gray-300 hidden md:table-cell">
                              <div className="flex items-center">
                                <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                                <span className="text-gray-300">{buyer.city || 'N/A'}</span>
                              </div>
                              <div className="flex items-center text-xs text-gray-400 mt-1">
                                <Calendar className="h-3 w-3 mr-1" />
                                <span>Joined: {formatDate(buyer.createdAt)}</span>
                              </div>
                              {buyer.location && (
                                <div className="text-xs text-gray-400 truncate max-w-[200px]" title={buyer.location}>
                                  {buyer.location}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-2 sm:px-3">
                              <Badge
                                variant="outline"
                                className={
                                  buyer.status === 'active'
                                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                    : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                }
                              >
                                {buyer.status}
                              </Badge>
                            </td>
                            <td className="py-3 pr-3 sm:pr-4 text-right">
                              <div className="flex items-center justify-end space-x-1 sm:space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 h-8 px-2 sm:px-3 text-xs sm:text-sm"
                                  onClick={() => handleViewBuyer(buyer.id)}
                                >
                                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                  <span className="hidden sm:inline">View</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2 sm:px-3 text-xs sm:text-sm"
                                  onClick={() => handleDeleteUser(buyer.id, 'buyer')}
                                >
                                  <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                  <span className="hidden sm:inline">Block</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-white/10 px-4 sm:px-6 py-3 sm:py-4 relative z-10">
                <div className="flex items-center justify-between w-full">
                  <div className="text-sm text-gray-400">
                    Showing <span className="font-medium">1</span> to <span className="font-medium">{dashboardState.buyers?.length || 0}</span> of{' '}
                    <span className="font-medium">{dashboardState.buyers?.length || 0}</span> buyers
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" disabled={true} className="border-white/10 text-gray-400 hover:bg-white/5 bg-transparent">
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={true} className="border-white/10 text-gray-400 hover:bg-white/5 bg-transparent">
                      Next
                    </Button>
                  </div>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals" className="space-y-4 sm:space-y-6">
            <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <CardHeader className="pb-3 sm:pb-4 relative z-10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-bold text-white">Withdrawal Requests</CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-gray-400">
                      Manage seller withdrawal requests
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search requests..."
                      className="pl-12 w-full text-sm sm:text-base sm:w-[250px] md:w-[300px] h-10 sm:h-11 bg-black/20 border-white/10 text-white placeholder:text-gray-500 focus:border-yellow-500/50 focus:ring-yellow-500/20"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 relative z-10">
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-white/10">
                      <thead className="bg-gray-800/50">
                        <tr className="border-b border-white/10">
                          <th className="py-3 px-3 sm:px-4 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Seller</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Amount</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">M-Pesa Details</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider">Status</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Date</th>
                          <th className="py-3 pr-3 sm:pr-4 text-right text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {dashboardState.withdrawalRequests?.map((request) => (
                          <tr key={request.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-3 sm:px-4">
                              <div className="font-medium text-white">{request.sellerName}</div>
                              <div className="text-xs text-gray-400">{request.sellerEmail}</div>
                              <div className="sm:hidden text-xs text-gray-400 mt-1">
                                <div>KSh {request.amount.toLocaleString()}</div>
                                <div>{request.mpesaNumber} ({request.mpesaName})</div>
                              </div>
                            </td>
                            <td className="py-3 px-2 sm:px-3 text-sm text-gray-300 hidden sm:table-cell">
                              <span className="font-semibold text-white">KSh {request.amount.toLocaleString()}</span>
                            </td>
                            <td className="py-3 px-2 sm:px-3 text-sm text-gray-300 hidden md:table-cell">
                              <div className="font-medium text-white">{request.mpesaNumber}</div>
                              <div className="text-xs text-gray-400">{request.mpesaName}</div>
                            </td>
                            <td className="py-3 px-2 sm:px-3">
                              <Badge
                                variant="outline"
                                className={`${request.status === 'pending'
                                  ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                  : request.status === 'approved'
                                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                    : request.status === 'rejected'
                                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  } rounded-full px-3 py-1 font-semibold`}
                              >
                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 sm:px-3 text-sm text-gray-300 hidden lg:table-cell">
                              <div>{formatDate(request.createdAt)}</div>
                              <div className="text-xs text-gray-400">{formatDateTime(request.createdAt)}</div>
                            </td>
                            <td className="py-3 pr-3 sm:pr-4 text-right">
                              <div className="flex items-center justify-end space-x-1 sm:space-x-2">
                                {request.status === 'pending' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-green-500 hover:bg-green-500/10 hover:text-green-400 h-8 px-2 sm:px-3 text-xs sm:text-sm"
                                      onClick={() => handleWithdrawalRequestAction(request.id, 'approved')}
                                    >
                                      <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                      <span className="hidden sm:inline">Approve</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-500 hover:bg-red-500/10 hover:text-red-400 h-8 px-2 sm:px-3 text-xs sm:text-sm"
                                      onClick={() => handleWithdrawalRequestAction(request.id, 'rejected')}
                                    >
                                      <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                      <span className="hidden sm:inline">Reject</span>
                                    </Button>
                                  </>
                                )}
                                {request.status !== 'pending' && (
                                  <span className="text-xs text-gray-400">
                                    Processed by {request.processedBy || 'Admin'}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-white/10 px-4 sm:px-6 py-3 sm:py-4 relative z-10">
                <div className="flex items-center justify-between w-full">
                  <div className="text-sm text-gray-400">
                    Showing <span className="font-medium">1</span> to <span className="font-medium">{dashboardState.withdrawalRequests?.length || 0}</span> of{' '}
                    <span className="font-medium">{dashboardState.withdrawalRequests?.length || 0}</span> withdrawal requests
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" disabled={true} className="border-white/10 text-gray-400 hover:bg-white/5 bg-transparent">
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={true} className="border-white/10 text-gray-400 hover:bg-white/5 bg-transparent">
                      Next
                    </Button>
                  </div>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients" className="space-y-4 sm:space-y-6">
            <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <CardHeader className="pb-3 sm:pb-4 relative z-10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-bold text-white">Clients</CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-gray-400">
                      View all clients registered via sellers
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search clients..."
                      className="pl-12 w-full text-sm sm:text-base sm:w-[250px] md:w-[300px] h-10 sm:h-11 bg-black/20 border-white/10 text-white placeholder:text-gray-500 focus:border-yellow-500/50 focus:ring-yellow-500/20"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 relative z-10">
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-white/10">
                      <thead className="bg-gray-800/50">
                        <tr className="border-b border-white/10">
                          <th className="py-3 px-3 sm:px-4 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Client</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider">Contact</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider">Seller / Shop</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {(dashboardState.clients || []).filter(c =>
                          (c.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                          (c.phone || '').includes(searchQuery) ||
                          (c.shop_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
                        ).map((client) => (
                          <tr key={client.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-3 sm:px-4">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                  <User className="h-5 w-5 text-blue-400" />
                                </div>
                                <div className="ml-3">
                                  <div className="text-sm font-medium text-white">{client.full_name}</div>
                                  <div className="text-xs text-gray-500">ID: {client.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-2 sm:px-3 text-sm text-gray-300">
                              <div className="font-medium text-white">{client.phone}</div>
                            </td>
                            <td className="py-3 px-2 sm:px-3 text-sm text-gray-300">
                              <div className="font-medium text-white">{client.shop_name || 'Direct'}</div>
                              <div className="text-xs text-gray-500">{client.seller_name}</div>
                            </td>
                            <td className="py-3 px-2 sm:px-3 text-sm text-gray-400">
                              {formatDate(client.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div >
  );
};

export default NewAdminDashboard;

