import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ApiResponse } from '@/types';
import {
  ArrowLeft,
  Edit,
  Share2,
  DollarSign,
  Calendar,
  MapPin,
  Link as LinkIcon,
  AlertTriangle,
  Ticket,
  List,
  Plus,
  ShoppingCart,
  RefreshCw,
  Loader2,
  BarChart3,
  Settings,
  Trash2,
  Percent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useOrganizerAuth } from '@/contexts/GlobalAuthContext';
import { DiscountCodeManager } from '@/components/organizer/DiscountCodeManager';
import {
  format,
  parseISO,
  isAfter,
  isBefore,
  isToday,
  differenceInMinutes,
  differenceInHours,
  formatDistanceToNow
} from 'date-fns';

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

interface AnalyticsData {
  totalTicketsSold: number;
  totalScannedTickets: number;
  totalRevenue: number;
  ticketSales: { date: string; sales: number }[];
  referralSources: { source: string; count: number }[];
}

interface EventData {
  id: string;
  title: string;
  name?: string; // For backward compatibility
  description: string;
  startDate: string;
  start_date?: string; // For backward compatibility
  endDate: string;
  end_date?: string; // For backward compatibility
  location: string;
  venue: string;
  isOnline: boolean;
  onlineUrl?: string;
  online_url?: string; // For backward compatibility
  ticketTypes: TicketType[];
  ticket_types?: any[]; // Raw ticket types from API
  image_url?: string;
  status: string;
  createdAt: string;
  created_at?: string; // For backward compatibility
  updatedAt: string;
  updated_at?: string; // For backward compatibility
  analytics?: AnalyticsData;
  // New fields from the API
  total_tickets_sold?: number;
  total_revenue?: number;
  totalTicketsSold?: number;
  totalRevenue?: number;
}

// Fetch event data from API
const fetchEvent = async (id: string): Promise<EventData> => {
  try {
    interface RawEventData {
      id: string;
      title?: string;
      name?: string;
      description?: string;
      start_date?: string;
      end_date?: string;
      location?: string;
      venue?: string;
      is_online?: boolean;
      online_url?: string;
      status?: string;
      image_url?: string;
      created_at?: string;
      updated_at?: string;
      ticket_types?: any[];
      total_tickets_sold?: number;
      total_revenue?: number;
      [key: string]: any; // For any additional properties
    }

    interface EventResponse {
      event: RawEventData;
    }

    const response = await api.get<ApiResponse<EventResponse>>(`/organizers/events/${id}`);

    if (!response.data?.data?.event) {
      throw new Error('Invalid response format from server');
    }

    const event = response.data.data.event;

    // Transform the API response to match our component's expected format
    const transformedEvent: EventData = {
      ...event,
      // Handle both camelCase and snake_case fields from the API
      title: event.title || event.name || 'Untitled Event',
      description: event.description || '',
      startDate: event.startDate || event.start_date || new Date().toISOString(),
      endDate: event.endDate || event.end_date || new Date().toISOString(),
      location: event.location || '',
      venue: event.venue || '',
      isOnline: event.isOnline || event.is_online || false,
      onlineUrl: event.online_url || event.onlineUrl,
      status: event.status || 'draft',
      image_url: event.image_url,
      createdAt: event.created_at || event.createdAt || new Date().toISOString(),
      updatedAt: event.updated_at || event.updatedAt || new Date().toISOString(),
      // Process ticket types to remove duplicates and ensure data consistency
      ticketTypes: (() => {
        // First, normalize the ticket types array
        const normalizedTickets = (event.ticket_types || []).map((ticket: any) => {
          // Calculate available quantity based on total quantity minus sold
          const totalQuantity = parseInt(ticket.quantity || '0', 10);
          const sold = parseInt(ticket.quantity_sold || ticket.sold || '0', 10);
          const totalCreated = parseInt(ticket.total_created || ticket.sold || '0', 10);

          return {
            id: ticket.id?.toString() || Math.random().toString(36).substr(2, 9),
            name: ticket.name || 'General Admission',
            price: parseFloat(ticket.price || ticket.price_per_ticket || 0),
            quantity: totalQuantity,
            sold: sold,
            total_created: totalCreated,
            available: Math.max(0, totalQuantity - sold),
            description: ticket.description || '',
            is_default: ticket.is_default || false
          };
        });

        // Remove duplicates by creating a map with ticket IDs as keys
        const ticketMap = new Map();

        for (const ticket of normalizedTickets) {
          // Skip default tickets if we already have a ticket with the same name and price
          if (ticket.is_default) {
            const existingTicket = Array.from(ticketMap.values()).find(
              t => t.name === ticket.name && t.price === ticket.price
            );

            if (existingTicket) {
              continue;
            }
          }

          // Add the ticket to the map, using its ID as the key
          ticketMap.set(ticket.id, ticket);
        }

        // Convert the map values back to an array
        return Array.from(ticketMap.values());
      })(),
      // Preserve raw data for debugging
      ticket_types: event.ticket_types,
      total_tickets_sold: event.total_tickets_sold,
      total_revenue: event.total_revenue,
      totalTicketsSold: event.total_tickets_sold || event.totalTicketsSold,
      totalRevenue: event.total_revenue || event.totalRevenue,
    };

    return transformedEvent;
  } catch (error) {
    console.error('Error fetching event:', error);
    throw error;
  }
};

