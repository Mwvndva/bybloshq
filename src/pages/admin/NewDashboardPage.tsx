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
import RefundRequestsPage from './RefundRequestsPage';

// Custom tooltip for the events chart
const EventsTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-800 p-4 border border-gray-700 rounded-lg shadow-lg">
        <p className="font-medium text-white">{data.fullDate || label}</p>
        <p className="text-sm text-gray-300">
          <span className="text-blue-400">Events:</span> {data.count.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

// Types
interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  trend: number | null;
}

interface MonthlyEventData {
  month: string;
  event_count: number;
}

interface DashboardAnalytics {
  totalRevenue?: number;
  totalEvents?: number;
  totalOrganizers?: number;
  totalProducts?: number;
  totalSellers?: number;
  totalBuyers?: number;
  monthlyGrowth?: {
    revenue?: number;
    events?: number;
    organizers?: number;
    products?: number;
    sellers?: number;
    buyers?: number;
    wishlists?: number;
  };
  totalWishlists?: number;
  userGrowth?: Array<{ name: string; buyers: number; sellers: number }>;
  revenueTrends?: Array<{ name: string; revenue: number; orders: number }>;
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
  recentEvents: Array<{
    id: string;
    title: string;
    date: string;
    end_date?: string;
    venue?: string;
    location?: string;
    status: string;
    organizer_name?: string;
    attendees_count?: number;
    revenue?: number;
    withdrawal_status?: string;
    withdrawal_date?: string;
    withdrawal_amount?: number;
  }>;
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
  organizers: Array<{
    id: string;
    name: string;
    email: string;
    phone?: string;
    status: string;
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
  monthlyEvents: MonthlyEventData[];
  monthlyMetrics: MonthlyMetricsData[];
  financialMetrics: FinancialMetrics;
  monthlyFinancialData: MonthlyFinancialData[];
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
      <CardDescription className="text-gray-400">Monthly revenue overview</CardDescription>
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
            <Bar dataKey="revenue" fill="#8884d8" radius={[4, 4, 0, 0]} name="Revenue (KSh)">
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

const ProductStatusChart = ({ data }: { data: any[] }) => (
  <Card className="col-span-4 lg:col-span-2 bg-gray-900/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
    <CardHeader className="relative z-10">
      <CardTitle className="text-white">Product Status</CardTitle>
      <CardDescription className="text-gray-400">Inventory overview</CardDescription>
    </CardHeader>
    <CardContent className="relative z-10">
      <div className="h-[300px] w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {data?.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={['#10b981', '#f43f5e', '#f59e0b', '#3b82f6'][index % 4]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }}
              itemStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
);

const GeoDistributionChart = ({ data }: { data: any[] }) => (
  <Card className="col-span-4 lg:col-span-2 bg-gray-900/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
    <CardHeader className="relative z-10">
      <CardTitle className="text-white">Top Cities</CardTitle>
      <CardDescription className="text-gray-400">Buyer distribution by city</CardDescription>
    </CardHeader>
    <CardContent className="relative z-10">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" stroke="#9ca3af" />
            <YAxis dataKey="name" type="category" stroke="#9ca3af" width={100} />
            <Tooltip
              cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#1f2937' }}
            />
            <Bar dataKey="value" fill="#0088FE" radius={[0, 4, 4, 0]} name="Buyers" />
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
  const [selectedEvent, setSelectedEvent] = useState<{ id: string, title: string } | null>(null);
  const [ticketBuyers, setTicketBuyers] = useState<Array<{
    id: string;
    name: string;
    email: string;
    ticketType: string;
    ticketTypeId: string;
    ticketStatus: string;
    isScanned: boolean;
    quantity: number;
    purchaseDate: string;
  }>>([]);
  const [ticketTypes, setTicketTypes] = useState<Record<string, string>>({});
  const [isLoadingBuyers, setIsLoadingBuyers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState<string | null>(null);

  // State for seller details modal
  const [selectedSeller, setSelectedSeller] = useState<any | null>(null);
  const [isLoadingSeller, setIsLoadingSeller] = useState(false);

  const [dashboardState, setDashboardState] = React.useState<DashboardState>({
    analytics: {
      totalRevenue: 0,
      totalEvents: 0,
      totalOrganizers: 0,
      totalProducts: 0,
      totalSellers: 0,
      totalBuyers: 0,
      monthlyGrowth: {
        revenue: 0,
        events: 0,
        organizers: 0,
        products: 0,
        sellers: 0,
        buyers: 0
      }
    },
    recentEvents: [],
    sellers: [],
    organizers: [],
    buyers: [],
    withdrawalRequests: [],
    monthlyEvents: [],
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
    monthlyFinancialData: []
  });

  // Fetch dashboard data in a separate effect
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    const fetchData = async () => {
      console.log('Starting to fetch dashboard data...');
      try {
        const [
          analytics,
          events,
          sellers,
          organizers,
          buyers,
          withdrawalRequests,
          monthlyEvents,
          monthlyMetrics,
          financialMetrics,
          monthlyFinancialData,
          dashboardStats
        ] = await Promise.all([
          adminApi.getAnalytics().then(data => {
            console.log('Analytics data received:', data);
            return data;
          }),
          adminApi.getEvents().then(data => {
            console.log('Events data received:', data);
            return data;
          }),
          adminApi.getSellers().then(data => {
            console.log('Sellers data received:', data);
            return data;
          }),
          adminApi.getOrganizers().then(data => {
            console.log('Organizers data received:', data);
            return data;
          }),
          adminApi.getBuyers().then(data => {
            console.log('Buyers data received:', data);
            return data;
          }),
          adminApi.getWithdrawalRequests().then(data => {
            console.log('Withdrawal requests data received:', data);
            return data;
          }),
          adminApi.getMonthlyEvents().then(data => {
            console.log('Monthly events data received:', data);
            return data;
          }),
          adminApi.getMonthlyMetrics().then(data => {
            console.log('Monthly metrics data received:', data);
            console.log('Monthly metrics data.data:', data?.data);
            return data;
          }),
          adminApi.getFinancialMetrics().then(data => {
            console.log('Financial metrics data received:', data);
            return data;
          }),
          adminApi.getMonthlyFinancialData().then(data => {
            console.log('Monthly financial data received:', data);
            return data;
          }),
          adminApi.getDashboardStats().then(data => {
            console.log('Dashboard stats received:', data);
            return data;
          })
        ]);

        // Ensure we have safe defaults if any data is missing
        const totalSellers = Array.isArray(sellers) ? sellers.length : 0;
        const totalBuyers = Array.isArray(buyers) ? buyers.length : 0;
        const safeAnalytics: DashboardAnalytics = {
          totalRevenue: financialMetrics?.totalSales || 0,
          totalEvents: dashboardStats?.totalEvents || events?.length || 0,
          totalOrganizers: dashboardStats?.totalOrganizers || organizers?.length || 0,
          totalProducts: dashboardStats?.totalProducts || 0,
          totalSellers: dashboardStats?.totalSellers || totalSellers,
          totalBuyers: dashboardStats?.totalBuyers || totalBuyers,
          totalWishlists: dashboardStats?.totalWishlists || 0,
          monthlyGrowth: {
            revenue: analytics?.monthlyGrowth?.revenue || 0,
            events: analytics?.monthlyGrowth?.events || 0,
            organizers: analytics?.monthlyGrowth?.organizers || 0,
            products: analytics?.monthlyGrowth?.products || 0,
            sellers: analytics?.monthlyGrowth?.sellers || 0,
            buyers: analytics?.monthlyGrowth?.buyers || 0
          }
        };

        console.log('Total sellers calculated:', totalSellers);

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
          recentEvents: Array.isArray(events) ? events.slice(0, 5) : [],
          sellers: Array.isArray(sellers) ? sellers : [],
          organizers: Array.isArray(organizers) ? organizers : [],
          buyers: Array.isArray(buyers) ? buyers : [],
          withdrawalRequests: Array.isArray(withdrawalRequests) ? (withdrawalRequests as WithdrawalRequest[]) : [],
          monthlyEvents: Array.isArray(monthlyEvents) ? monthlyEvents : [],
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
          monthlyFinancialData: Array.isArray(monthlyFinancialData) ? monthlyFinancialData : []
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setIsInitialized(true);
      }
    };

    fetchData();
  }, [authLoading, isAuthenticated]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/admin/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Helper function to determine if trend should be shown
  const shouldShowTrend = (trend: number) => {
    return trend !== 0 || dashboardState.analytics.monthlyGrowth?.revenue !== 0;
  };

  // Stats cards data with proper type safety
  const statsCards: StatsCardProps[] = [
    {
      title: 'Total Events',
      value: dashboardState.analytics.totalEvents.toLocaleString(),
      icon: <Calendar className="h-4 w-4 text-blue-500" />,
      description: 'Active events',
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.events ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.events ?? 0
        : null
    },
    {
      title: 'Total Organizers',
      value: dashboardState.analytics.totalOrganizers.toLocaleString(),
      icon: <Users className="h-4 w-4 text-green-500" />,
      description: 'Registered organizers',
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.organizers ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.organizers ?? 0
        : null
    },
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

  // Format event data for the chart
  const eventsData = useMemo(() => {
    // Always return an array, even if empty
    if (!dashboardState.monthlyEvents?.length) {
      return [];
    }

    try {
      // Format the data for the chart
      return dashboardState.monthlyEvents.map(event => ({
        name: new Date(event.month).toLocaleString('default', { month: 'short' }),
        fullDate: new Date(event.month).toLocaleString('default', { month: 'long', year: 'numeric' }),
        count: event.event_count || 0
      }));
    } catch (error) {
      console.error('Error formatting event data:', error);
      return [];
    }
  }, [dashboardState.monthlyEvents]);

  // Show loading state while checking auth or loading data
  if (authLoading || !isAuthenticated || !isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  // Loading and error states are already handled at the top of the component

  // Event categories data for pie chart
  const eventCategories = [
    { name: 'Music', value: 400 },
    { name: 'Sports', value: 300 },
    { name: 'Business', value: 300 },
    { name: 'Food & Drink', value: 200 },
    { name: 'Other', value: 100 },
  ];

  // Fetch ticket types for an event
  const fetchTicketTypes = async (eventId: string) => {
    try {
      console.log('Fetching ticket types for event:', eventId);
      const response = await adminApi.getEventTicketTypes(eventId);
      const types: Record<string, string> = {};

      // If no ticket types, log and return empty object
      if (!response.data?.ticketTypes || response.data.ticketTypes.length === 0) {
        console.warn('No ticket types found for event:', eventId);
        return {};
      }

      console.log('Received ticket types:', response.data.ticketTypes);

      // Create a mapping of ticket type IDs to their names
      response.data.ticketTypes.forEach((type: any) => {
        const typeId = type?.id?.toString();
        if (typeId && type?.name) {
          types[typeId] = type.name;
          console.log(`Mapped ticket type: ${typeId} -> ${type.name}`);
        }
      });

      setTicketTypes(types);
      return types;
    } catch (error) {
      console.warn('Error fetching ticket types, continuing without them:', error);
      return {};
    }
  };

  // Fetch ticket buyers for an event from the database
  const fetchTicketBuyers = async (eventId: string) => {
    try {
      setIsLoadingBuyers(true);
      setError(null);

      // Fetch ticket buyers from the API (now includes ticket type information)
      const response = await adminApi.getEventTicketBuyers(eventId);

      // Extract the tickets array from the response
      const tickets = response.data?.tickets || [];

      console.log('Fetched tickets with types:', tickets);

      // Transform the ticket data to match our expected format
      const buyers = tickets.map((ticket) => {
        // Use the ticket type information from the API response
        const ticketTypeName = ticket.ticketType?.displayName || ticket.ticketType?.name || 'General Admission';
        const ticketTypeId = ticket.ticketType?.id || 'unknown';

        // Log any tickets with missing type information for debugging
        if (!ticket.ticketType) {
          console.warn('Ticket is missing type information:', ticket);
        }

        return {
          id: ticket.id?.toString() || Math.random().toString(36).substr(2, 9),
          name: ticket.customerName || 'Anonymous',
          email: ticket.customerEmail || 'No email provided',
          ticketType: ticketTypeName,
          ticketTypeId: ticketTypeId || 'general',
          ticketStatus: ticket.status || 'Valid',
          isScanned: ticket.scanned || false,
          quantity: 1, // Default to 1 since we're dealing with individual tickets
          purchaseDate: new Date(ticket.createdAt || new Date()).toISOString()
        };
      });

      setTicketBuyers(buyers);
    } catch (error: any) {
      console.error('Error fetching ticket buyers:', error);
      setError(error.message || 'Failed to load ticket buyers');
    } finally {
      setIsLoadingBuyers(false);
    }
  };

  // Handle view button click
  const handleViewEvent = (event: { id: string, title: string }) => {
    setSelectedEvent(event);
    fetchTicketBuyers(event.id);
  };

  // Close ticket buyers modal
  const closeTicketBuyersModal = () => {
    setSelectedEvent(null);
    setTicketBuyers([]);
    setTicketTypes({});
  };

  // Mark event as paid
  const handleMarkAsPaid = async (eventId: string) => {
    try {
      setIsMarkingPaid(eventId);

      const response = await adminApi.markEventAsPaid(eventId, 'manual', {});

      if (response.status === 'success') {
        // Update the event in the dashboard state
        setDashboardState(prevState => ({
          ...prevState,
          recentEvents: prevState.recentEvents.map(event =>
            event.id === eventId
              ? {
                ...event,
                withdrawal_status: response.data.withdrawal_status as 'paid',
                withdrawal_date: response.data.withdrawal_date,
                withdrawal_amount: response.data.withdrawal_amount
              }
              : event
          )
        }));
        toast.success('Event marked as paid successfully');
      }
    } catch (error) {
      console.error('Error marking event as paid:', error);
      toast.error('Failed to mark event as paid');
    } finally {
      setIsMarkingPaid(null);
    }
  };

  // Handle viewing organizer details
  const handleViewOrganizer = (organizerId: string) => {
    // Navigate to organizer details page or show a modal
    // For now, we'll just log the ID and show a toast
    console.log('Viewing organizer:', organizerId);
    toast.info(`Viewing organizer ID: ${organizerId}`);

    // If you have a dedicated organizer details page, you can navigate there:
    // navigate(`/admin/organizers/${organizerId}`);
  };

  // Handle toggling organizer status (active/inactive)
  const handleToggleOrganizerStatus = async (organizerId: string, newStatus: 'active' | 'inactive') => {
    try {
      // Call the API to update the organizer status
      const response = await adminApi.updateOrganizerStatus(organizerId, { status: newStatus });

      if (response.status === 'success') {
        // Update the UI to reflect the new status
        setDashboardState(prevState => ({
          ...prevState,
          organizers: prevState.organizers.map(organizer =>
            organizer.id === organizerId
              ? { ...organizer, status: newStatus }
              : organizer
          )
        }));

        // Show success message
        toast.success(`Organizer has been ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      }
    } catch (error) {
      console.error('Error updating organizer status:', error);
      toast.error('Failed to update organizer status');
    }
  };

  // Handle viewing seller details
  const handleViewSeller = async (sellerId: string) => {
    try {
      setIsLoadingSeller(true);
      const response = await adminApi.getSellerById(sellerId);
      setSelectedSeller(response.data);
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

      if (response.status === 'success') {
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
  const handleViewBuyer = (buyerId: string) => {
    // Navigate to buyer details page or show a modal
    // For now, we'll just log the ID and show a toast
    console.log('Viewing buyer:', buyerId);
    toast.info(`Viewing buyer ID: ${buyerId}`);

    // If you have a dedicated buyer details page, you can navigate there:
    // navigate(`/admin/buyers/${buyerId}`);
  };

  // Handle toggling buyer status (active/inactive)
  const handleToggleBuyerStatus = async (buyerId: string, newStatus: 'active' | 'inactive') => {
    try {
      // Call the API to update the buyer status
      const response = await adminApi.updateBuyerStatus(buyerId, { status: newStatus });

      if (response.status === 'success') {
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

      if (response.status === 'success') {
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Spinner className="h-8 w-8 text-yellow-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate('/admin/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden p-4 md:p-8">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-yellow-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-500/10 blur-[120px]" />
      </div>
      {/* Ticket Buyers Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-2xl bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30">
                  <Users className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Ticket Buyers
                  </h3>
                  <p className="text-sm text-gray-400">
                    {selectedEvent.title}
                  </p>
                </div>
              </div>
              <button
                onClick={closeTicketBuyersModal}
                className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors duration-200 border border-white/5"
              >
                <X className="h-5 w-5 text-gray-400 group-hover:text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-auto flex-1 p-6 custom-scrollbar">
              {isLoadingBuyers ? (
                <div className="flex flex-col items-center justify-center h-40 space-y-4">
                  <div className="h-12 w-12 rounded-2xl bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30 animate-pulse">
                    <Loader2 className="h-6 w-6 text-yellow-500 animate-spin" />
                  </div>
                  <p className="text-gray-400 font-medium">Loading ticket buyers...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-40 space-y-4">
                  <div className="h-12 w-12 rounded-2xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
                    <X className="h-6 w-6 text-red-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-red-400 font-semibold">Error loading ticket buyers</p>
                    <p className="text-gray-500 text-sm mt-1">{error}</p>
                  </div>
                </div>
              ) : ticketBuyers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 space-y-4">
                  <div className="h-12 w-12 rounded-2xl bg-gray-800 flex items-center justify-center border border-white/10">
                    <Users className="h-6 w-6 text-gray-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-gray-300 font-semibold">No ticket buyers found</p>
                    <p className="text-gray-500 text-sm mt-1">This event doesn't have any ticket purchases yet.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-500/10 rounded-2xl p-4 border border-blue-500/20 hover:bg-blue-500/15 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
                          <Users className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm text-blue-400 font-medium">Total Buyers</p>
                          <p className="text-lg font-bold text-white">{ticketBuyers.length}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-500/10 rounded-2xl p-4 border border-green-500/20 hover:bg-green-500/15 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-xl bg-green-500/20 flex items-center justify-center">
                          <Ticket className="h-4 w-4 text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm text-green-400 font-medium">Total Tickets</p>
                          <p className="text-lg font-bold text-white">
                            {ticketBuyers.reduce((sum, buyer) => sum + buyer.quantity, 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-purple-500/10 rounded-2xl p-4 border border-purple-500/20 hover:bg-purple-500/15 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm text-purple-400 font-medium">Scanned</p>
                          <p className="text-lg font-bold text-white">
                            {ticketBuyers.filter(buyer => buyer.isScanned).length}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-yellow-500/10 rounded-2xl p-4 border border-yellow-500/20 hover:bg-yellow-500/15 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                          <Activity className="h-4 w-4 text-yellow-500" />
                        </div>
                        <div>
                          <p className="text-sm text-yellow-500 font-medium">Valid Tickets</p>
                          <p className="text-lg font-bold text-white">
                            {ticketBuyers.filter(buyer => buyer.ticketStatus === 'Valid').length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-white/5">
                          <tr className="text-left text-sm text-gray-400 border-b border-white/10">
                            <th className="px-6 py-4 font-semibold">Buyer</th>
                            <th className="px-6 py-4 font-semibold">Contact</th>
                            <th className="px-6 py-4 font-semibold text-center">Ticket Type</th>
                            <th className="px-6 py-4 font-semibold text-center">Status</th>
                            <th className="px-6 py-4 font-semibold text-center">Scanned</th>
                            <th className="px-6 py-4 font-semibold text-center">Quantity</th>
                            <th className="px-6 py-4 font-semibold text-right">Purchase Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {ticketBuyers.map((buyer) => (
                            <tr key={buyer.id} className="hover:bg-white/5 transition-colors duration-200">
                              <td className="px-6 py-4">
                                <div className="flex items-center space-x-3">
                                  <div className="h-8 w-8 rounded-xl bg-gray-800 flex items-center justify-center border border-white/10">
                                    <User className="h-4 w-4 text-gray-400" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-white">{buyer.name}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-gray-400">{buyer.email}</p>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Badge
                                  variant="outline"
                                  className={
                                    buyer.ticketType === 'General Admission'
                                      ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                      : buyer.ticketType === 'VIP'
                                        ? 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                                        : 'bg-gray-500/10 text-gray-400 border-white/10'
                                  }
                                >
                                  {buyer.ticketType}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Badge
                                  variant="outline"
                                  className={
                                    buyer.ticketStatus === 'Valid'
                                      ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                      : buyer.ticketStatus === 'Used'
                                        ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                        : 'bg-gray-500/10 text-gray-400 border-white/10'
                                  }
                                >
                                  {buyer.ticketStatus}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Badge
                                  variant="outline"
                                  className={
                                    buyer.isScanned
                                      ? 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                                      : 'bg-gray-500/10 text-gray-400 border-white/10'
                                  }
                                >
                                  {buyer.isScanned ? 'Yes' : 'No'}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-white/5 text-white font-semibold text-sm border border-white/10">
                                  {buyer.quantity}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <p className="text-gray-300 text-sm">
                                  {format(new Date(buyer.purchaseDate), 'MMM d, yyyy')}
                                </p>
                                <p className="text-gray-500 text-xs">
                                  {format(new Date(buyer.purchaseDate), 'h:mm a')}
                                </p>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10 flex justify-between items-center">
              <div className="text-sm text-gray-400">
                Showing <span className="font-semibold text-white">{ticketBuyers.length}</span> ticket buyers
              </div>
              <Button
                onClick={closeTicketBuyersModal}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-6 py-2 rounded-2xl shadow-lg shadow-yellow-500/20 transition-all duration-200"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

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
                        <p className="text-sm text-gray-500 font-medium">Member Since</p>
                        <p className="text-base text-gray-200">{format(new Date(selectedSeller.createdAt), 'MMM d, yyyy')}</p>
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
                                <p className="text-xs text-gray-500">{format(new Date(order.createdAt), 'MMM d, yyyy h:mm a')}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-white">KSh {order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
        </div>
      )}

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
                value="events"
                className="rounded-2xl px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-600 data-[state=active]:text-black data-[state=active]:shadow-lg text-gray-600 hover:text-black hover:bg-white/50 transition-all duration-300 font-semibold whitespace-nowrap"
              >
                Events
              </TabsTrigger>
              <TabsTrigger
                value="organizers"
                className="rounded-2xl px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base data-[state=active]:bg-gray-800 data-[state=active]:text-white data-[state=active]:border data-[state=active]:border-white/10 data-[state=active]:shadow-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-300 font-semibold whitespace-nowrap"
              >
                Organizers
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
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Events Chart */}
                <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                  <CardHeader className="pb-3 sm:pb-4 relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-white text-lg sm:text-xl font-bold">Monthly Event Counts</CardTitle>
                        <CardDescription className="text-xs sm:text-sm text-gray-400">Monthly event counts performance</CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center">
                          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-blue-500 mr-1.5 sm:mr-2"></div>
                          <span className="text-xs text-gray-400 font-medium">Events</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 relative z-10">
                    <div className="h-[300px] w-full">
                      {eventsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={eventsData}>
                            <defs>
                              <linearGradient id="eventBarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                            <XAxis
                              dataKey="name"
                              stroke="#9CA3AF"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                              tickMargin={10}
                            />
                            <YAxis
                              stroke="#9CA3AF"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                              tickMargin={10}
                              width={30}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1F2937',
                                border: '1px solid #374151',
                                borderRadius: '0.5rem',
                                padding: '0.75rem',
                              }}
                              labelStyle={{ color: '#E5E7EB', fontWeight: '500' }}
                              itemStyle={{ color: '#E5E7EB', padding: '4px 0' }}
                            />
                            <Bar
                              dataKey="count"
                              fill="url(#eventBarGradient)"
                              radius={[4, 4, 0, 0]}
                              barSize={24}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-300">
                          No event data available
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Metrics Chart */}
                <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                  <CardHeader className="pb-4 relative z-10">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-white text-xl font-bold">Monthly Metrics</CardTitle>
                        <CardDescription className="text-gray-400 text-sm">Sellers, Products & Buyers Performance</CardDescription>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                          <span className="text-xs text-gray-400 font-medium">Sellers</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                          <span className="text-xs text-gray-400 font-medium">Products</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="h-[300px] w-full">
                      {metricsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={metricsData}>
                            <defs>
                              <linearGradient id="colorSellers" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.1} />
                              </linearGradient>
                              <linearGradient id="colorProducts" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4ade80" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#4ade80" stopOpacity={0.1} />
                              </linearGradient>
                              <linearGradient id="colorBuyers" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#9CA3AF', fontSize: 12 }}
                              tickMargin={10}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#9CA3AF', fontSize: 12 }}
                              tickMargin={10}
                              width={50}
                              tickFormatter={(value) => value.toLocaleString()}
                              domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]}
                            />
                            <Tooltip
                              content={<MetricsTooltip />}
                              cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }}
                            />
                            <Legend
                              wrapperStyle={{ paddingTop: '20px' }}
                              iconType="line"
                              formatter={(value) => (
                                <span style={{ color: '#9CA3AF', fontSize: '12px' }}>
                                  {value.charAt(0).toUpperCase() + value.slice(1)}
                                </span>
                              )}
                            />
                            <Line
                              type="monotone"
                              dataKey="sellers"
                              stroke="#a78bfa"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 6, stroke: '#7c3aed', strokeWidth: 2, fill: '#a78bfa' }}
                            />
                            <Line
                              type="monotone"
                              dataKey="products"
                              stroke="#4ade80"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 6, stroke: '#16a34a', strokeWidth: 2, fill: '#4ade80' }}
                            />
                            <Line
                              type="monotone"
                              dataKey="buyers"
                              stroke="#06b6d4"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 6, stroke: '#0891b2', strokeWidth: 2, fill: '#06b6d4' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-gray-300">No metrics data available</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Product & Geo Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <ProductStatusChart data={dashboardState.analytics.productStatus || []} />
                <GeoDistributionChart data={dashboardState.analytics.geoDistribution || []} />
              </div>

              {/* Financial Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Sales & Commission Chart */}
                <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                  <CardHeader className="pb-4 relative z-10">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-white text-xl font-bold">Sales & Commission</CardTitle>
                        <CardDescription className="text-gray-400 text-sm">Monthly sales and platform commission</CardDescription>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                          <span className="text-xs text-gray-400 font-medium">Sales</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                          <span className="text-xs text-gray-400 font-medium">Commission</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="h-[300px] w-full">
                      {dashboardState.monthlyFinancialData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dashboardState.monthlyFinancialData.map(d => ({
                            name: new Date(d.month).toLocaleString('default', { month: 'short' }),
                            fullDate: new Date(d.month).toLocaleString('default', { month: 'long', year: 'numeric' }),
                            sales: d.sales,
                            commission: d.commission
                          }))}>
                            <defs>
                              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                              </linearGradient>
                              <linearGradient id="colorCommission" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#eab308" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#eab308" stopOpacity={0.1} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#9CA3AF', fontSize: 12 }}
                              tickMargin={10}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#9CA3AF', fontSize: 12 }}
                              tickMargin={10}
                              width={80}
                              tickFormatter={(value) => {
                                if (value >= 1000000) {
                                  return `KSh ${(value / 1000000).toFixed(1)}M`;
                                } else if (value >= 1000) {
                                  return `KSh ${(value / 1000).toFixed(0)}k`;
                                } else {
                                  return `KSh ${value.toLocaleString()}`;
                                }
                              }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1F2937',
                                border: '1px solid #374151',
                                borderRadius: '0.5rem',
                                padding: '0.75rem',
                              }}
                              labelStyle={{ color: '#E5E7EB', fontWeight: '500' }}
                              itemStyle={{ color: '#E5E7EB', padding: '4px 0' }}
                              formatter={(value: number) => `KSh ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            />
                            <Legend
                              wrapperStyle={{ paddingTop: '20px' }}
                              iconType="line"
                            />
                            <Line
                              type="monotone"
                              dataKey="sales"
                              stroke="#22c55e"
                              strokeWidth={3}
                              dot={false}
                              activeDot={{ r: 6, stroke: '#16a34a', strokeWidth: 2, fill: '#22c55e' }}
                            />
                            <Line
                              type="monotone"
                              dataKey="commission"
                              stroke="#eab308"
                              strokeWidth={3}
                              dot={false}
                              activeDot={{ r: 6, stroke: '#ca8a04', strokeWidth: 2, fill: '#eab308' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-gray-300">No financial data available</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Refunds Chart */}
                <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                  <CardHeader className="pb-4 relative z-10">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-white text-xl font-bold">Monthly Refunds</CardTitle>
                        <CardDescription className="text-gray-400 text-sm">Completed refund requests over time</CardDescription>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                        <span className="text-xs text-gray-400 font-medium">Refunds</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="h-[300px] w-full">
                      {dashboardState.monthlyFinancialData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dashboardState.monthlyFinancialData.map(d => ({
                            name: new Date(d.month).toLocaleString('default', { month: 'short' }),
                            fullDate: new Date(d.month).toLocaleString('default', { month: 'long', year: 'numeric' }),
                            refunds: d.refunds
                          }))}>
                            <defs>
                              <linearGradient id="colorRefunds" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#9CA3AF', fontSize: 12 }}
                              tickMargin={10}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#9CA3AF', fontSize: 12 }}
                              tickMargin={10}
                              width={80}
                              tickFormatter={(value) => {
                                if (value >= 1000000) {
                                  return `KSh ${(value / 1000000).toFixed(1)}M`;
                                } else if (value >= 1000) {
                                  return `KSh ${(value / 1000).toFixed(0)}k`;
                                } else {
                                  return `KSh ${value.toLocaleString()}`;
                                }
                              }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1F2937',
                                border: '1px solid #374151',
                                borderRadius: '0.5rem',
                                padding: '0.75rem',
                              }}
                              labelStyle={{ color: '#E5E7EB', fontWeight: '500' }}
                              itemStyle={{ color: '#E5E7EB', padding: '4px 0' }}
                              formatter={(value: number) => `KSh ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            />
                            <Legend
                              wrapperStyle={{ paddingTop: '20px' }}
                              iconType="line"
                            />
                            <Line
                              type="monotone"
                              dataKey="refunds"
                              stroke="#ef4444"
                              strokeWidth={3}
                              dot={false}
                              activeDot={{ r: 6, stroke: '#dc2626', strokeWidth: 2, fill: '#ef4444' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-gray-300">No refunds data available</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Events */}
              <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                <CardHeader className="pb-4 relative z-10">
                  <CardTitle className="text-white text-xl font-bold">Recent Events</CardTitle>
                  <CardDescription className="text-gray-400 text-sm">Latest events created in the system</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 relative z-10">
                  <div className="space-y-4">
                    {dashboardState.recentEvents?.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start justify-between p-6 border border-white/10 rounded-2xl hover:bg-white/5 transition-all duration-300 hover:shadow-lg group bg-black/20"
                      >
                        <div className="flex items-start space-x-4">
                          <div className="p-3 bg-gray-800 rounded-2xl shadow-lg shadow-black/20 group-hover:scale-110 transition-transform duration-300 border border-white/5">
                            <Calendar className="h-5 w-5 text-yellow-500" />
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-lg">{event.title}</h4>
                            <p className="text-sm text-gray-400 mt-1">
                              {(event.date && !isNaN(new Date(event.date).getTime())) ? format(new Date(event.date), 'MMM d, yyyy') : 'Invalid date'} • {event.venue}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`${event.status === 'active'
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                            } rounded-full px-3 py-1 font-semibold`}
                        >
                          {event.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="border-t border-white/10 p-6 relative z-10">
                  <Button
                    variant="ghost"
                    className="text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 text-sm font-semibold rounded-xl px-4 py-2"
                  >
                    View all events
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-4 sm:space-y-6">
            <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <CardHeader className="pb-3 sm:pb-4 relative z-10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-bold text-white">Events</CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-gray-400">Manage all events in the system</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search events..."
                      className="pl-10 w-full text-sm sm:text-base sm:w-[250px] md:w-[300px] h-10 sm:h-11 bg-black/20 border-white/10 text-white placeholder:text-gray-500 focus:border-yellow-500/50 focus:ring-yellow-500/20"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-white/10">
                      <thead className="bg-gray-800/50">
                        <tr className="border-b border-white/10">
                          <th className="py-3 px-3 sm:px-4 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Event</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Organizer</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Date</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Status</th>
                          <th className="py-3 pr-3 sm:pr-4 text-right text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {dashboardState.recentEvents?.map((event) => (
                          <tr key={event.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-4 text-white font-bold">{event.title}</td>
                            <td className="py-4 text-gray-300 hidden sm:table-cell">{event.organizer_name || 'N/A'}</td>
                            <td className="py-4 text-gray-300 whitespace-nowrap">{format(new Date(event.date), 'MMM d, yyyy')}</td>
                            <td className="py-4 hidden md:table-cell">
                              <Badge
                                variant="outline"
                                className={
                                  event.status === 'active'
                                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                    : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                }
                              >
                                {event.status}
                              </Badge>
                            </td>
                            <td className="py-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 rounded-xl px-3 py-2"
                                  onClick={() => handleViewEvent({ id: event.id, title: event.title })}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View
                                </Button>
                                {event.withdrawal_status !== 'paid' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-500 hover:bg-green-500/10 hover:text-green-400 rounded-xl px-3 py-2"
                                    onClick={() => handleMarkAsPaid(event.id)}
                                    disabled={isMarkingPaid === event.id}
                                  >
                                    {isMarkingPaid === event.id ? (
                                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                    ) : (
                                      <DollarSign className="w-4 h-4 mr-1" />
                                    )}
                                    Paid
                                  </Button>
                                )}
                                {event.withdrawal_status === 'paid' && (
                                  <Badge
                                    variant="outline"
                                    className="bg-green-500/10 text-green-400 border-green-500/20 font-medium"
                                  >
                                    Paid
                                  </Badge>
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
              <CardFooter className="border-t border-white/10 px-6 py-4 relative z-10">
                <div className="flex items-center justify-between w-full text-sm text-gray-400">
                  <div className="text-sm text-gray-400">
                    Showing <span className="text-white font-bold">{dashboardState.recentEvents?.length || 0}</span> of {dashboardState.recentEvents?.length || 0} events
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm" disabled={true} className="text-gray-500 hover:bg-white/5 h-8 w-8 p-0 rounded-xl">
                      &larr;
                    </Button>
                    <Button variant="ghost" size="sm" className="bg-yellow-500/20 text-yellow-500 h-8 w-8 p-0 rounded-xl font-semibold border border-yellow-500/20">
                      1
                    </Button>
                    <Button variant="ghost" size="sm" className="text-gray-500 hover:bg-white/5 h-8 w-8 p-0 rounded-xl">
                      &rarr;
                    </Button>
                  </div>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Organizers Tab */}
          <TabsContent value="organizers" className="space-y-4 sm:space-y-6">
            <Card className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <CardHeader className="pb-3 sm:pb-4 relative z-10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-bold text-white">Organizers</CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-gray-400">
                      Manage all event organizers in the platform
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search organizers..."
                      className="pl-10 w-full text-sm sm:text-base sm:w-[250px] md:w-[300px] h-10 sm:h-11 bg-black/20 border-white/10 text-white placeholder:text-gray-500 focus:border-yellow-500/50 focus:ring-yellow-500/20"
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
                          <th className="py-3 px-3 sm:px-4 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Organizer</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Contact</th>
                          <th className="py-3 px-2 sm:px-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Status</th>
                          <th className="py-3 pr-3 sm:pr-4 text-right text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {dashboardState.organizers?.map((organizer) => (
                          <tr key={organizer.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-3 sm:px-4">
                              <div className="font-medium text-white">{organizer.name}</div>
                              <div className="sm:hidden text-xs text-gray-400 mt-1">
                                <div>{organizer.email}</div>
                                {organizer.phone && <div>{organizer.phone}</div>}
                              </div>
                            </td>
                            <td className="py-3 px-2 sm:px-3 text-sm text-gray-300 hidden sm:table-cell">
                              <div>{organizer.email}</div>
                              {organizer.phone && (
                                <div className="text-xs text-gray-400">{organizer.phone}</div>
                              )}
                            </td>
                            <td className="py-3 px-2 sm:px-3 hidden md:table-cell">
                              <Badge
                                variant="outline"
                                className={
                                  organizer.status === 'active'
                                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                    : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                }
                              >
                                {organizer.status}
                              </Badge>
                            </td>
                            <td className="py-3 pr-3 sm:pr-4 text-right">
                              <div className="flex items-center justify-end space-x-1 sm:space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 h-8 px-2 sm:px-3 text-xs sm:text-sm"
                                  onClick={() => handleViewOrganizer(organizer.id)}
                                >
                                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                  <span className="hidden sm:inline">View</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`h-8 px-2 sm:px-3 text-xs sm:text-sm ${organizer.status === 'active'
                                    ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                    : 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
                                    }`}
                                  onClick={() => handleToggleOrganizerStatus(organizer.id, organizer.status === 'active' ? 'inactive' : 'active')}
                                >
                                  {organizer.status === 'active' ? (
                                    <>
                                      <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                      <span className="hidden sm:inline">Block</span>
                                    </>
                                  ) : (
                                    <>
                                      <Unlock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                      <span className="hidden sm:inline">Unblock</span>
                                    </>
                                  )}
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
                    Showing <span className="font-medium">1</span> to <span className="font-medium">{dashboardState.organizers?.length || 0}</span> of{' '}
                    <span className="font-medium">{dashboardState.organizers?.length || 0}</span> organizers
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
                      className="pl-10 w-full text-sm sm:text-base sm:w-[250px] md:w-[300px] h-10 sm:h-11 bg-black/20 border-white/10 text-white placeholder:text-gray-500 focus:border-yellow-500/50 focus:ring-yellow-500/20"
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
                                  className={`h-8 px-2 sm:px-3 text-xs sm:text-sm ${seller.status === 'active'
                                    ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                    : 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
                                    }`}
                                  onClick={() => handleToggleSellerStatus(seller.id, seller.status === 'active' ? 'inactive' : 'active')}
                                >
                                  {seller.status === 'active' ? (
                                    <>
                                      <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                      <span className="hidden sm:inline">Block</span>
                                    </>
                                  ) : (
                                    <>
                                      <Unlock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                      <span className="hidden sm:inline">Unblock</span>
                                    </>
                                  )}
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
                      className="pl-10 w-full text-sm sm:text-base sm:w-[250px] md:w-[300px] h-10 sm:h-11 bg-black/20 border-white/10 text-white placeholder:text-gray-500 focus:border-yellow-500/50 focus:ring-yellow-500/20"
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
                                  className={`h-8 px-2 sm:px-3 text-xs sm:text-sm ${buyer.status === 'active'
                                    ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                    : 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
                                    }`}
                                  onClick={() => handleToggleBuyerStatus(buyer.id, buyer.status === 'active' ? 'inactive' : 'active')}
                                >
                                  {buyer.status === 'active' ? (
                                    <>
                                      <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                      <span className="hidden sm:inline">Block</span>
                                    </>
                                  ) : (
                                    <>
                                      <Unlock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                      <span className="hidden sm:inline">Unblock</span>
                                    </>
                                  )}
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
                      className="pl-10 w-full text-sm sm:text-base sm:w-[250px] md:w-[300px] h-10 sm:h-11 bg-black/20 border-white/10 text-white placeholder:text-gray-500 focus:border-yellow-500/50 focus:ring-yellow-500/20"
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
                              <div>{new Date(request.createdAt).toLocaleDateString()}</div>
                              <div className="text-xs text-gray-400">{new Date(request.createdAt).toLocaleTimeString()}</div>
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

          {/* Refunds Tab */}
          <TabsContent value="refunds" className="space-y-4 sm:space-y-6">
            <RefundRequestsPage />
          </TabsContent>
        </Tabs>
      </div>
    </div >
  );
};

export default NewAdminDashboard;

