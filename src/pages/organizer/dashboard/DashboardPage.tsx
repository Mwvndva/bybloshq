import { useState, useEffect, useCallback } from 'react';
import { Calendar, Ticket, DollarSign, Clock, Users, TrendingUp, MapPin, BarChart3, Plus, Settings, RefreshCw, CheckCircle, ArrowLeft, Mail, Phone, Trash2, Save, Edit, Eye, EyeOff, List, AlertTriangle, Loader2, ExternalLink, MoreHorizontal, Menu, X, LogOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/utils';
import { useOrganizerAuth } from '@/contexts/OrganizerAuthContext';
import { AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import api from '@/lib/api';

// Form schemas
const profileFormSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

// API Response Types
interface TicketsApiResponse {
  success: boolean;
  data: {
    tickets: Ticket[];
  };
  message?: string;
}

interface EventsApiResponse {
  success: boolean;
  data: RecentEvent[];
  message?: string;
}

interface DashboardApiResponse {
  data: {
    stats: DashboardStats;
    recentEvents: RecentEvent[];
    recentSales?: RecentSale[];
  };
  message?: string;
  success: boolean;
}

interface DashboardStats {
  id: number;
  total_events: number;
  upcoming_events: number;
  past_events: number;
  current_events: number;
  total_tickets_sold: number;
  total_revenue: string;
  updated_at: string;
}

interface RecentEvent {
  id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  ticket_price: number;
  ticket_quantity: number;
  max_attendees: number;
  current_attendees: number;
  tickets_sold: number;
  total_revenue: number;
  status: string;
  created_at: string;
  updated_at: string;
  withdrawal_status?: string;
  withdrawal_date?: string;
  withdrawal_amount?: number;
  image_url?: string;
  ticket_types?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    sold: number;
    available: number;
    description?: string;
    sales_start_date?: string | null;
    sales_end_date?: string | null;
    is_default?: boolean;
  }>;
}

interface RecentSale {
  id: number;
  event_id: number;
  buyer_name: string;
  ticket_type: string;
  quantity: number;
  total_amount: number;
  purchase_date: string;
  status: string;
}

interface TicketType {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
  available: number;
  description: string;
  total_created?: number;
}

interface Ticket {
  id: number;
  ticket_number: string;
  ticket_type_name: string;
  customer_name: string;
  customer_email: string;
  price: number;
  status: string;
  scanned: boolean;
  created_at: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  change?: string | null;
  changeType?: 'increase' | 'decrease' | null;
  description: string;
}

const StatCard = ({ title, value, icon: Icon, iconColor, change, changeType, description }: StatCardProps) => (
  <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 border-0 bg-white/80 backdrop-blur-sm h-full">
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl ${iconColor}`}>
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${iconColor.includes('yellow') ? 'text-yellow-600' : iconColor.includes('blue') ? 'text-blue-600' : iconColor.includes('green') ? 'text-green-600' : iconColor.includes('red') ? 'text-red-600' : 'text-gray-600'}`} />
        </div>
        {change && (
          <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium ${changeType === 'increase' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {changeType === 'increase' ? '↑' : '↓'} {change}
          </span>
        )}
      </div>
      <h3 className="text-lg sm:text-xl font-black text-gray-900 mb-0.5">{value}</h3>
      <p className="text-[10px] sm:text-xs text-gray-500">{title} <span className="text-gray-400">{description && `(${description})`}</span></p>
    </div>
  </Card>
);

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [activeSection, setActiveSection] = useState<'overview' | 'events' | 'tickets' | 'settings'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { getToken, organizer, logout } = useOrganizerAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Initialize profile form
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      full_name: organizer?.full_name || '',
      email: organizer?.email || '',
      phone: organizer?.phone || '',
    },
  });

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch the dashboard data with proper typing
      const dashboardRes = await api.get<DashboardApiResponse>('/organizers/dashboard');
      console.log('Dashboard Response:', dashboardRes.data);

      // Extract events from the dashboard response if available
      const events = Array.isArray(dashboardRes.data.data?.recentEvents) ?
        dashboardRes.data.data.recentEvents : [];

      console.log('Setting recent events:', events);

      // Set the stats from the dashboard response with proper fallback
      const statsData = dashboardRes.data.data?.stats || {
        id: 0,
        total_events: 0,
        upcoming_events: 0,
        past_events: 0,
        current_events: 0,
        total_tickets_sold: 0,
        total_revenue: '0',
        updated_at: new Date().toISOString()
      };

      setStats(statsData);
      setRecentEvents(events);

      // Set recent sales if available, otherwise empty array
      setRecentSales(dashboardRes.data.data?.recentSales || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      const errorMessage = 'Failed to load dashboard data. Please try again later.';
      setError(errorMessage);
      if (toast) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, []); // Removed toast from dependencies to prevent infinite loops if toast instance is unstable

  // Set initial form values when organizer data is available
  useEffect(() => {
    if (organizer) {
      profileForm.reset({
        full_name: organizer.full_name || '',
        email: organizer.email || '',
        phone: organizer.phone || '',
      });
    }
  }, [organizer, profileForm]);

  // Fetch tickets for all events
  const fetchTickets = useCallback(async () => {
    try {
      setTicketsLoading(true);
      setTicketsError(null);

      // Get all tickets for the organizer with proper typing
      const response = await api.get<TicketsApiResponse>('/organizers/tickets');
      const ticketsData = response.data?.data?.tickets || [];
      setTickets(ticketsData);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setTicketsError('Failed to load tickets. Please try again later.');
      toast({
        title: 'Error',
        description: 'Failed to load tickets. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setTicketsLoading(false);
    }
  }, [toast]);

  // Fetch events for the organizer
  const fetchEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      setEventsError(null);

      // Get all events for the organizer with proper typing
      const response = await api.get<EventsApiResponse>('/organizers/events');
      console.log('Events API Response:', response.data);
      const eventsData = response.data?.data || [];
      setEvents(eventsData);
    } catch (error) {
      console.error('Error fetching events:', error);
      setEventsError('Failed to load events. Please try again later.');
      toast({
        title: 'Error',
        description: 'Failed to load events. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setEventsLoading(false);
    }
  }, [toast]);

  // Initial data load
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Fetch events when events tab is active
  useEffect(() => {
    if (activeSection === 'events') {
      fetchEvents();
    }
  }, [activeSection, fetchEvents]);

  // Fetch tickets when tickets tab is active
  useEffect(() => {
    if (activeSection === 'tickets') {
      fetchTickets();
    }
  }, [activeSection, fetchTickets]);

  const handleSaveProfile = async (data: ProfileFormValues) => {
    setIsLoading(true);
    try {
      await api.patch('/organizers/profile', data);
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
        variant: 'default',
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      try {
        await api.delete('/organizers/account');
        toast({
          title: 'Success',
          description: 'Account deleted successfully',
          variant: 'default',
        });
        navigate('/');
      } catch (error) {
        console.error('Error deleting account:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete account. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  // Get event status
  const getEventStatus = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return { status: 'Upcoming', color: 'bg-blue-100 text-blue-800' };
    if (now >= start && now <= end) return { status: 'In Progress', color: 'bg-green-100 text-green-800' };
    return { status: 'Completed', color: 'bg-gray-100 text-gray-800' };
  };

  // Stats data for the cards
  const statsData = [
    {
      id: 1,
      title: 'Total Events',
      value: stats?.total_events || 0,
      icon: Calendar,
      iconColor: 'bg-gradient-to-br from-yellow-100 to-yellow-200',
      change: null,
      changeType: null,
      description: 'all time'
    },
    {
      id: 2,
      title: 'Upcoming Events',
      value: stats?.upcoming_events || 0,
      icon: Calendar,
      iconColor: 'bg-gradient-to-br from-blue-100 to-blue-200',
      change: null,
      changeType: null,
      description: 'scheduled'
    },
    {
      id: 3,
      title: 'Current Events',
      value: stats?.current_events || 0,
      icon: Clock,
      iconColor: 'bg-gradient-to-br from-amber-100 to-amber-200',
      change: null,
      changeType: null,
      description: 'happening now'
    },
    {
      id: 4,
      title: 'Tickets Sold',
      value: stats?.total_tickets_sold || 0,
      icon: Ticket,
      iconColor: 'bg-gradient-to-br from-green-100 to-green-200',
      change: null,
      changeType: null,
      description: 'all time'
    },
    {
      id: 5,
      title: 'Total Revenue',
      value: stats?.total_revenue ? formatCurrency(Number(stats.total_revenue)) : formatCurrency(0),
      icon: DollarSign,
      iconColor: 'bg-gradient-to-br from-emerald-100 to-emerald-200',
      change: null,
      changeType: null,
      description: 'all time'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center mb-8">
            <Skeleton className="h-32 w-96" />
          </div>

          <div className="flex space-x-2 mb-12 bg-white/60 backdrop-blur-sm p-2 rounded-2xl shadow-lg border border-gray-200/50 w-fit mx-auto">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-24 rounded-xl" />
            ))}
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-100 to-red-200 rounded-3xl flex items-center justify-center shadow-lg">
            <RefreshCw className="h-12 w-12 text-red-600" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-black mb-3">Unable to load dashboard</h3>
            <p className="text-gray-600 text-lg font-medium max-w-md mx-auto mb-6">
              {error || 'Something went wrong while loading your dashboard data. Please try again.'}
            </p>
            <Button
              onClick={fetchDashboardData}
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Mobile header with improved touch targets */}
      <div className="md:hidden sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200/60 shadow-sm">
        <div className="px-4 sm:px-5 py-2.5 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-lg font-bold text-gray-900">
              {activeSection === 'overview' ? 'Dashboard' :
                activeSection === 'events' ? 'My Events' :
                  activeSection === 'tickets' ? 'Tickets' :
                    activeSection === 'settings' ? 'Settings' : 'EventHub'}
            </h1>
          </div>
          <div className="flex items-center">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2.5 -mr-2 rounded-xl text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400"
              aria-expanded={showMobileMenu}
              aria-label={showMobileMenu ? 'Close menu' : 'Open menu'}
              aria-controls="mobile-navigation"
            >
              {showMobileMenu ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced mobile menu with better animations */}
      <div
        id="mobile-navigation"
        className={`md:hidden bg-white border-b border-gray-200 transition-all duration-300 ease-in-out overflow-hidden ${showMobileMenu ? 'max-h-96 shadow-sm' : 'max-h-0 border-transparent'
          }`}
      >
        <nav className="px-2 py-1.5 space-y-0.5">
          <button
            onClick={() => { setActiveSection('overview'); setShowMobileMenu(false); }}
            className={`flex w-full items-center px-4 py-3.5 text-sm font-medium rounded-xl transition-colors ${activeSection === 'overview'
              ? 'bg-yellow-50 text-yellow-700'
              : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
              }`}
          >
            <BarChart3 className="w-5 h-5 mr-3 text-yellow-500 flex-shrink-0" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => { setActiveSection('events'); setShowMobileMenu(false); }}
            className={`flex w-full items-center px-4 py-3.5 text-sm font-medium rounded-xl transition-colors ${activeSection === 'events'
              ? 'bg-yellow-50 text-yellow-700'
              : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
              }`}
          >
            <Calendar className="w-5 h-5 mr-3 text-blue-500 flex-shrink-0" />
            <span>My Events</span>
          </button>

          <button
            onClick={() => { setActiveSection('tickets'); setShowMobileMenu(false); }}
            className={`flex w-full items-center px-4 py-3.5 text-sm font-medium rounded-xl transition-colors ${activeSection === 'tickets'
              ? 'bg-yellow-50 text-yellow-700'
              : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
              }`}
          >
            <Ticket className="w-5 h-5 mr-3 text-green-500 flex-shrink-0" />
            <span>Tickets</span>
          </button>

          <button
            onClick={() => { setActiveSection('settings'); setShowMobileMenu(false); }}
            className={`flex w-full items-center px-4 py-3.5 text-sm font-medium rounded-xl transition-colors ${activeSection === 'settings'
              ? 'bg-yellow-50 text-yellow-700'
              : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
              }`}
          >
            <Settings className="w-5 h-5 mr-3 text-purple-500 flex-shrink-0" />
            <span>Settings</span>
          </button>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-5 lg:px-6 py-4 md:py-8">
        {/* Desktop Header */}
        <div className="hidden md:block text-left mb-8 md:mb-10">
          {/* Back to Homepage Button */}
          <div className="flex justify-start mb-6">
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Homepage
            </Button>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 mb-1.5 md:mb-2">Event Management</h1>
          <p className="text-gray-600 text-xs sm:text-sm md:text-base font-medium max-w-2xl mx-auto">
            {activeSection === 'overview' && 'Manage your events and track your success'}
            {activeSection === 'events' && 'Create and manage your upcoming events'}
            {activeSection === 'tickets' && 'View and manage ticket sales and attendees'}
            {activeSection === 'settings' && 'Update your account and organization settings'}
          </p>
        </div>

        {/* Mobile Section Title with improved spacing */}
        <div className="md:hidden mb-5 sm:mb-6">
          {/* Back to Homepage Button - Mobile */}
          <div className="flex justify-start mb-4">
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-3 py-2 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Homepage
            </Button>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1.5 leading-tight">
            {activeSection === 'overview' && 'Dashboard Overview'}
            {activeSection === 'events' && 'Your Events'}
            {activeSection === 'tickets' && 'Ticket Sales'}
            {activeSection === 'settings' && 'Account Settings'}
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            {activeSection === 'overview' && 'Quick stats and recent activity'}
            {activeSection === 'events' && 'Manage your upcoming and past events'}
            {activeSection === 'tickets' && 'Track sales and check-in attendees'}
            {activeSection === 'settings' && 'Update your profile and preferences'}
          </p>
        </div>

        {/* Stats Overview */}
        <div className="flex justify-center mb-8 md:mb-12">
          <div className="w-full">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
              {statsData.map((stat, index) => (
                <StatCard key={index} {...stat} />
              ))}
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Desktop */}
        <div className="hidden md:flex flex-wrap justify-center gap-2 mb-8 sm:mb-12 bg-white/60 backdrop-blur-sm p-2 rounded-2xl shadow-lg border border-gray-200/50 w-full sm:w-fit mx-auto">
          <Button
            variant={activeSection === 'overview' ? 'default' : 'ghost'}
            onClick={() => setActiveSection('overview')}
            className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-xl transition-all duration-300 font-semibold text-xs sm:text-sm flex-1 sm:flex-none min-w-0 ${activeSection === 'overview'
              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105'
              : 'text-gray-600 hover:text-black hover:bg-gray-100/80 hover:scale-105'
              }`}
          >
            <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Overview</span>
          </Button>
          <Button
            variant={activeSection === 'events' ? 'default' : 'ghost'}
            onClick={() => setActiveSection('events')}
            className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-xl transition-all duration-300 font-semibold text-xs sm:text-sm flex-1 sm:flex-none min-w-0 ${activeSection === 'events'
              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105'
              : 'text-gray-600 hover:text-black hover:bg-gray-100/80 hover:scale-105'
              }`}
          >
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Events</span>
          </Button>
          <Button
            variant={activeSection === 'tickets' ? 'default' : 'ghost'}
            onClick={() => setActiveSection('tickets')}
            className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-xl transition-all duration-300 font-semibold text-xs sm:text-sm flex-1 sm:flex-none min-w-0 ${activeSection === 'tickets'
              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105'
              : 'text-gray-600 hover:text-black hover:bg-gray-100/80 hover:scale-105'
              }`}
          >
            <Ticket className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Tickets</span>
          </Button>
          <Button
            variant={activeSection === 'settings' ? 'default' : 'ghost'}
            onClick={() => setActiveSection('settings')}
            className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-xl transition-all duration-300 font-semibold text-xs sm:text-sm flex-1 sm:flex-none min-w-0 ${activeSection === 'settings'
              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105'
              : 'text-gray-600 hover:text-black hover:bg-gray-100/80 hover:scale-105'
              }`}
          >
            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Settings</span>
          </Button>
        </div>

        {/* Content Sections */}
        {activeSection === 'overview' && (
          <div className="space-y-12">
            <div className="text-center">
              <h2 className="text-xl md:text-3xl font-black text-black mb-3">Dashboard Overview</h2>
              <p className="text-gray-600 text-sm md:text-base font-medium">Your event management at a glance</p>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-lg md:text-2xl font-black text-black">Quick Actions</h3>
                  <p className="text-gray-600 font-medium text-xs sm:text-sm mt-1">Common tasks for your events</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate('/organizer/events/new')}
                  className="gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-6 py-3 rounded-xl font-semibold"
                >
                  <Plus className="h-4 w-4" />
                  Create Event
                </Button>
              </div>

              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <Button
                  variant="outline"
                  className="h-14 sm:h-16 justify-start gap-3 sm:gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-xl"
                  onClick={() => navigate('/organizer/events')}
                >
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
                  <div>
                    <p className="font-semibold">View All Events</p>
                    <p className="text-sm text-gray-500">Manage your events</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-14 sm:h-16 justify-start gap-3 sm:gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-xl"
                  onClick={() => navigate('/organizer/events/new')}
                >
                  <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                  <div>
                    <p className="font-semibold">Create New Event</p>
                    <p className="text-sm text-gray-500">Start a new event</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-14 sm:h-16 justify-start gap-3 sm:gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-xl"
                  onClick={() => navigate('/organizer/tickets')}
                >
                  <Ticket className="h-5 w-5 sm:h-6 sm:w-6" />
                  <div>
                    <p className="font-semibold">Manage Tickets</p>
                    <p className="text-sm text-gray-500">View ticket sales</p>
                  </div>
                </Button>
              </div>
            </div>

            {/* Recent Events */}
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-lg md:text-2xl font-black text-black">Recent Events</h3>
                  <p className="text-gray-600 font-medium text-xs sm:text-sm mt-1">Your most recent event activities</p>
                </div>
              </div>

              {recentEvents.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {recentEvents.slice(0, 6).map((event) => {
                    const eventStatus = getEventStatus(event.start_date, event.end_date);
                    return (
                      <Card key={event.id} className="group hover:shadow-2xl transition-all duration-500 border-0 bg-white/80 backdrop-blur-sm transform hover:-translate-y-2">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <Badge
                              variant="secondary"
                              className={`${eventStatus.color} px-3 py-1 text-xs font-bold rounded-xl`}
                            >
                              {eventStatus.status}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {new Date(event.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <h3 className="font-bold text-black mb-2 line-clamp-1 text-lg">{event.title}</h3>
                          <p className="text-yellow-600 font-black text-xl mb-3">
                            {formatCurrency(event.ticket_price)}
                          </p>
                          <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed mb-4">
                            {event.description}
                          </p>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center text-gray-500">
                              <MapPin className="h-4 w-4 mr-1" />
                              <span className="truncate">{event.location}</span>
                            </div>
                            <div className="text-gray-500">
                              {event.current_attendees}/{event.max_attendees}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
                    <Calendar className="h-12 w-12 text-yellow-600" />
                  </div>
                  <h3 className="text-2xl font-black text-black mb-3">No events found</h3>
                  <p className="text-gray-600 text-lg font-medium max-w-md mx-auto mb-6">Create your first event to get started</p>
                  <Button
                    onClick={() => navigate('/organizer/events/new')}
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Create Your First Event
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'events' && (
          <div className="space-y-12">
            <div className="text-center">
              <h2 className="text-2xl md:text-4xl font-black text-black mb-4">Event Management</h2>
              <p className="text-gray-600 text-lg font-medium">Create and manage your events</p>
            </div>

            {/* Event Management */}
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl md:text-3xl font-black text-black">All Events</h3>
                  <p className="text-gray-600 font-medium mt-2">Manage all your events in one place</p>
                </div>
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={fetchEvents}
                    disabled={eventsLoading}
                    className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-2"
                  >
                    {eventsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refresh
                  </Button>
                  <Button
                    onClick={() => navigate('/organizer/events/new')}
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-6 py-2 rounded-xl font-semibold"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Event
                  </Button>
                </div>
              </div>

              {eventsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-yellow-600" />
                    <p className="text-gray-600 font-medium">Loading events...</p>
                  </div>
                </div>
              ) : eventsError ? (
                <div className="text-center py-12">
                  <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-red-400" />
                  <h3 className="text-xl font-black text-black mb-2">Error Loading Events</h3>
                  <p className="text-gray-600 mb-4">{eventsError}</p>
                  <Button
                    variant="outline"
                    onClick={fetchEvents}
                    className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-6 py-3"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              ) : events.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {events.map((event) => {
                    const eventStatus = getEventStatus(event.start_date, event.end_date);
                    return (
                      <div key={event.id} className="bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                        {/* Event Image */}
                        <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 relative">
                          {event.image_url ? (
                            <img
                              src={event.image_url}
                              alt={event.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Calendar className="h-16 w-16 text-gray-400" />
                            </div>
                          )}
                          <div className="absolute top-4 right-4">
                            <Badge className={`px-3 py-1 text-xs font-bold rounded-xl ${eventStatus.color}`}>
                              {eventStatus.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Event Content */}
                        <div className="p-6">
                          <h4 className="text-xl font-black text-black mb-2 line-clamp-2">{event.title}</h4>
                          <p className="text-gray-600 text-sm mb-4 line-clamp-2">{event.description}</p>

                          {/* Event Details */}
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center text-sm text-gray-600">
                              <Calendar className="h-4 w-4 mr-2" />
                              <span>{new Date(event.start_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}</span>
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <Clock className="h-4 w-4 mr-2" />
                              <span>{new Date(event.start_date).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}</span>
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <MapPin className="h-4 w-4 mr-2" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          </div>

                          {/* Event Stats */}
                          <div className="flex justify-between items-center mb-4">
                            <div className="text-center">
                              <p className="text-lg font-black text-black">
                                {event.tickets_sold || 0}
                              </p>
                              <p className="text-xs text-gray-600">Tickets Sold</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-black text-black">
                                KSh {(
                                  Number(event.total_revenue || 0)
                                ).toLocaleString('en-KE')}
                              </p>
                              <p className="text-xs text-gray-600">Revenue</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-black text-black">
                                {event.ticket_quantity > 0
                                  ? Math.round((
                                    (Number(event.tickets_sold || 0) /
                                      Number(event.ticket_quantity || 1)) * 100
                                  ))
                                  : 0}%
                              </p>
                              <p className="text-xs text-gray-600">Capacity</p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex justify-between items-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/organizer/events/${event.id}`)}
                              className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-2"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-2">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => window.open(`/events/${event.id}`, '_blank')}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  View Public Page
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`/events/${event.id}/tickets`, '_blank')}>
                                  <Ticket className="h-4 w-4 mr-2" />
                                  Purchase Page
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
                    <Calendar className="h-12 w-12 text-yellow-600" />
                  </div>
                  <h3 className="text-2xl font-black text-black mb-3">No events found</h3>
                  <p className="text-gray-600 text-lg font-medium max-w-md mx-auto mb-6">
                    You haven't created any events yet. Create your first event to start selling tickets.
                  </p>
                  <Button
                    onClick={() => navigate('/organizer/events/new')}
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Create Your First Event
                  </Button>
                </div>
              )}
            </div>

            {/* Event Statistics */}
            {events.length > 0 && (
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
                <h3 className="text-2xl font-black text-black mb-6">Event Statistics</h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <div className="text-center p-6 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-blue-600" />
                    </div>
                    <p className="text-2xl font-black text-black">{events.length}</p>
                    <p className="text-sm text-gray-600 font-medium">Total Events</p>
                  </div>

                  <div className="text-center p-6 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center">
                      <Clock className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="text-2xl font-black text-black">
                      {events.filter(e => {
                        const now = new Date();
                        const start = new Date(e.start_date);
                        const end = new Date(e.end_date);
                        return now >= start && now <= end;
                      }).length}
                    </p>
                    <p className="text-sm text-gray-600 font-medium">Active Events</p>
                  </div>

                  <div className="text-center p-6 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-xl flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-yellow-600" />
                    </div>
                    <p className="text-2xl font-black text-black">
                      KSh {events
                        .reduce((sum, event) => sum + ((event.current_attendees || 0) * event.ticket_price), 0)
                        .toLocaleString('en-KE')}
                    </p>
                    <p className="text-sm text-gray-600 font-medium">Total Revenue</p>
                  </div>

                  <div className="text-center p-6 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
                      <Ticket className="h-6 w-6 text-purple-600" />
                    </div>
                    <p className="text-2xl font-black text-black">
                      {events.reduce((sum, event) => sum + (event.current_attendees || 0), 0)}
                    </p>
                    <p className="text-sm text-gray-600 font-medium">Total Tickets Sold</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'tickets' && (
          <div className="space-y-12">
            <div className="text-center">
              <h2 className="text-2xl md:text-4xl font-black text-black mb-4">Ticket Management</h2>
              <p className="text-gray-600 text-lg font-medium">Track and manage your ticket sales</p>
            </div>

            {/* Ticket Management */}
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl md:text-3xl font-black text-black">All Tickets</h3>
                  <p className="text-gray-600 font-medium mt-2">Manage tickets across all your events</p>
                </div>
                <Button
                  variant="outline"
                  onClick={fetchTickets}
                  disabled={ticketsLoading}
                  className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-2"
                >
                  {ticketsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>

              {ticketsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-yellow-600" />
                    <p className="text-gray-600 font-medium">Loading tickets...</p>
                  </div>
                </div>
              ) : ticketsError ? (
                <div className="text-center py-12">
                  <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-red-400" />
                  <h3 className="text-xl font-black text-black mb-2">Error Loading Tickets</h3>
                  <p className="text-gray-600 mb-4">{ticketsError}</p>
                  <Button
                    variant="outline"
                    onClick={fetchTickets}
                    className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-6 py-3"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              ) : tickets.length > 0 ? (
                <div className="bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-200">
                          <TableHead className="font-bold text-black min-w-[100px]">Ticket #</TableHead>
                          <TableHead className="font-bold text-black min-w-[120px]">Event</TableHead>
                          <TableHead className="font-bold text-black min-w-[120px]">Type</TableHead>
                          <TableHead className="font-bold text-black min-w-[150px]">Customer</TableHead>
                          <TableHead className="font-bold text-black min-w-[100px]">Price</TableHead>
                          <TableHead className="font-bold text-black min-w-[100px]">Status</TableHead>
                          <TableHead className="font-bold text-black min-w-[120px]">Scanned</TableHead>
                          <TableHead className="font-bold text-black min-w-[120px]">Purchased</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tickets.map((ticket) => (
                          <TableRow key={ticket.id} className="border-gray-200 hover:bg-gray-50/50">
                            <TableCell className="font-medium whitespace-nowrap">
                              {ticket.ticket_number || `TKT-${ticket.id?.toString().padStart(6, '0')}`}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <span className="font-medium">Event #{ticket.id}</span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {ticket.ticket_type_name || 'General'}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium whitespace-nowrap">{ticket.customer_name || 'Guest'}</span>
                                {ticket.customer_email && (
                                  <span className="text-xs text-gray-500 truncate max-w-[150px]">
                                    {ticket.customer_email}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium whitespace-nowrap">
                              KSh {ticket.price?.toLocaleString('en-KE', { minimumFractionDigits: 2 }) || '0.00'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                className={`px-3 py-1 text-xs font-bold rounded-xl ${ticket.status === 'paid' ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800' :
                                  ticket.status === 'pending' ? 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800' :
                                    ticket.status === 'cancelled' ? 'bg-gradient-to-r from-red-100 to-red-200 text-red-800' :
                                      'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800'
                                  }`}
                              >
                                {ticket.status ? ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1) : 'Unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center">
                                <div
                                  className={`h-3 w-3 rounded-full mr-3 ${ticket.scanned ? 'bg-green-500' : 'bg-gray-300'
                                    }`}
                                />
                                <span className={`font-medium ${ticket.scanned ? 'text-green-600' : 'text-gray-600'}`}>
                                  {ticket.scanned ? 'Scanned' : 'Not Scanned'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-600 whitespace-nowrap">
                              {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              }) : 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
                    <Ticket className="h-12 w-12 text-yellow-600" />
                  </div>
                  <h3 className="text-2xl font-black text-black mb-3">No tickets found</h3>
                  <p className="text-gray-600 text-lg font-medium max-w-md mx-auto mb-6">
                    No tickets have been sold for your events yet. Create an event to start selling tickets.
                  </p>
                  <Button
                    onClick={() => navigate('/organizer/events/new')}
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Create Your First Event
                  </Button>
                </div>
              )}
            </div>

            {/* Ticket Statistics */}
            {tickets.length > 0 && (
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
                <h3 className="text-2xl font-black text-black mb-6">Ticket Statistics</h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <div className="text-center p-6 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center">
                      <Ticket className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="text-2xl font-black text-black">{tickets.length}</p>
                    <p className="text-sm text-gray-600 font-medium">Total Tickets</p>
                  </div>

                  <div className="text-center p-6 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        className="h-6 w-6 text-blue-600"
                      >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <path d="m9 11 3 3L22 4" />
                      </svg>
                    </div>
                    <p className="text-2xl font-black text-black">
                      {tickets.filter(t => t.scanned).length}
                    </p>
                    <p className="text-sm text-gray-600 font-medium">Scanned</p>
                  </div>

                  <div className="text-center p-6 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-xl flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-yellow-600" />
                    </div>
                    <p className="text-2xl font-black text-black">
                      KSh {tickets.reduce((sum, ticket) => sum + (ticket.price || 0), 0).toLocaleString('en-KE')}
                    </p>
                    <p className="text-sm text-gray-600 font-medium">Total Revenue</p>
                  </div>

                  <div className="text-center p-6 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                    <p className="text-2xl font-black text-black">
                      {new Set(tickets.map(t => t.customer_email)).size}
                    </p>
                    <p className="text-sm text-gray-600 font-medium">Unique Customers</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'settings' && (
          <div className="space-y-12">
            <div className="text-center">
              <h2 className="text-2xl md:text-4xl font-black text-black mb-4">Account Settings</h2>
              <p className="text-gray-600 text-lg font-medium">Manage your account information and preferences</p>
            </div>

            {/* Settings Sections */}
            <div className="space-y-8">
              {/* Profile Information */}
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-black text-black">Profile Information</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                    className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-2"
                  >
                    {isEditing ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Cancel
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Profile
                      </>
                    )}
                  </Button>
                </div>

                {isEditing ? (
                  <form onSubmit={profileForm.handleSubmit(handleSaveProfile)} className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-3">
                        <Label className="text-sm font-bold text-gray-700">Full Name</Label>
                        <Input
                          {...profileForm.register('full_name')}
                          className="h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                          placeholder="Enter your full name"
                        />
                        {profileForm.formState.errors.full_name && (
                          <p className="text-sm text-red-600">{profileForm.formState.errors.full_name.message}</p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-bold text-gray-700">Email Address</Label>
                        <Input
                          {...profileForm.register('email')}
                          type="email"
                          className="h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                          placeholder="Enter your email"
                        />
                        {profileForm.formState.errors.email && (
                          <p className="text-sm text-red-600">{profileForm.formState.errors.email.message}</p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-bold text-gray-700">Phone Number</Label>
                        <Input
                          {...profileForm.register('phone')}
                          className="h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                          placeholder="Enter your phone number"
                        />
                        {profileForm.formState.errors.phone && (
                          <p className="text-sm text-red-600">{profileForm.formState.errors.phone.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-6 py-3"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-6 py-3 rounded-xl font-semibold"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-3">
                        <Label className="text-sm font-bold text-gray-700">Full Name</Label>
                        <div className="p-4 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                          <span className="font-medium text-black">
                            {profileForm.getValues('full_name') || 'Not provided'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-bold text-gray-700">Email Address</Label>
                        <div className="flex items-center space-x-3 p-4 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                          <Mail className="h-5 w-5 text-gray-500" />
                          <span className="font-medium text-black">
                            {profileForm.getValues('email') || 'Not provided'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-bold text-gray-700">Phone Number</Label>
                        <div className="flex items-center space-x-3 p-4 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                          <Phone className="h-5 w-5 text-gray-500" />
                          <span className="font-medium text-black">
                            {profileForm.getValues('phone') || 'Not provided'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Terms and Conditions */}
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
                <h3 className="text-2xl font-black text-black mb-6">Terms & Conditions</h3>
                <div className="prose prose-sm max-w-none text-gray-700 mb-6">
                  <div className="max-h-[600px] overflow-y-auto pr-4">
                    <p className="font-semibold mb-4">
                      Platform Owner: Byblos ("we", "us", "our")<br />
                      Jurisdiction: Republic of Kenya
                    </p>

                    <h4 className="font-bold text-gray-900 mt-4">1. Acceptance of Terms</h4>
                    <p>
                      By creating an event, selling tickets, or otherwise using Byblos' ticketing services, you ("Organizer") automatically agree to these Terms & Conditions, Byblos' Privacy Policy, and all applicable Kenyan laws, including but not limited to:
                    </p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li>The Consumer Protection Act, 2012</li>
                      <li>The Data Protection Act, 2019</li>
                      <li>The Kenya Information and Communications Act, 1998</li>
                      <li>The Contract Act (Cap 23)</li>
                    </ul>
                    <p className="mt-2">If you do not agree, you may not use Byblos for event hosting or ticketing.</p>

                    <h4 className="font-bold text-gray-900 mt-6">2. Organizer Responsibilities</h4>
                    <p>You are solely responsible for:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Accuracy of event details (date, time, venue, pricing, age restrictions, etc.)</li>
                      <li>Ensuring compliance with Kenyan laws, including licensing, permits, and health & safety requirements.</li>
                      <li>Honoring all valid tickets issued via Byblos.</li>
                    </ul>
                    <p className="mt-2">You agree not to:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Host illegal, unsafe, discriminatory, or fraudulent events.</li>
                      <li>Use Byblos for money laundering, pyramid schemes, or other unlawful activity.</li>
                      <li>Share or resell attendee personal data outside Byblos without consent.</li>
                    </ul>

                    <h4 className="font-bold text-gray-900 mt-6">3. Ticketing & Validation</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Byblos provides digital ticketing and entry management tools.</li>
                      <li>Every ticket sold through Byblos includes two ticket validators (devices, personnel, or tools provided by Byblos) for smooth check-ins.</li>
                      <li>Organizers must ensure proper internet access or provide alternative check-in setups where required.</li>
                    </ul>

                    <h4 className="font-bold text-gray-900 mt-6">4. Service Fees & Payouts</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Byblos charges a 6% service fee on each ticket sold.</li>
                      <li>This fee is inclusive of two ticket validators and event marketing support.</li>
                      <li>Fees are deducted at source before payouts to the Organizer.</li>
                    </ul>
                    <p className="font-medium mt-3">Payouts:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Ticket sales revenue (minus fees) will be processed and released to the Organizer's nominated M-Pesa account or bank account within 48 hours after the event ends.</li>
                      <li>Byblos reserves the right to withhold payouts in cases of fraud, chargebacks, unresolved disputes, or breach of these Terms.</li>
                    </ul>

                    <h4 className="font-bold text-gray-900 mt-6">5. Refunds, Cancellations & Disputes</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Organizers are required to clearly state their refund policy during event creation.</li>
                      <li>In case of event cancellation, postponement, or significant changes:</li>
                      <ul className="list-[circle] pl-5 mt-1 space-y-1">
                        <li>The Organizer bears full responsibility for refunds.</li>
                        <li>Byblos may, at its discretion, assist in processing refunds but is not financially liable.</li>
                      </ul>
                      <li>Any disputes between Organizers and Attendees must first be addressed by the Organizer.</li>
                    </ul>

                    <h4 className="font-bold text-gray-900 mt-6">6. Marketing & Promotion</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Byblos provides marketing support (social media promotion, event listing visibility, and curated recommendations).</li>
                      <li>Byblos reserves the right to use your event details, logo, and media for promotional purposes.</li>
                    </ul>

                    <h4 className="font-bold text-gray-900 mt-6">7. Data Protection</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Byblos complies with the Data Protection Act, 2019.</li>
                      <li>Organizers may access attendee data strictly for event management purposes.</li>
                      <li>Any misuse, resale, or unauthorized processing of attendee data will result in immediate account suspension and possible legal action.</li>
                    </ul>

                    <h4 className="font-bold text-gray-900 mt-6">8. Limitation of Liability</h4>
                    <p>Byblos provides the platform "as is" without warranties of event success, ticket sales volume, or attendee turnout.</p>
                    <p className="mt-2">Byblos shall not be liable for:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Venue safety, logistics, or legal compliance.</li>
                      <li>Losses arising from fraud by Organizers or Attendees.</li>
                      <li>Force majeure events (natural disasters, government restrictions, internet outages, etc.).</li>
                    </ul>

                    <h4 className="font-bold text-gray-900 mt-6">9. Termination</h4>
                    <p>Byblos may suspend or terminate your account and withhold payouts if:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>You violate these Terms.</li>
                      <li>Fraudulent or unlawful activity is detected.</li>
                      <li>You damage Byblos' brand, reputation, or operations.</li>
                    </ul>

                    <h4 className="font-bold text-gray-900 mt-6">10. Governing Law & Jurisdiction</h4>
                    <p>These Terms are governed by the laws of the Republic of Kenya. Any disputes shall be resolved through good faith negotiations, failing which they shall be subject to the exclusive jurisdiction of the Kenyan courts.</p>

                    <h4 className="font-bold text-gray-900 mt-6">11. Amendments</h4>
                    <p>Byblos reserves the right to amend these Terms at any time. Updated versions will be posted on the platform and will apply immediately to future events.</p>

                    <div className="text-sm text-gray-500 mt-8 pt-4 border-t border-gray-200">
                      <p className="font-medium">Last updated: September 10, 2024</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mt-4">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-600">You agreed to these terms on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>

              {/* Account Actions */}
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
                <h3 className="text-2xl font-black text-gray-900 mb-6">Account Actions</h3>
                <div className="space-y-4">
                  <div className="p-6 border-2 border-gray-200 rounded-2xl bg-gray-50/50">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h4 className="font-bold text-gray-900 text-lg">Logout</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Sign out of your account and return to the login page.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={logout}
                        className="border-gray-300 hover:bg-gray-100 hover:border-gray-400 rounded-xl px-6 py-3"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
                <h3 className="text-2xl font-black text-red-600 mb-6">Danger Zone</h3>
                <div className="p-6 border-2 border-red-200 rounded-2xl bg-red-50/50">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h4 className="font-bold text-red-600 text-lg">Delete Account</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Permanently delete your account and all associated data. This action cannot be undone.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteAccount}
                      className="bg-red-600 hover:bg-red-700 rounded-xl px-6 py-3"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Account
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;