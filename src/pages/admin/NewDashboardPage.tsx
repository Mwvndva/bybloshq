
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Clock, Users, Ticket, User, ShoppingCart, DollarSign, Activity, Store, UserPlus, Eye, MoreHorizontal, Loader2, Plus, Package, X, ShoppingBag, UserCheck, Box, Shield, UserCircle } from 'lucide-react';
import { adminApi } from '@/api/adminApi';
import { format } from 'date-fns';

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
  trend: number;
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
  };
}

interface MonthlyMetricsData {
  month: string;
  sellerCount: number;
  productCount: number;
  buyerCount: number;
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
  monthlyEvents: MonthlyEventData[];
  monthlyMetrics: MonthlyMetricsData[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// StatsCard Component
const StatsCard = React.memo(({ title, value, icon, description, trend }: StatsCardProps) => {
  const isPositive = trend >= 0;
  const trendColor = isPositive ? 'text-green-600' : 'text-red-600';
  const trendIcon = isPositive ? '↗' : '↘';

  return (
    <Card className="bg-white/80 backdrop-blur-xl border border-white/20 hover:border-yellow-400/50 transition-all duration-300 hover:shadow-xl rounded-3xl overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/5 via-transparent to-yellow-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700">
          {title}
        </CardTitle>
        <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="text-3xl font-black text-black mb-2">{value}</div>
        <p className="text-xs text-gray-600">
          <span className={`${trendColor} font-semibold`}>
            {trendIcon} {Math.abs(trend)}%
          </span>{' '}
          <span className="text-gray-500">vs last month</span>
        </p>
      </CardContent>
    </Card>
  );
});

// Main Dashboard Component
// Format date for display with proper validation
const formatDate = (dateString: string | Date | undefined | null): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) ? format(date, 'MMM d, yyyy h:mm a') : 'N/A';
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'N/A';
  }
};

