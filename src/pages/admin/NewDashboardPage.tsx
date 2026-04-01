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
import { Calendar, Clock, Users, User, ShoppingCart, DollarSign, Activity, Store, UserPlus, Eye, MoreHorizontal, Loader2, Plus, Package, X, ShoppingBag, UserCheck, Box, Shield, UserCircle, MapPin, CheckCircle, XCircle, ArrowUpRight, ArrowDownRight, Percent, TrendingUp, Lock, Unlock, Users2, Mail } from 'lucide-react';
import { adminApi } from '@/api/adminApi';
import { format } from 'date-fns';
import { toast } from 'sonner';
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
  <div className="relative group">
    {/* Glow pulse on hover */}
    <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500/0 to-yellow-500/0 rounded-[2rem] blur opacity-0 group-hover:opacity-30 group-hover:from-yellow-500/50 group-hover:to-orange-500/50 transition duration-500"></div>

    <Card className="relative bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] overflow-hidden transition-all duration-500 group-hover:bg-[#0A0A0A]/60 group-hover:scale-[1.02] group-hover:border-white/20">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent pointer-events-none"></div>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
        <CardTitle className="text-sm font-semibold text-gray-400 tracking-wide uppercase">
          {title}
        </CardTitle>
        <div className="h-12 w-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-yellow-500 group-hover:scale-110 group-hover:text-yellow-400 transition-all duration-500 shadow-inner">
          {icon}
        </div>
      </CardHeader>

      <CardContent className="relative z-10 pt-0">
        <div className="text-3xl font-black text-white tracking-tight tabular-nums group-hover:text-yellow-50 transition-colors duration-500">
          {value}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {trend !== null && trend !== undefined && (
            <div className={`flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${trend >= 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {trend >= 0 ? <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" /> : <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />}
              {Math.abs(trend)}%
            </div>
          )}
          <span className="text-xs text-gray-500 font-medium truncate">{description}</span>
        </div>
      </CardContent>
    </Card>
  </div>
);

const ChartContainer = ({ title, description, children, className = "" }: { title: string, description: string, children: React.ReactNode, className?: string }) => (
  <Card className={`${className} bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] overflow-hidden group hover:border-white/20 transition-all duration-500`}>
    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none"></div>
    <CardHeader className="relative z-10 pb-2">
      <CardTitle className="text-xl font-bold text-white group-hover:text-yellow-50 transition-colors">{title}</CardTitle>
      <CardDescription className="text-gray-400 font-medium">{description}</CardDescription>
    </CardHeader>
    <CardContent className="relative z-10 h-[350px] w-full pt-4">
      {children}
    </CardContent>
  </Card>
);

const UserGrowthChart = ({ data }: { data: any[] }) => (
  <ChartContainer title="User Growth" description="New buyers and sellers growth trend" className="col-span-4 lg:col-span-2">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <defs>
          <linearGradient id="colorBuyers" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorSellers" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="name" stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <YAxis stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <Tooltip
          contentStyle={{ backgroundColor: 'rgba(10, 10, 10, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '1rem', backdropFilter: 'blur(10px)', color: '#fff' }}
          itemStyle={{ color: '#e5e7eb', fontSize: '12px' }}
        />
        <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
        <Line type="monotone" dataKey="buyers" stroke="#06b6d4" strokeWidth={4} dot={{ r: 4, fill: '#06b6d4', strokeWidth: 2, stroke: '#0A0A0A' }} activeDot={{ r: 6, strokeWidth: 0 }} name="Buyers" />
        <Line type="monotone" dataKey="sellers" stroke="#f59e0b" strokeWidth={4} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#0A0A0A' }} activeDot={{ r: 6, strokeWidth: 0 }} name="Sellers" />
      </LineChart>
    </ResponsiveContainer>
  </ChartContainer>
);

const RevenueChart = ({ data }: { data: any[] }) => (
  <ChartContainer title="Revenue Trends" description="Monthly platform earnings (KSh)" className="col-span-4 lg:col-span-2">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="name" stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <YAxis stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <Tooltip
          cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
          contentStyle={{ backgroundColor: 'rgba(10, 10, 10, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}
          itemStyle={{ color: '#e5e7eb' }}
        />
        <Bar dataKey="revenue" fill="url(#colorRevenue)" radius={[8, 8, 0, 0]} name="Revenue (KSh)" barSize={40} />
      </BarChart>
    </ResponsiveContainer>
  </ChartContainer>
);

const SalesChart = ({ data }: { data: any[] }) => (
  <ChartContainer title="Sales Volume" description="Total marketplace transaction volume" className="col-span-4 lg:col-span-2">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <defs>
          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="name" stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <YAxis stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <Tooltip
          cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
          contentStyle={{ backgroundColor: 'rgba(10, 10, 10, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}
          itemStyle={{ color: '#e5e7eb' }}
        />
        <Bar dataKey="sales" fill="url(#colorSales)" radius={[8, 8, 0, 0]} name="Sales (KSh)" barSize={40} />
      </BarChart>
    </ResponsiveContainer>
  </ChartContainer>
);

const ProductStatusChart = ({ data }: { data: any[] }) => (
  <ChartContainer title="Product Distribution" description="Inventory breakdown by status" className="col-span-4 lg:col-span-2">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={80}
          outerRadius={110}
          paddingAngle={8}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: 'rgba(10, 10, 10, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  </ChartContainer>
);

const GeoDistributionChart = ({ data }: { data: any[] }) => (
  <ChartContainer title="Geographic Reach" description="Top 5 cities by user density" className="col-span-4 lg:col-span-2">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={80}
          outerRadius={110}
          paddingAngle={5}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} stroke="none" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: 'rgba(10, 10, 10, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  </ChartContainer>
);



const NewAdminDashboard = () => {
  // All hooks must be called unconditionally at the top level
  const { isAuthenticated, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    const fetchDashboardData = async () => {
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
          adminApi.getClients()
        ]);

        const [
          analyticsRes,
          sellersRes,
          buyersRes,
          withdrawalsRes,
          monthlyRes,
          financialRes,
          statsRes,
          dashboardStatsRes,
          clientsRes
        ] = results;

        const analytics = analyticsRes.status === 'fulfilled' ? analyticsRes.value : null;
        const sellers = sellersRes.status === 'fulfilled' ? sellersRes.value : [];
        const buyers = buyersRes.status === 'fulfilled' ? buyersRes.value : [];
        const withdrawalRequests = withdrawalsRes.status === 'fulfilled' ? withdrawalsRes.value : [];
        const monthlyMetrics = monthlyRes.status === 'fulfilled' ? monthlyRes.value : null;
        const financialMetrics = financialRes.status === 'fulfilled' ? financialRes.value : null;
        const monthlyFinancialData = statsRes.status === 'fulfilled' ? statsRes.value : [];
        const dashboardStats = dashboardStatsRes.status === 'fulfilled' ? dashboardStatsRes.value : null;
        const clients = clientsRes.status === 'fulfilled' ? clientsRes.value : [];

        const totalSellersCount = Array.isArray(sellers) ? sellers.length : 0;
        const totalBuyersCount = Array.isArray(buyers) ? buyers.length : 0;

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
  }, [authLoading, isAuthenticated]);

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
      trend: null
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
      <div className="flex items-center justify-center min-h-screen bg-[#050505]">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="h-12 w-12 text-yellow-500" />
          <p className="text-gray-500 font-black uppercase tracking-widest text-xs animate-pulse">Initializing System...</p>
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
      <div className="flex items-center justify-center min-h-screen bg-[#050505] p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto border border-red-500/20">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight uppercase">System Error</h2>
            <p className="text-gray-400 font-medium">{error}</p>
          </div>
          <Button
            onClick={() => window.location.reload()}
            className="w-full h-14 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all"
          >
            Re-Initialize
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

  // Accessibility labels and aria roles were missing on modals

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-yellow-500/30 selection:text-black">
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 lg:p-12 space-y-8 md:space-y-12">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-yellow-500/10 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-orange-500/10 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-500/5 blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
          {/* Premium Header */}
          <header className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-[2.5rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
            <div className="relative bg-[#0A0A0A]/60 backdrop-blur-3xl border border-white/10 rounded-3xl md:rounded-[2.5rem] p-5 md:p-10 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="absolute -inset-2 bg-yellow-500/20 rounded-2xl blur opacity-50 animate-pulse"></div>
                  <div className="relative w-16 h-16 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl">
                    <Shield className="h-8 w-8 text-yellow-500" />
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
                    Admin <span className="text-yellow-500">Dashboard</span>
                  </h1>
                  <p className="text-gray-400 font-medium mt-1 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                    System Operational • Welcome back, Administrator
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/5">
                <div className="px-4 py-2 bg-yellow-500/10 text-yellow-500 rounded-xl text-sm font-black border border-yellow-500/20 tracking-wider">
                  ROOT ACCESS
                </div>
                <div className="px-4 py-2 bg-white/5 text-gray-400 rounded-xl text-sm font-bold border border-white/10 italic">
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>
          </header>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statsCards.map((stat, index) => (
              <StatsCard key={index} {...stat} />
            ))}
          </div>

          {/* Navigation & Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <div className="bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-2xl md:rounded-[2rem] p-1 md:p-2 shadow-2xl sticky top-4 z-40 overflow-hidden">
              <TabsList className="bg-transparent border-0 p-0 h-auto flex flex-nowrap overflow-x-auto no-scrollbar gap-1 md:gap-2">
                {[
                  { id: 'overview', label: 'Overview', color: 'from-yellow-400 to-orange-500' },
                  { id: 'sellers', label: 'Sellers', color: 'from-blue-400 to-cyan-500' },
                  { id: 'buyers', label: 'Buyers', color: 'from-purple-400 to-indigo-500' },
                  { id: 'withdrawals', label: 'Withdrawals', color: 'from-green-400 to-emerald-500' },
                  { id: 'refunds', label: 'Refunds', color: 'from-red-400 to-rose-500' },
                  { id: 'clients', label: 'Clients', color: 'from-pink-400 to-fuchsia-500' }
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className={`flex-shrink-0 min-w-[100px] md:flex-1 rounded-xl md:rounded-2xl px-4 md:px-6 py-2.5 md:py-3.5 text-[10px] md:text-sm font-black transition-all duration-500
                    data-[state=active]:bg-gradient-to-r ${tab.color} data-[state=active]:text-black data-[state=active]:shadow-[0_0_20px_rgba(245,158,11,0.3)]
                    data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-white/5
                    uppercase tracking-widest`}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Modals Layer */}
            <div className="z-[100]">
              {/* Seller Details Modal */}
              {selectedSeller && (
                <div
                  className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-300 overflow-hidden z-[100]"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="seller-modal-title"
                >
                  <div className="bg-[#0A0A0A]/90 backdrop-blur-3xl border border-white/10 rounded-2xl md:rounded-[2.5rem] w-full max-w-6xl max-h-[95vh] flex flex-col shadow-[0_0_50px_rgba(245,158,11,0.1)] scale-in-95 duration-300">
                    <div className="flex items-center justify-between p-5 md:p-8 border-b border-white/10 bg-white/[0.02]">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 shadow-inner">
                          <Store className="h-7 w-7 text-yellow-500" />
                        </div>
                        <div>
                          <h3 id="seller-modal-title" className="text-2xl font-black text-white tracking-tight">{selectedSeller.shop_name || selectedSeller.name}</h3>
                          <p className="text-gray-400 font-medium">Verified Merchant Profile</p>
                        </div>
                      </div>
                      <button onClick={closeSellerModal} className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/10 group">
                        <X className="h-5 w-5 md:h-6 md:w-6 text-gray-400 group-hover:text-white group-hover:rotate-90 transition-all" />
                      </button>
                    </div>
                    <div className="overflow-auto flex-1 p-5 md:p-8 custom-scrollbar space-y-6 md:space-y-8">
                      {isLoadingSeller ? (
                        <div className="flex flex-col items-center justify-center h-60 space-y-4">
                          <Loader2 className="h-12 w-12 text-yellow-500 animate-spin" />
                          <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Accessing Encrypted Data...</p>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                            <Card className="bg-white/[0.02] border border-white/10 rounded-2xl md:rounded-[2rem] p-5 md:p-6">
                              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">Core Identity</h4>
                              <div className="space-y-4">
                                {[
                                  { label: 'Merchant Name', value: selectedSeller.name },
                                  { label: 'Email Protocol', value: selectedSeller.email },
                                  { label: 'Secure Line', value: selectedSeller.phone },
                                  { label: 'Operating Hub', value: selectedSeller.city },
                                  { label: 'Credit Reserve', value: `KSh ${parseFloat(selectedSeller.balance || 0).toLocaleString()}`, highlight: true }
                                ].map((item, i) => (
                                  <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                                    <span className="text-gray-500 text-sm font-medium">{item.label}</span>
                                    <span className={`text-sm font-bold ${item.highlight ? 'text-yellow-500' : 'text-gray-200'}`}>{item.value || 'N/A'}</span>
                                  </div>
                                ))}
                              </div>
                            </Card>
                            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                              {[
                                { label: 'Total Volume', value: selectedSeller.metrics?.totalSales, color: 'text-green-400', icon: <DollarSign className="h-4 w-4" /> },
                                { label: 'Platform Cut', value: selectedSeller.metrics?.totalCommission, color: 'text-yellow-400', icon: <Percent className="h-4 w-4" /> },
                                { label: 'Merchant Net', value: selectedSeller.metrics?.netSales, color: 'text-blue-400', icon: <TrendingUp className="h-4 w-4" /> },
                                { label: 'Order Chain', value: selectedSeller.metrics?.totalOrders, color: 'text-purple-400', icon: <ShoppingCart className="h-4 w-4" />, noCurrency: true }
                              ].map((met, i) => (
                                <div key={i} className="bg-white/[0.03] border border-white/5 rounded-3xl p-5 hover:bg-white/[0.05] transition-all">
                                  <div className={`h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center ${met.color} mb-3 shadow-inner`}>{met.icon}</div>
                                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{met.label}</p>
                                  <p className={`text-xl font-black mt-1 ${met.color}`}>
                                    {met.noCurrency ? met.value || 0 : `KSh ${(met.value || 0).toLocaleString()}`}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <Card className="bg-white/[0.02] border border-white/10 rounded-[2rem] overflow-hidden">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center">
                              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Marketplace Stream</h4>
                              <Badge className="bg-yellow-500/10 text-yellow-500 border-none px-4 py-1">REAL-TIME</Badge>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                <thead className="bg-white/[0.03] text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                  <tr>
                                    <th className="px-8 py-5">TXID</th>
                                    <th className="px-8 py-5">End User</th>
                                    <th className="px-8 py-5">Value</th>
                                    <th className="px-8 py-5">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {selectedSeller.recentOrders?.map((order: any) => (
                                    <tr key={order.id} className="text-sm hover:bg-white/[0.02] transition-colors">
                                      <td className="px-8 py-5 font-bold text-gray-400 text-xs tracking-tighter">#{order.orderNumber || String(order.id).slice(0, 12).toUpperCase()}</td>
                                      <td className="px-8 py-5 text-white font-medium">{order.buyerName}</td>
                                      <td className="px-8 py-5 text-white font-black italic">KSh {order.totalAmount?.toLocaleString()}</td>
                                      <td className="px-8 py-5">
                                        <Badge className={`${order.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'} border-none`}>
                                          {order.status}
                                        </Badge>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </Card>
                        </>
                      )}
                    </div>
                    <div className="p-8 border-t border-white/10 bg-white/[0.02] flex justify-end">
                      <Button onClick={closeSellerModal} className="bg-white text-black font-black uppercase tracking-widest px-10 py-4 rounded-2xl hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                        Flush Data
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Buyer Details Modal */}
              {selectedBuyer && (
                <div
                  className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-300 overflow-hidden z-[100]"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="buyer-modal-title"
                >
                  <div className="bg-[#0A0A0A]/90 backdrop-blur-3xl border border-white/10 rounded-2xl md:rounded-[2.5rem] w-full max-w-4xl max-h-[95vh] flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.1)] scale-in-95 duration-300">
                    <div className="flex items-center justify-between p-5 md:p-8 border-b border-white/10 bg-white/[0.02]">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 md:h-14 md:w-14 rounded-xl md:rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-inner">
                          <UserCircle className="h-5 w-5 md:h-7 md:w-7 text-cyan-500" />
                        </div>
                        <div>
                          <h3 id="buyer-modal-title" className="text-xl md:text-2xl font-black text-white tracking-tight">{selectedBuyer.name}</h3>
                          <p className="text-xs md:text-sm text-gray-400 font-medium">Customer Intelligence Report</p>
                        </div>
                      </div>
                      <button onClick={closeBuyerModal} className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/10 group">
                        <X className="h-5 w-5 md:h-6 md:w-6 text-gray-400 group-hover:text-white group-hover:rotate-90 transition-all" />
                      </button>
                    </div>
                    <div className="overflow-auto flex-1 p-5 md:p-8 custom-scrollbar space-y-6 md:space-y-8">
                      {isLoadingBuyer ? (
                        <div className="flex flex-col items-center justify-center h-60 space-y-4">
                          <Loader2 className="h-12 w-12 text-cyan-500 animate-spin" />
                          <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Analyzing User Patterns...</p>
                        </div>
                      ) : (
                        <>
                          <Card className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-8">
                            <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-8">Identity Protocol</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                              {[
                                { label: 'Full Legal Name', value: selectedBuyer.name },
                                { label: 'Primary Communications', value: selectedBuyer.email },
                                { label: 'Mobile Link', value: selectedBuyer.phone },
                                { label: 'Primary City', value: selectedBuyer.city },
                                { label: 'Last Known Location', value: selectedBuyer.location },
                                { label: 'Account Status', value: selectedBuyer.status, isBadge: true },
                                { label: 'Joined Network', value: safeFormatDate(selectedBuyer.createdAt) }
                              ].map((info, i) => (
                                <div key={i} className="flex justify-between items-center py-2 border-b border-white/5">
                                  <span className="text-gray-500 text-sm font-medium">{info.label}</span>
                                  {info.isBadge ? (
                                    <Badge className="bg-green-500/10 text-green-400 border-none">{info.value}</Badge>
                                  ) : (
                                    <span className="text-sm font-bold text-gray-200">{info.value || 'N/A'}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </Card>
                        </>
                      )}
                    </div>
                    <div className="p-8 border-t border-white/10 bg-white/[0.02] flex justify-end">
                      <Button onClick={closeBuyerModal} className="bg-white text-black font-black uppercase tracking-widest px-10 py-4 rounded-2xl hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                        Close Report
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              {/* Visual Analytics Layer */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <UserGrowthChart data={dashboardState.analytics.userGrowth || []} />
                <RevenueChart data={dashboardState.analytics.revenueTrends || []} />
                <SalesChart data={dashboardState.analytics.salesTrends || []} />
                <ProductStatusChart data={dashboardState.analytics.productStatus || []} />
                <GeoDistributionChart data={dashboardState.analytics.geoDistribution || []} />

                <ChartContainer title="Premium Entities" description="Top shops by client conversion" className="col-span-4 lg:col-span-2">
                  <div className="space-y-4 h-full flex flex-col justify-center">
                    {dashboardState.topShops?.slice(0, 3).map((shop, index) => (
                      <div key={shop.id} className="flex items-center justify-between p-5 bg-white/[0.03] rounded-[1.5rem] border border-white/5 hover:bg-white/10 transition-all duration-500 group/shop">
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black italic shadow-inner transition-transform group-hover/shop:scale-110 ${index === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                            index === 1 ? 'bg-gray-400/20 text-gray-400 border border-gray-400/30' :
                              'bg-orange-800/20 text-orange-600 border border-orange-800/30'
                            }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-lg font-bold text-white tracking-tight">{shop.shopName || shop.name}</p>
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1 opacity-50">{shop.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-black text-white tracking-tighter tabular-nums group-hover/shop:text-yellow-500 transition-colors">{shop.clientCount}</p>
                          <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest opacity-50">Pulse</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ChartContainer>

                <Card className="lg:col-span-4 bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
                  <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 md:p-8 border-b border-white/5 bg-white/[0.01] gap-4">
                    <div>
                      <CardTitle className="text-xl md:text-2xl font-black text-white tracking-tighter">Velocity Stream</CardTitle>
                      <CardDescription className="text-xs md:text-sm text-gray-400 font-medium">Recently authenticated merchants</CardDescription>
                    </div>
                    <Button variant="outline" className="border-white/10 text-yellow-500 hover:bg-yellow-500 hover:text-black rounded-xl font-black uppercase tracking-widest h-12 px-8 transition-all" onClick={() => setActiveTab('sellers')}>
                      Archive
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          <tr>
                            <th className="px-5 md:px-10 py-4 md:py-6">Operator</th>
                            <th className="px-5 md:px-10 py-4 md:py-6 text-center hidden sm:table-cell">Protocol Status</th>
                            <th className="px-5 md:px-10 py-4 md:py-6 text-right">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {dashboardState.sellers.slice(0, 5).map((seller) => (
                            <tr key={seller.id} className="hover:bg-white/[0.02] transition-all group">
                              <td className="px-5 md:px-10 py-4 md:py-6">
                                <div className="flex items-center gap-3 md:gap-5">
                                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-yellow-500/30 transition-all">
                                    <Store className="w-4 h-4 md:w-5 md:h-5 text-gray-500 group-hover:text-yellow-500 transition-all" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm md:text-base font-bold text-white tracking-tight truncate">{seller.name}</p>
                                    <p className="text-[10px] md:text-xs text-gray-500 font-medium italic opacity-60 truncate">{seller.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 md:px-10 py-4 md:py-6 text-center hidden sm:table-cell">
                                <Badge className={`px-3 md:px-5 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border-none ${seller.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                                  {seller.status}
                                </Badge>
                              </td>
                              <td className="px-5 md:px-10 py-4 md:py-6 text-right text-[10px] md:text-sm font-bold text-gray-400 tabular-nums">
                                {safeFormatDate(seller.createdAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
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
                                  onClick={() => handleDeleteUser(seller.id, 'seller')}
                                >
                                  <Lock className="h-3 md:h-3.5 w-3 md:w-3.5" />
                                  <span className="hidden sm:inline ml-2">Terminate</span>
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
                                  onClick={() => handleDeleteUser(buyer.id, 'buyer')}
                                >
                                  <Lock className="h-3 md:h-3.5 w-3 md:w-3.5" />
                                  <span className="hidden sm:inline ml-2">Suspend</span>
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
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        <tr>
                          <th className="px-5 md:px-8 py-4 md:py-6">Merchant Beneficiary</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 text-right sm:text-left">Capital Amount</th>
                          <th className="px-5 md:px-8 py-4 md:py-6 hidden xl:table-cell">Payout Endpoint</th>
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
                                  <p className="text-sm font-bold text-gray-300 font-mono">{request.mpesaNumber}</p>
                                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-50">{request.mpesaName}</p>
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
    </div>
  );
};

export default NewAdminDashboard;