// Format date to a readable string
export function formatDate(dateInput: string | Date, format: 'full' | 'date' | 'time' = 'full'): string {
  try {
    // Handle different date input types
    let date: Date;

    // If it's already a Date object
    if (dateInput instanceof Date) {
      date = dateInput;
    }
    // If it's a string that can be parsed by Date constructor
    else if (typeof dateInput === 'string') {
      // Try parsing the date string
      const parsedDate = new Date(dateInput);

      // If the date is invalid, try parsing with Date.parse
      if (isNaN(parsedDate.getTime())) {
        const timestamp = Date.parse(dateInput);
        if (!isNaN(timestamp)) {
          date = new Date(timestamp);
        } else {
          throw new Error(`Invalid date string: ${dateInput}`);
        }
      } else {
        date = parsedDate;
      }
    } else {
      throw new Error(`Invalid date format: ${typeof dateInput}`);
    }

    // Format based on requested format
    switch (format) {
      case 'date':
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      case 'time':
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });
      case 'full':
      default:
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
    }
  } catch (error) {
    console.error('Error formatting date:', error, 'Input:', dateInput);
    return 'Date not available';
  }
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  // Initialize with default values to prevent null errors
  const defaultEvent: EventData = {
    id: '',
    title: 'Loading...',
    description: '',
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    location: '',
    venue: '',
    isOnline: false,
    ticketTypes: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analytics: {
      ticketSales: [],
      referralSources: [],
      totalTicketsSold: 0,
      totalScannedTickets: 0,
      totalRevenue: 0
    }
  };

  const [event, setEvent] = useState<EventData>(defaultEvent);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const { toast } = useToast();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [shouldRefreshData, setShouldRefreshData] = useState(false);
  const { getToken } = useOrganizerAuth();
  const navigate = useNavigate();

  // Default analytics data
  const defaultAnalytics: AnalyticsData = {
    ticketSales: [],
    referralSources: [],
    totalTicketsSold: 0,
    totalScannedTickets: 0,
    totalRevenue: 0
  };

  // Calculate basic analytics from event data
  const calculateAnalytics = (eventData: EventData | null): AnalyticsData => {
    // Return default analytics if no event data
    if (!eventData) {
      return defaultAnalytics;
    }

    // If no ticket types, return analytics with zeros
    if (!eventData.ticketTypes || eventData.ticketTypes.length === 0) {
      return {
        ticketSales: eventData.analytics?.ticketSales || [],
        referralSources: eventData.analytics?.referralSources || [],
        totalTicketsSold: 0,
        totalScannedTickets: 0,
        totalRevenue: 0
      };
    }

    // Calculate total tickets sold and revenue from ticket types
    const totalTicketsSold = eventData.ticketTypes.reduce((sum, ticket) => sum + (ticket.sold || 0), 0);
    const totalRevenue = eventData.ticketTypes.reduce(
      (sum, ticket) => sum + (ticket.sold || 0) * (ticket.price || 0),
      0
    );

    return {
      ticketSales: eventData.analytics?.ticketSales || [],
      referralSources: eventData.analytics?.referralSources || [],
      totalTicketsSold: eventData.total_tickets_sold || eventData.totalTicketsSold || totalTicketsSold,
      totalScannedTickets: eventData.analytics?.totalScannedTickets || 0,
      totalRevenue: eventData.total_revenue || eventData.totalRevenue || totalRevenue,
    };
  };

  // Calculate analytics whenever event data or tickets change
  const analytics = useMemo(() => {
    const calculated = calculateAnalytics(event || null);
    // Update scanned tickets count from tickets data
    if (tickets && tickets.length > 0) {
      const scannedTickets = tickets.filter(ticket => ticket.scanned).length;
      calculated.totalScannedTickets = scannedTickets;
    }
    return calculated;
  }, [event, tickets]);

  // Fetch tickets for the event
  const fetchTickets = useCallback(async () => {
    if (!id) return;

    try {
      setTicketsLoading(true);
      setTicketsError(null);
      interface TicketsResponse {
        tickets: any[]; // The tickets array is directly under the response data
      }

      const response = await api.get<ApiResponse<TicketsResponse>>(`/organizers/tickets/events/${id}`);
      const ticketsData = response.data.data?.tickets || [];
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
  }, [id, toast]);

  // Handle refresh button click
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      const eventData = await fetchEvent(id!);
      const processedEvent = {
        ...eventData,
        ticketTypes: Array.isArray(eventData.ticketTypes) ? eventData.ticketTypes : []
      };

      setEvent(processedEvent);
      setLastUpdated(new Date());

      // Refresh tickets if needed
      if (processedEvent.ticketTypes?.some(t => t.sold > 0)) {
        await fetchTickets();
      }

      return processedEvent;
    } catch (error) {
      console.error('Error refreshing event:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh event data.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [id, isRefreshing, fetchTickets, toast]);

  // Function to load event data
  const loadEvent = useCallback(async () => {
    if (!id) return null;

    try {
      setIsLoading(true);
      const eventData = await fetchEvent(id);
      const processedEvent = {
        ...eventData,
        ticketTypes: Array.isArray(eventData.ticketTypes) ? eventData.ticketTypes : []
      };

      setEvent(processedEvent);
      setLastUpdated(new Date());

      // Fetch tickets after event data is loaded
      if (processedEvent.ticketTypes?.some(t => t.sold > 0)) {
        await fetchTickets();
      }

      return processedEvent;
    } catch (error) {
      console.error('Error loading event:', error);
      toast({
        title: 'Error',
        description: 'Failed to load event. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [id, fetchTickets, toast]);

  // Initial data load
  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  // Set up polling for data refresh
  useEffect(() => {
    // Only poll if we're on analytics or tickets tab
    const shouldPoll = activeTab === 'analytics' || activeTab === 'tickets';

    if (shouldPoll) {
      let isMounted = true;

      const refreshData = async () => {
        if (!isMounted) return;

        try {
          const eventData = await fetchEvent(id!);
          if (eventData && isMounted) {
            // Analytics will be automatically updated via the useMemo hook

            // Force update the UI with the latest data
            setEvent(prev => ({
              ...prev,
              ...eventData,
              ticketTypes: eventData.ticketTypes || []
            }));
          }
        } catch (error) {
          console.error('Error during refresh:', error);
        }
      };

      // Initial refresh
      refreshData();

      // Set up polling
      const interval = setInterval(refreshData, 30000); // Poll every 30 seconds

      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, [activeTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-3xl flex items-center justify-center shadow-lg">
            <Loader2 className="h-12 w-12 text-white animate-spin" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white mb-3">Loading Event</h3>
            <p className="text-[#a1a1a1] text-lg font-medium">Please wait while we fetch your event details...</p>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Generates a URL for the event
   * @param event - The event data
   * @param type - The type of URL to generate ('view' or 'purchase')
   * @returns The generated URL
   */
  const getEventUrl = (event: EventData, type: 'view' | 'purchase' = 'view'): string => {
    if (!event?.id) {
      console.error('Invalid event data provided to getEventUrl');
      return '';
    }

    const baseUrl = window.location.origin;
    const eventId = event.id;

    // Ensure eventId is a valid string or number
    if (!eventId) {
      console.error('No event ID found in event data');
      return '';
    }

    // Generate the appropriate URL based on the type
    return type === 'purchase'
      ? `${baseUrl}/e/${eventId}/purchase`
      : `${baseUrl}/e/${eventId}`;
  };

  const safeEvent = event || defaultEvent;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Search Header - Sticky */}
      <div className="sticky top-0 z-50 w-full bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between h-14 lg:h-16">
            <div className="flex-1 flex items-center justify-start">
              <Button
                variant="secondary-byblos"
                onClick={() => navigate('/organizer/events')}
                className="rounded-xl px-2 sm:px-3 py-1.5 text-xs sm:text-sm h-8"
              >
                <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </div>

            <div className="flex-shrink-0 flex items-center flex-col">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate max-w-[150px] sm:max-w-[300px]">
                {safeEvent.title}
              </h1>
              <div className="flex items-center gap-2">
                <Badge
                  variant={safeEvent.status === 'published' ? 'default' : 'secondary'}
                  className={`px-1.5 py-0 text-[10px] sm:text-xs font-bold rounded-lg ${safeEvent.status === 'published'
                    ? 'bg-green-500/10 text-green-400 border border-green-400/30'
                    : 'bg-yellow-500/10 text-yellow-400 border border-yellow-400/30'
                    }`}
                >
                  {safeEvent.status === 'published' ? 'Published' : 'Draft'}
                </Badge>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-end">
              <Button
                variant="secondary-byblos"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 sm:gap-2 rounded-xl h-8 px-2 sm:px-3 py-1.5"
              >
                {isRefreshing ? (
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
                )}
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-2 mb-8 sm:mb-12 bg-white/5 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-white/10 w-full sm:w-fit mx-auto">
          <Button
            variant={activeTab === 'overview' ? 'byblos' : 'ghost'}
            onClick={() => setActiveTab('overview')}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 font-semibold text-sm sm:text-base flex-1 sm:flex-none min-w-0 ${activeTab === 'overview'
              ? ' shadow-lg transform scale-105'
              : 'text-[#a1a1a1] hover:text-white hover:bg-white/5 hover:scale-105 transition-all'
              }`}
          >
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Overview</span>
          </Button>
          <Button
            variant={activeTab === 'analytics' ? 'byblos' : 'ghost'}
            onClick={() => setActiveTab('analytics')}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 font-semibold text-sm sm:text-base flex-1 sm:flex-none min-w-0 ${activeTab === 'analytics'
              ? ' shadow-lg transform scale-105'
              : 'text-[#a1a1a1] hover:text-white hover:bg-white/5 hover:scale-105 transition-all'
              }`}
          >
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Analytics</span>
          </Button>
          <Button
            variant={activeTab === 'tickets' ? 'byblos' : 'ghost'}
            onClick={() => setActiveTab('tickets')}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 font-semibold text-sm sm:text-base flex-1 sm:flex-none min-w-0 ${activeTab === 'tickets'
              ? ' shadow-lg transform scale-105'
              : 'text-[#a1a1a1] hover:text-white hover:bg-white/5 hover:scale-105 transition-all'
              }`}
          >
            <Ticket className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Tickets</span>
          </Button>
          <Button
            variant={activeTab === 'settings' ? 'byblos' : 'ghost'}
            onClick={() => setActiveTab('settings')}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 font-semibold text-sm sm:text-base flex-1 sm:flex-none min-w-0 ${activeTab === 'settings'
              ? ' shadow-lg transform scale-105'
              : 'text-[#a1a1a1] hover:text-white hover:bg-white/5 hover:scale-105 transition-all'
              }`}
          >
            <Settings className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Settings</span>
          </Button>
        </div>

        {/* Content Sections */}
        {activeTab === 'overview' && (
          <div className="space-y-12">
            <div className="text-center">
              <h2 className="text-2xl md:text-4xl font-black text-white mb-4">Event Overview</h2>
              <p className="text-[#a1a1a1] text-lg font-medium">Complete details about your event</p>
            </div>

            {/* Event Details Card */}
            <div className="bg-[#111111] rounded-3xl p-8 border border-[#222222]">
              <div className="space-y-8">
                {safeEvent.image_url && (
                  <div className="relative overflow-hidden rounded-2xl">
                    <img
                      src={safeEvent.image_url}
                      alt={safeEvent.title}
                      className="w-full h-64 sm:h-80 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-black text-white mb-3">Description</h3>
                    <p className="text-[#a1a1a1] leading-relaxed">
                      {safeEvent.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <h3 className="text-xl font-black text-white">Date & Time</h3>
                      <div className="flex items-center space-x-3 text-[#a1a1a1]">
                        <Calendar className="h-5 w-5" />
                        <span>{formatDate(safeEvent.startDate, 'full')}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-xl font-black text-white">Location</h3>
                      <div className="flex items-center space-x-3 text-[#a1a1a1]">
                        <MapPin className="h-5 w-5" />
                        <span>{safeEvent.venue}{safeEvent.location && `, ${safeEvent.location}`}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-12">
            <div className="text-center">
              <h2 className="text-2xl md:text-4xl font-black text-white mb-4">Event Analytics</h2>
              <p className="text-[#a1a1a1] text-lg font-medium">Track your event performance</p>
            </div>

            {/* Analytics Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="bg-[#111111] border-[#222222] hover:border-yellow-400/30 transition-all duration-300 transform hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#a1a1a1] mb-1">Tickets Sold</p>
                      <p className="text-xl md:text-3xl font-black text-white mb-2">{analytics.totalTicketsSold.toLocaleString()}</p>
                      <p className="text-xs text-gray-300">Total tickets sold</p>
                    </div>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-green-500/10 border border-green-500/20">
                      <Ticket className="h-8 w-8 text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#111111] border-[#222222] hover:border-yellow-400/30 transition-all duration-300 transform hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#a1a1a1] mb-1">Scanned Tickets</p>
                      <p className="text-xl md:text-3xl font-black text-white mb-2">{analytics.totalScannedTickets.toLocaleString()}</p>
                      <p className="text-xs text-gray-300">Scanned tickets</p>
                      {analytics.totalTicketsSold > 0 && (
                        <p className="text-xs text-gray-300">
                          ({Math.round((analytics.totalScannedTickets / analytics.totalTicketsSold) * 100)}% of total)
                        </p>
                      )}
                    </div>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-blue-500/10 border border-blue-500/20">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        className="h-8 w-8 text-blue-400"
                      >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <path d="m9 11 3 3L22 4" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#111111] border-[#222222] hover:border-yellow-400/30 transition-all duration-300 transform hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#a1a1a1] mb-1">Total Revenue</p>
                      <p className="text-xl md:text-3xl font-black text-white mb-2">
                        {formatCurrency(analytics.totalRevenue)}
                      </p>
                      <p className="text-xs text-gray-300">Total revenue generated</p>
                    </div>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-yellow-500/20 border border-yellow-400/30">
                      <DollarSign className="h-8 w-8 text-yellow-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="space-y-12">
            <div className="text-center">
              <h2 className="text-2xl md:text-4xl font-black text-white mb-4">Ticket Management</h2>
              <p className="text-[#a1a1a1] text-lg font-medium">Manage your event tickets</p>
            </div>

            {/* Ticket Management Tabs */}
            <div className="bg-[#111111] rounded-3xl p-8 border border-[#222222]">
              <Tabs defaultValue="types" className="w-full">
                <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto mb-8 bg-black/40 border border-white/10 rounded-2xl p-1 gap-1 sm:gap-0">
                  <TabsTrigger value="types" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-500 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-300">
                    <List className="h-4 w-4 mr-2" />
                    Ticket Types
                  </TabsTrigger>
                  <TabsTrigger value="list" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-500 data-[state=active]:text-white data-[state=active]:shadow-lg">
                    <Ticket className="h-4 w-4 mr-2" />
                    Ticket List
                  </TabsTrigger>
                  <TabsTrigger value="discounts" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-500 data-[state=active]:text-white data-[state=active]:shadow-lg">
                    <Percent className="h-4 w-4 mr-2" />
                    Discount Codes
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="types" className="space-y-6">
                  <h3 className="text-2xl font-black text-white">Ticket Types</h3>
                  {safeEvent.ticketTypes.length > 0 ? (
                    <div className="space-y-4">
                      {safeEvent.ticketTypes.map((ticket) => (
                        <Card key={ticket.id} className="bg-black/40 border border-white/10 rounded-2xl p-6 shadow-2xl">
                          <CardContent className="p-0">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="font-bold text-white text-lg">{ticket.name}</h4>
                                {ticket.description && (
                                  <p className="text-sm text-[#a1a1a1] mt-1">{ticket.description}</p>
                                )}
                                <p className="text-yellow-400 font-black text-xl mt-2">
                                  KSh {ticket.price.toLocaleString('en-KE', { minimumFractionDigits: 2 })} each
                                </p>
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                              <div>
                                <p className="text-sm text-[#a1a1a1]">Total Tickets</p>
                                <p className="text-2xl font-black text-white">{ticket.quantity || 0}</p>
                              </div>
                              <div>
                                <p className="text-sm text-[#a1a1a1]">Tickets Sold</p>
                                <p className="text-2xl font-black text-white">{ticket.sold || 0}</p>
                                {ticket.quantity > 0 && (
                                  <p className="text-xs text-gray-300">
                                    ({(ticket.sold / ticket.quantity * 100).toFixed(1)}% sold)
                                  </p>
                                )}
                              </div>
                              <div>
                                <p className="text-sm text-[#a1a1a1]">Amount Generated</p>
                                <p className="text-2xl font-black text-white">
                                  KSh {((ticket.sold || 0) * (ticket.price || 0)).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Ticket className="h-16 w-16 mx-auto mb-4 text-[#222222]" />
                      <h3 className="text-xl font-black text-white mb-2">No ticket types available</h3>
                      <p className="text-[#a1a1a1]">This event doesn't have any ticket types configured.</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="list" className="space-y-6">
                  <h3 className="text-2xl font-black text-white">Individual Tickets</h3>
                  {ticketsLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="text-center space-y-4">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto text-yellow-400" />
                        <p className="text-[#a1a1a1] font-medium">Loading tickets...</p>
                      </div>
                    </div>
                  ) : ticketsError ? (
                    <div className="text-center py-12">
                      <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-red-400" />
                      <h3 className="text-xl font-black text-white mb-2">Error Loading Tickets</h3>
                      <p className="text-[#a1a1a1] mb-4">{ticketsError}</p>
                      <Button
                        variant="secondary-byblos"
                        onClick={fetchTickets}
                        className="rounded-xl px-6 py-3"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry
                      </Button>
                    </div>
                  ) : tickets.length > 0 ? (
                    <div className="bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-white/10 hover:bg-white/5">
                              <TableHead className="font-bold text-[#a1a1a1] min-w-[100px]">Ticket #</TableHead>
                              <TableHead className="font-bold text-[#a1a1a1] min-w-[120px]">Type</TableHead>
                              <TableHead className="font-bold text-[#a1a1a1] min-w-[150px]">Customer</TableHead>
                              <TableHead className="font-bold text-[#a1a1a1] min-w-[100px]">Price</TableHead>
                              <TableHead className="font-bold text-[#a1a1a1] min-w-[100px]">Status</TableHead>
                              <TableHead className="font-bold text-[#a1a1a1] min-w-[120px]">Scanned</TableHead>
                              <TableHead className="font-bold text-[#a1a1a1] min-w-[120px]">Purchased</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tickets.map((ticket) => (
                              <TableRow key={ticket.id} className="border-white/5 hover:bg-white/5 transition-colors">
                                <TableCell className="font-medium whitespace-nowrap text-white">
                                  {ticket.ticket_number || `TKT-${ticket.id?.toString().padStart(6, '0')}`}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-[#a1a1a1]">
                                  {ticket.ticket_type_name || ticket.ticket_type || 'General'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-medium whitespace-nowrap text-white">{ticket.customer_name || 'Guest'}</span>
                                    {ticket.customer_email && (
                                      <span className="text-xs text-[#a1a1a1] truncate max-w-[150px]">
                                        {ticket.customer_email}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium whitespace-nowrap text-yellow-400">
                                  KSh {ticket.price?.toLocaleString('en-KE', { minimumFractionDigits: 2 }) || '0.00'}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <Badge
                                    className={`px-3 py-1 text-xs font-bold rounded-xl ${ticket.status === 'paid' ? 'bg-green-500/10 text-green-400 border border-green-400/20' :
                                      ticket.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-400/20' :
                                        ticket.status === 'cancelled' ? 'bg-red-500/10 text-red-400 border border-red-400/20' :
                                          'bg-white/5 text-[#a1a1a1] border border-white/10'
                                      }`}
                                  >
                                    {ticket.status ? ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1) : 'Unknown'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div
                                      className={`h-2.5 w-2.5 rounded-full mr-2 ${ticket.scanned ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-[#333333]'
                                        }`}
                                    />
                                    <span className={`font-medium ${ticket.scanned ? 'text-green-400' : 'text-[#a1a1a1]'}`}>
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
                    <div className="text-center py-12">
                      <Ticket className="h-16 w-16 mx-auto mb-4 text-[#222222]" />
                      <h3 className="text-xl font-black text-white mb-2">No tickets found</h3>
                      <p className="text-[#a1a1a1] mb-4">No individual tickets have been purchased for this event yet.</p>
                      <Button
                        variant="secondary-byblos"
                        onClick={fetchTickets}
                        className="rounded-xl px-6 py-3"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="discounts" className="space-y-6">
                  <DiscountCodeManager eventId={parseInt(id!)} eventName={safeEvent.title} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-12">
            <div className="text-center">
              <h2 className="text-2xl md:text-4xl font-black text-white mb-4">Event Settings</h2>
              <p className="text-[#a1a1a1] text-lg font-medium">Quick actions for your event</p>
            </div>

            {/* Settings Sections */}
            <div className="space-y-8">
              {/* Quick Actions */}
              <div className="bg-[#111111] rounded-3xl p-8 border border-[#222222] shadow-2xl">
                <h3 className="text-2xl font-black text-white mb-6">Quick Actions</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Button
                    variant="secondary-byblos"
                    className="h-16 justify-start gap-4 text-left rounded-xl"
                    onClick={() => navigate(`/organizer/events/${id}/edit`)}
                  >
                    <Edit className="h-6 w-6" />
                    <div>
                      <p className="font-semibold">Edit Event</p>
                      <p className="text-sm text-yellow-400/70">Modify event details</p>
                    </div>
                  </Button>

                  <Button
                    variant="secondary-byblos"
                    className="h-16 justify-start gap-4 text-left rounded-xl"
                    onClick={() => {
                      const viewUrl = getEventUrl(safeEvent, 'view');
                      if (viewUrl) {
                        window.open(viewUrl, '_blank');
                      }
                    }}
                  >
                    <LinkIcon className="h-6 w-6" />
                    <div>
                      <p className="font-semibold">View Event</p>
                      <p className="text-sm text-yellow-400/70">Preview public page</p>
                    </div>
                  </Button>

                  <Button
                    variant="secondary-byblos"
                    className="h-16 justify-start gap-4 text-left rounded-xl"
                    onClick={() => {
                      const purchaseUrl = getEventUrl(safeEvent, 'purchase');
                      if (purchaseUrl) {
                        window.open(purchaseUrl, '_blank');
                      }
                    }}
                  >
                    <ShoppingCart className="h-6 w-6" />
                    <div>
                      <p className="font-semibold">Purchase Page</p>
                      <p className="text-sm text-yellow-400/70">View ticket purchase</p>
                    </div>
                  </Button>
                </div>
              </div>

              {/* Share Links */}
              <div className="bg-[#111111] rounded-3xl p-8 border border-[#222222] shadow-2xl">
                <h3 className="text-2xl font-black text-white mb-6">Share Links</h3>
                <div className="space-y-6">
                  {/* Event View Link */}
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-[#a1a1a1]">Event View Link</Label>
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 flex items-center px-4 py-3 border border-white/10 rounded-xl bg-black/40">
                        <LinkIcon className="h-5 w-5 mr-3 text-[#a1a1a1] flex-shrink-0" />
                        <a
                          href={getEventUrl(safeEvent, 'view')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:underline truncate"
                        >
                          {getEventUrl(safeEvent, 'view')}
                        </a>
                      </div>
                      <Button
                        variant="secondary-byblos"
                        size="sm"
                        onClick={() => {
                          const viewUrl = getEventUrl(safeEvent, 'view');
                          if (viewUrl) {
                            navigator.clipboard.writeText(viewUrl);
                            toast({
                              title: 'Link copied',
                              description: 'Event view link has been copied to your clipboard.',
                            });
                          }
                        }}
                        className="rounded-xl px-4 py-3"
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="text-sm text-[#a1a1a1]">
                      Share this link to let people view your event details
                    </p>
                  </div>

                  {/* Direct Purchase Link */}
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-[#a1a1a1]">Direct Purchase Link</Label>
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 flex items-center px-4 py-3 border border-white/10 rounded-xl bg-black/40">
                        <ShoppingCart className="h-5 w-5 mr-3 text-[#a1a1a1] flex-shrink-0" />
                        <a
                          href={getEventUrl(safeEvent, 'purchase')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:underline truncate"
                        >
                          {getEventUrl(safeEvent, 'purchase')}
                        </a>
                      </div>
                      <Button
                        variant="secondary-byblos"
                        size="sm"
                        onClick={() => {
                          const purchaseUrl = getEventUrl(safeEvent, 'purchase');
                          if (purchaseUrl) {
                            navigator.clipboard.writeText(purchaseUrl);
                            toast({
                              title: 'Link copied',
                              description: 'Purchase link has been copied to your clipboard.',
                            });
                          }
                        }}
                        className="rounded-xl px-4 py-3"
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="text-sm text-[#a1a1a1]">
                      Share this link to take people directly to ticket purchase
                    </p>
                  </div>
                </div>
              </div>

              {/* Event Statistics */}
              <div className="bg-[#111111] rounded-3xl p-8 border border-[#222222] shadow-2xl">
                <h3 className="text-2xl font-black text-white mb-6">Event Statistics</h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <div className="text-center p-6 bg-black/40 rounded-2xl border border-white/10">
                    <div className="w-12 h-12 mx-auto mb-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center">
                      <Ticket className="h-6 w-6 text-green-400" />
                    </div>
                    <p className="text-2xl font-black text-white">{analytics.totalTicketsSold}</p>
                    <p className="text-sm text-[#a1a1a1] font-medium">Tickets Sold</p>
                  </div>

                  <div className="text-center p-6 bg-black/40 rounded-2xl border border-white/10">
                    <div className="w-12 h-12 mx-auto mb-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        className="h-6 w-6 text-blue-400"
                      >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <path d="m9 11 3 3L22 4" />
                      </svg>
                    </div>
                    <p className="text-2xl font-black text-white">{analytics.totalScannedTickets}</p>
                    <p className="text-sm text-[#a1a1a1] font-medium">Scanned</p>
                  </div>

                  <div className="text-center p-6 bg-black/40 rounded-2xl border border-white/10">
                    <div className="w-12 h-12 mx-auto mb-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-yellow-400" />
                    </div>
                    <p className="text-2xl font-black text-white">{formatCurrency(analytics.totalRevenue)}</p>
                    <p className="text-sm text-[#a1a1a1] font-medium">Revenue</p>
                  </div>

                  <div className="text-center p-6 bg-black/40 rounded-2xl border border-white/10">
                    <div className="w-12 h-12 mx-auto mb-3 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-purple-400" />
                    </div>
                    <p className="text-2xl font-black text-white">{safeEvent.ticketTypes.length}</p>
                    <p className="text-sm text-[#a1a1a1] font-medium">Ticket Types</p>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-[#111111] rounded-3xl p-8 border border-[#222222] shadow-2xl">
                <h3 className="text-2xl font-black text-red-500 mb-6">Danger Zone</h3>
                <div className="p-6 border-2 border-red-500/20 rounded-2xl bg-red-500/5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h4 className="font-bold text-red-500 text-lg">Delete this event</h4>
                      <p className="text-sm text-[#a1a1a1] mt-1">
                        Once you delete an event, there is no going back. Please be certain.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
                          try {
                            await api.delete(`/organizers/events/${id}`);
                            toast({
                              title: 'Event deleted',
                              description: 'The event has been deleted successfully.',
                            });
                            navigate('/organizer/events');
                          } catch (error) {
                            console.error('Error deleting event:', error);
                            toast({
                              title: 'Error',
                              description: 'Failed to delete event. Please try again.',
                              variant: 'destructive',
                            });
                          }
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 rounded-xl px-6 py-3"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Event
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
}