const NewAdminDashboard = () => {
  // All hooks must be called unconditionally at the top level
  const { isAuthenticated, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize state for dashboard data with proper typing
  // State for ticket buyers modal
  const [selectedEvent, setSelectedEvent] = useState<{id: string, title: string} | null>(null);
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
    monthlyEvents: [],
    monthlyMetrics: []
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
          monthlyEvents,
          monthlyMetrics
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
          adminApi.getMonthlyEvents().then(data => {
            console.log('Monthly events data received:', data);
            return data;
          }),
          adminApi.getMonthlyMetrics().then(data => {
            console.log('Monthly metrics data received:', data);
            console.log('Monthly metrics data.data:', data?.data);
            return data;
          })
        ]);

        // Ensure we have safe defaults if any data is missing
        const totalSellers = Array.isArray(sellers) ? sellers.length : 0;
        const totalBuyers = Array.isArray(buyers) ? buyers.length : 0;
        const safeAnalytics: DashboardAnalytics = {
          totalRevenue: analytics?.totalRevenue || 0,
          totalEvents: analytics?.totalEvents || 0,
          totalOrganizers: analytics?.totalOrganizers || 0,
          totalProducts: analytics?.totalProducts || 0,
          totalSellers: totalSellers,
          totalBuyers: totalBuyers,
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
          monthlyEvents: Array.isArray(monthlyEvents) ? monthlyEvents : [],
          monthlyMetrics: metricsData
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

  // Stats cards data with proper type safety
  const statsCards: StatsCardProps[] = [
    {
      title: 'Total Events',
      value: dashboardState.analytics.totalEvents.toLocaleString(),
      icon: <Calendar className="h-4 w-4 text-blue-500" />,
      description: 'Active events',
      trend: dashboardState.analytics.monthlyGrowth?.events ?? 0
    },
    {
      title: 'Total Organizers',
      value: dashboardState.analytics.totalOrganizers.toLocaleString(),
      icon: <Users className="h-4 w-4 text-green-500" />,
      description: 'Registered organizers',
      trend: dashboardState.analytics.monthlyGrowth?.organizers ?? 0
    },
    {
      title: 'Total Products',
      value: dashboardState.analytics.totalProducts.toLocaleString(),
      icon: <Package className="h-4 w-4 text-orange-500" />,
      description: 'Available products',
      trend: dashboardState.analytics.monthlyGrowth?.products ?? 0
    },
    {
      title: 'Total Sellers',
      value: dashboardState.analytics.totalSellers?.toLocaleString() || '0',
      icon: <ShoppingCart className="h-4 w-4 text-purple-500" />,
      description: 'Active sellers',
      trend: dashboardState.analytics.monthlyGrowth?.sellers ?? 0
    },
    {
      title: 'Total Buyers',
      value: dashboardState.analytics.totalBuyers?.toLocaleString() || '0',
      icon: <UserCircle className="h-4 w-4 text-cyan-500" />,
      description: 'Registered buyers',
      trend: dashboardState.analytics.monthlyGrowth?.buyers ?? 0
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
  const handleViewEvent = (event: {id: string, title: string}) => {
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
                  withdrawal_status: 'paid',
                  withdrawal_date: response.data.event.withdrawal_date,
                  withdrawal_amount: response.data.event.withdrawal_amount
                }
              : event
          )
        }));
        
        // Show success message (you can add a toast here if needed)
        console.log('Event marked as paid successfully');
      }
    } catch (error: any) {
      console.error('Error marking event as paid:', error);
      // Show error message (you can add a toast here if needed)
    } finally {
      setIsMarkingPaid(null);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-4 md:p-8">
      {/* Ticket Buyers Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200/50">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg">
                  <Users className="h-5 w-5 text-black" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black">
                    Ticket Buyers
              </h3>
                  <p className="text-sm text-gray-600">
                    {selectedEvent.title}
                  </p>
                </div>
              </div>
              <button 
                onClick={closeTicketBuyersModal}
                className="h-10 w-10 rounded-2xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors duration-200"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            
            {/* Content */}
            <div className="overflow-auto flex-1 p-6">
              {isLoadingBuyers ? (
                <div className="flex flex-col items-center justify-center h-40 space-y-4">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg">
                    <Loader2 className="h-6 w-6 text-black animate-spin" />
                  </div>
                  <p className="text-gray-600 font-medium">Loading ticket buyers...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-40 space-y-4">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg">
                    <X className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-red-600 font-semibold">Error loading ticket buyers</p>
                    <p className="text-gray-600 text-sm mt-1">{error}</p>
                  </div>
                </div>
              ) : ticketBuyers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 space-y-4">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-gray-600 font-semibold">No ticket buyers found</p>
                    <p className="text-gray-500 text-sm mt-1">This event doesn't have any ticket purchases yet.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 border border-blue-200/50">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-xl bg-blue-500 flex items-center justify-center">
                          <Users className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm text-blue-600 font-medium">Total Buyers</p>
                          <p className="text-lg font-bold text-blue-800">{ticketBuyers.length}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 border border-green-200/50">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-xl bg-green-500 flex items-center justify-center">
                          <Ticket className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm text-green-600 font-medium">Total Tickets</p>
                          <p className="text-lg font-bold text-green-800">
                            {ticketBuyers.reduce((sum, buyer) => sum + buyer.quantity, 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-4 border border-purple-200/50">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-xl bg-purple-500 flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm text-purple-600 font-medium">Scanned</p>
                          <p className="text-lg font-bold text-purple-800">
                            {ticketBuyers.filter(buyer => buyer.isScanned).length}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl p-4 border border-yellow-200/50">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-xl bg-yellow-500 flex items-center justify-center">
                          <Activity className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm text-yellow-600 font-medium">Valid Tickets</p>
                          <p className="text-lg font-bold text-yellow-800">
                            {ticketBuyers.filter(buyer => buyer.ticketStatus === 'Valid').length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50/80">
                          <tr className="text-left text-sm text-gray-600 border-b border-gray-200/50">
                            <th className="px-6 py-4 font-semibold">Buyer</th>
                            <th className="px-6 py-4 font-semibold">Contact</th>
                            <th className="px-6 py-4 font-semibold text-center">Ticket Type</th>
                            <th className="px-6 py-4 font-semibold text-center">Status</th>
                            <th className="px-6 py-4 font-semibold text-center">Scanned</th>
                            <th className="px-6 py-4 font-semibold text-center">Quantity</th>
                            <th className="px-6 py-4 font-semibold text-right">Purchase Date</th>
                      </tr>
                    </thead>
                        <tbody className="divide-y divide-gray-200/50">
                      {ticketBuyers.map((buyer) => (
                            <tr key={buyer.id} className="hover:bg-yellow-50/50 transition-colors duration-200">
                              <td className="px-6 py-4">
                                <div className="flex items-center space-x-3">
                                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
                                    <User className="h-4 w-4 text-white" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-black">{buyer.name}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-gray-700">{buyer.email}</p>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Badge 
                                  variant="outline" 
                                  className="bg-yellow-100 text-yellow-800 border-yellow-200 font-medium"
                                >
                              {buyer.ticketType}
                            </Badge>
                          </td>
                              <td className="px-6 py-4 text-center">
                                <Badge 
                                  variant="outline" 
                                  className={
                              buyer.ticketStatus === 'Valid' 
                                      ? 'bg-green-100 text-green-800 border-green-200'
                                : buyer.ticketStatus === 'Used'
                                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                                      : 'bg-gray-100 text-gray-600 border-gray-200'
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
                                      ? 'bg-purple-100 text-purple-800 border-purple-200'
                                      : 'bg-gray-100 text-gray-600 border-gray-200'
                                  }
                                >
                              {buyer.isScanned ? 'Yes' : 'No'}
                            </Badge>
                          </td>
                              <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-gray-100 text-gray-800 font-semibold text-sm">
                            {buyer.quantity}
                                </span>
                          </td>
                              <td className="px-6 py-4 text-right">
                                <p className="text-gray-700 text-sm">
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
            <div className="p-6 border-t border-gray-200/50 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold text-black">{ticketBuyers.length}</span> ticket buyers
              </div>
              <Button 
                onClick={closeTicketBuyersModal}
                className="bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-semibold px-6 py-2 rounded-2xl shadow-lg transition-all duration-200"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Modern Header */}
        <div className="mb-8">
          <div className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-black text-black mb-2">Admin Dashboard</h1>
                    <p className="text-gray-600 text-lg font-medium">Welcome back, Administrator</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                  System Admin
                </div>
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 mb-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {statsCards.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl p-2 shadow-xl">
            <TabsList className="bg-transparent border-0 p-0 h-auto">
            <TabsTrigger 
              value="overview" 
                className="rounded-2xl px-6 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-600 data-[state=active]:text-black data-[state=active]:shadow-lg text-gray-600 hover:text-black hover:bg-white/50 transition-all duration-300 font-semibold"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="events" 
                className="rounded-2xl px-6 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-600 data-[state=active]:text-black data-[state=active]:shadow-lg text-gray-600 hover:text-black hover:bg-white/50 transition-all duration-300 font-semibold"
            >
              Events
            </TabsTrigger>
            <TabsTrigger 
              value="organizers" 
                className="rounded-2xl px-6 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-600 data-[state=active]:text-black data-[state=active]:shadow-lg text-gray-600 hover:text-black hover:bg-white/50 transition-all duration-300 font-semibold"
            >
              Organizers
            </TabsTrigger>
            <TabsTrigger 
              value="sellers" 
                className="rounded-2xl px-6 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-600 data-[state=active]:text-black data-[state=active]:shadow-lg text-gray-600 hover:text-black hover:bg-white/50 transition-all duration-300 font-semibold"
            >
              Sellers
            </TabsTrigger>
              <TabsTrigger 
                value="buyers" 
                className="rounded-2xl px-6 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-600 data-[state=active]:text-black data-[state=active]:shadow-lg text-gray-600 hover:text-black hover:bg-white/50 transition-all duration-300 font-semibold"
              >
                Buyers
              </TabsTrigger>
          </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Events Chart */}
                <Card className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-black text-xl font-bold">Monthly Event Counts</CardTitle>
                        <CardDescription className="text-gray-600 text-sm">Monthly event counts performance</CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                          <span className="text-xs text-gray-600 font-medium">Events</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="h-[300px] w-full">
                      {eventsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={eventsData}>
                            <defs>
                              <linearGradient id="eventBarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
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
                        <div className="flex items-center justify-center h-full text-gray-400">
                          No event data available
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Metrics Chart */}
                <Card className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-black text-xl font-bold">Monthly Metrics</CardTitle>
                        <CardDescription className="text-gray-600 text-sm">Sellers, Products & Buyers Performance</CardDescription>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                          <span className="text-xs text-gray-600 font-medium">Sellers</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                          <span className="text-xs text-gray-600 font-medium">Products</span>
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
                                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.1}/>
                              </linearGradient>
                              <linearGradient id="colorProducts" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4ade80" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#4ade80" stopOpacity={0.1}/>
                              </linearGradient>
                              <linearGradient id="colorBuyers" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1}/>
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
                            />
                            <Legend 
                              wrapperStyle={{ paddingTop: '20px' }}
                              iconType="line"
                              formatter={(value) => (
                                <span style={{ color: '#374151', fontSize: '12px' }}>
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
                          <p className="text-gray-400">No metrics data available</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Events */}
              <Card className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-black text-xl font-bold">Recent Events</CardTitle>
                  <CardDescription className="text-gray-600 text-sm">Latest events created in the system</CardDescription>
                </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-4">
                  {dashboardState.recentEvents?.map((event) => (
                    <div 
                      key={event.id} 
                      className="flex items-start justify-between p-6 border border-gray-200 rounded-2xl hover:bg-yellow-50/50 transition-all duration-300 hover:shadow-md group"
                    >
                      <div className="flex items-start space-x-4">
                        <div className="p-3 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                          <Calendar className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-black text-lg">{event.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {(event.date && !isNaN(new Date(event.date).getTime())) ? format(new Date(event.date), 'MMM d, yyyy') : 'Invalid date'} • {event.venue}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`${
                          event.status === 'active' 
                            ? 'bg-green-100 text-green-800 border-green-200' 
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        } rounded-full px-3 py-1 font-semibold`}
                      >
                        {event.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="border-t border-gray-200 p-6">
                <Button 
                  variant="ghost" 
                  className="text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700 text-sm font-semibold rounded-xl px-4 py-2"
                >
                  View all events
                </Button>
              </CardFooter>
            </Card>
          </div>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-xl">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-black text-xl font-bold">Events Overview</CardTitle>
                    <CardDescription className="text-gray-600 text-sm">Manage all events in the platform</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-2 bg-yellow-100 border-yellow-200 text-yellow-800 rounded-full px-3 py-1">
                      <Calendar className="h-3 w-3" />
                      <span className="text-xs font-semibold">Last 12 months</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-600 border-b border-gray-200">
                        <th className="pb-4 font-semibold">Event</th>
                        <th className="pb-4 font-semibold">Date & Time</th>
                        <th className="pb-4 font-semibold">Location</th>
                        <th className="pb-4 font-semibold">Status</th>
                        <th className="pb-4 font-semibold text-right">Attendees</th>
                        <th className="pb-4 font-semibold text-right">Revenue</th>
                        <th className="pb-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {dashboardState.recentEvents?.map((event) => (
                        <tr key={event.id} className="hover:bg-yellow-50/50 transition-colors">
                          <td className="py-4">
                            <div className="font-bold text-black">{event.title}</div>
                            <div className="text-xs text-gray-600">{event.organizer_name || 'No Organizer'}</div>
                          </td>
                          <td className="py-4">
                            <div className="text-black font-medium">{format(new Date(event.date), 'MMM d, yyyy')}</div>
                            <div className="text-xs text-gray-600">
                              {(event.date && !isNaN(new Date(event.date).getTime())) ? format(new Date(event.date), 'h:mm a') : 'Invalid time'}
                              {event.end_date && !isNaN(new Date(event.end_date).getTime()) ? ` - ${format(new Date(event.end_date), 'h:mm a')}` : ''}
                            </div>
                          </td>
                          <td className="py-4 text-gray-700">
                            {event.location || 'N/A'}
                          </td>
                          <td className="py-4">
                            <Badge 
                              variant="outline"
                              className={
                                event.status === 'Active' || event.status === 'Ongoing'
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : event.status === 'Upcoming'
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }
                            >
                              {event.status}
                            </Badge>
                          </td>
                          <td className="py-4 text-right text-gray-700 font-medium">
                            {event.attendees_count?.toLocaleString() || '0'}
                          </td>
                          <td className="py-4 text-right">
                            <div className="font-bold text-black">
                              ${event.revenue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                            </div>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                                className="text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700 rounded-xl px-3 py-2"
                              onClick={() => handleViewEvent({id: event.id, title: event.title})}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                              {event.withdrawal_status !== 'paid' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-green-600 hover:bg-green-100 hover:text-green-700 rounded-xl px-3 py-2"
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
                                  className="bg-green-100 text-green-800 border-green-200 font-medium"
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
              </CardContent>
              <CardFooter className="border-t border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between w-full text-sm text-gray-600">
                  <div className="text-sm text-gray-600">
                    Showing <span className="text-black font-bold">{dashboardState.recentEvents?.length || 0}</span> of {dashboardState.recentEvents?.length || 0} events
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm" disabled={true} className="text-gray-400 hover:bg-gray-100 h-8 w-8 p-0 rounded-xl">
                      &larr;
                    </Button>
                    <Button variant="ghost" size="sm" className="bg-yellow-100 text-yellow-800 h-8 w-8 p-0 rounded-xl font-semibold">
                      1
                    </Button>
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:bg-gray-100 h-8 w-8 p-0 rounded-xl">
                      &rarr;
                    </Button>
                  </div>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Organizers Tab */}
          <TabsContent value="organizers" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-xl">
              <CardHeader className="pb-4">
                <div>
                  <CardTitle className="text-black text-xl font-bold">Organizers</CardTitle>
                  <CardDescription className="text-gray-600 text-sm">
                    Manage all event organizers in the platform
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-600 border-b border-gray-200">
                        <th className="pb-4 font-semibold">Name</th>
                        <th className="pb-4 font-semibold">Email</th>
                        <th className="pb-4 font-semibold">Phone</th>
                        <th className="pb-4 font-semibold">Status</th>
                        <th className="pb-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {dashboardState.organizers?.map((organizer) => (
                        <tr key={organizer.id} className="hover:bg-yellow-50/50 transition-colors">
                          <td className="py-4 text-black font-bold">{organizer.name}</td>
                          <td className="py-4 text-gray-700">{organizer.email}</td>
                          <td className="py-4 text-gray-700">{organizer.phone || 'N/A'}</td>
                          <td className="py-4">
                            <Badge 
                              variant="outline"
                              className={
                                organizer.status === 'Active' 
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }
                            >
                              {organizer.status}
                            </Badge>
                          </td>
                          <td className="py-4 text-right">
                            <Button variant="ghost" size="sm" className="text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700 rounded-xl px-3 py-2">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
              <CardFooter className="border-t border-gray-200 px-6 py-4">
                <div className="text-sm text-gray-600">
                  Showing <span className="text-black font-bold">{dashboardState.organizers?.length || 0}</span> {dashboardState.organizers?.length === 1 ? 'organizer' : 'organizers'}
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Sellers Tab */}
          <TabsContent value="sellers" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-xl">
              <CardHeader className="pb-4">
                <div>
                  <CardTitle className="text-black text-xl font-bold">Sellers</CardTitle>
                  <CardDescription className="text-gray-600 text-sm">
                    Manage all sellers in the platform
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-600 border-b border-gray-200">
                        <th className="pb-4 font-semibold">Name</th>
                        <th className="pb-4 font-semibold">Email</th>
                        <th className="pb-4 font-semibold">Phone</th>
                        <th className="pb-4 font-semibold">Location</th>
                        <th className="pb-4 font-semibold">Status</th>
                        <th className="pb-4 font-semibold">Joined</th>
                        <th className="pb-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {dashboardState.sellers?.map((seller) => (
                        <tr key={seller.id} className="hover:bg-yellow-50/50 transition-colors">
                          <td className="py-4 text-black font-bold">{seller.name}</td>
                          <td className="py-4 text-gray-700">{seller.email}</td>
                          <td className="py-4 text-gray-700">{seller.phone || 'N/A'}</td>
                          <td className="py-4">
                            <div className="flex flex-col">
                              <span className="text-gray-700">{seller.city}</span>
                              <span className="text-xs text-gray-500">{seller.location}</span>
                            </div>
                          </td>
                          <td className="py-4">
                            <Badge 
                              variant="outline"
                              className={
                                seller.status === 'Active' 
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }
                            >
                              {seller.status}
                            </Badge>
                          </td>
                          <td className="py-4 text-gray-600 text-sm">
                            {new Date(seller.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-4 text-right">
                            <Button variant="ghost" size="sm" className="text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700 rounded-xl px-3 py-2">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
              <CardFooter className="border-t border-gray-200 px-6 py-4">
                <div className="text-sm text-gray-600">
                  Showing <span className="text-black font-bold">{dashboardState.sellers?.length || 0}</span> {dashboardState.sellers?.length === 1 ? 'seller' : 'sellers'}
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Buyers Tab */}
          <TabsContent value="buyers" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-xl">
              <CardHeader className="pb-4">
                <div>
                  <CardTitle className="text-black text-xl font-bold">Buyers</CardTitle>
                  <CardDescription className="text-gray-600 text-sm">
                    Manage all buyers in the platform
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-600 border-b border-gray-200">
                        <th className="pb-4 font-semibold">Name</th>
                        <th className="pb-4 font-semibold">Email</th>
                        <th className="pb-4 font-semibold">Phone</th>
                        <th className="pb-4 font-semibold">Location</th>
                        <th className="pb-4 font-semibold">Status</th>
                        <th className="pb-4 font-semibold">Joined</th>
                        <th className="pb-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {dashboardState.buyers?.map((buyer) => (
                        <tr key={buyer.id} className="hover:bg-yellow-50/50 transition-colors">
                          <td className="py-4 text-black font-bold">{buyer.name}</td>
                          <td className="py-4 text-gray-700">{buyer.email}</td>
                          <td className="py-4 text-gray-700">{buyer.phone || 'N/A'}</td>
                          <td className="py-4">
                            <div className="flex flex-col">
                              <span className="text-gray-700">{buyer.city}</span>
                              <span className="text-xs text-gray-500">{buyer.location}</span>
                            </div>
                          </td>
                          <td className="py-4">
                            <Badge 
                              variant="outline"
                              className={
                                buyer.status === 'Active' 
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }
                            >
                              {buyer.status}
                            </Badge>
                          </td>
                          <td className="py-4 text-gray-600 text-sm">
                            {new Date(buyer.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-4 text-right">
                            <Button variant="ghost" size="sm" className="text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700 rounded-xl px-3 py-2">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
              <CardFooter className="border-t border-gray-200 px-6 py-4">
                <div className="text-sm text-gray-600">
                  Showing <span className="text-black font-bold">{dashboardState.buyers?.length || 0}</span> {dashboardState.buyers?.length === 1 ? 'buyer' : 'buyers'}
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default NewAdminDashboard;

