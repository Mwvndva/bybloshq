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
import { useOrganizerAuth } from '@/hooks/use-organizer-auth';
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
    console.log(`Fetching event with ID: ${id}`);
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
    console.log('Raw event data from API:', JSON.stringify(event, null, 2));

    // Debug: Log ticket types data
    if (event.ticket_types) {
      console.log('Ticket types data:', JSON.stringify(event.ticket_types, null, 2));
    }

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
              console.log(`Skipping duplicate default ticket: ${ticket.name} (${ticket.price})`);
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

    console.log('Transformed event data:', transformedEvent);
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
    console.log('Calculating analytics:', calculated);
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
      console.log('Tickets API Response:', response.data);
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
            console.log('Refreshed event data:', eventData);
            // Analytics will be automatically updated via the useMemo hook
            console.log('Refreshed event data, analytics will update automatically');

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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
            <Loader2 className="h-12 w-12 text-yellow-600 animate-spin" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-black mb-3">Loading Event</h3>
            <p className="text-gray-600 text-lg font-medium">Please wait while we fetch your event details...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/organizer/events')}
            className="inline-flex items-center gap-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Events
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <h1 className="text-2xl md:text-4xl font-black text-black">{safeEvent.title}</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-10 w-10 rounded-xl hover:bg-gray-100"
            >
              {isRefreshing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-center space-x-4 text-gray-600">
            <Badge
              variant={safeEvent.status === 'published' ? 'default' : 'secondary'}
              className={`px-3 py-1 text-sm font-bold rounded-xl ${safeEvent.status === 'published'
                ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800'
                : 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800'
                }`}
            >
              {safeEvent.status === 'published' ? 'Published' : 'Draft'}
            </Badge>
            <span className="text-sm">Created {formatDistanceToNow(new Date(safeEvent.createdAt), { addSuffix: true })}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-2 mb-8 sm:mb-12 bg-white/60 backdrop-blur-sm p-2 rounded-2xl shadow-lg border border-gray-200/50 w-full sm:w-fit mx-auto">
          <Button
            variant={activeTab === 'overview' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('overview')}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 font-semibold text-sm sm:text-base flex-1 sm:flex-none min-w-0 ${activeTab === 'overview'
              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105'
              : 'text-gray-600 hover:text-black hover:bg-gray-100/80 hover:scale-105'
              }`}
          >
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Overview</span>
          </Button>
          <Button
            variant={activeTab === 'analytics' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('analytics')}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 font-semibold text-sm sm:text-base flex-1 sm:flex-none min-w-0 ${activeTab === 'analytics'
              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105'
              : 'text-gray-600 hover:text-black hover:bg-gray-100/80 hover:scale-105'
              }`}
          >
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Analytics</span>
          </Button>
          <Button
            variant={activeTab === 'tickets' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('tickets')}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 font-semibold text-sm sm:text-base flex-1 sm:flex-none min-w-0 ${activeTab === 'tickets'
              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105'
              : 'text-gray-600 hover:text-black hover:bg-gray-100/80 hover:scale-105'
              }`}
          >
            <Ticket className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Tickets</span>
          </Button>
          <Button
            variant={activeTab === 'settings' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('settings')}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 font-semibold text-sm sm:text-base flex-1 sm:flex-none min-w-0 ${activeTab === 'settings'
              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105'
              : 'text-gray-600 hover:text-black hover:bg-gray-100/80 hover:scale-105'
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
              <h2 className="text-2xl md:text-4xl font-black text-black mb-4">Event Overview</h2>
              <p className="text-gray-600 text-lg font-medium">Complete details about your event</p>
            </div>

            {/* Event Details Card */}
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
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
                    <h3 className="text-2xl font-black text-black mb-3">Description</h3>
                    <p className="text-gray-600 leading-relaxed">
                      {safeEvent.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <h3 className="text-xl font-black text-black">Date & Time</h3>
                      <div className="flex items-center space-x-3 text-gray-600">
                        <Calendar className="h-5 w-5" />
                        <span>{formatDate(safeEvent.startDate, 'full')}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-xl font-black text-black">Location</h3>
                      <div className="flex items-center space-x-3 text-gray-600">
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
              <h2 className="text-2xl md:text-4xl font-black text-black mb-4">Event Analytics</h2>
              <p className="text-gray-600 text-lg font-medium">Track your event performance</p>
            </div>

            {/* Analytics Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="bg-gradient-to-br from-white to-gray-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600 mb-1">Tickets Sold</p>
                      <p className="text-xl md:text-3xl font-black text-black mb-2">{analytics.totalTicketsSold.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Total tickets sold</p>
                    </div>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-green-100 to-green-200">
                      <Ticket className="h-8 w-8" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-white to-gray-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600 mb-1">Scanned Tickets</p>
                      <p className="text-xl md:text-3xl font-black text-black mb-2">{analytics.totalScannedTickets.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Scanned tickets</p>
                      {analytics.totalTicketsSold > 0 && (
                        <p className="text-xs text-gray-500">
                          ({Math.round((analytics.totalScannedTickets / analytics.totalTicketsSold) * 100)}% of total)
                        </p>
                      )}
                    </div>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-blue-100 to-blue-200">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        className="h-8 w-8"
                      >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <path d="m9 11 3 3L22 4" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-white to-gray-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600 mb-1">Total Revenue</p>
                      <p className="text-xl md:text-3xl font-black text-black mb-2">
                        {formatCurrency(analytics.totalRevenue)}
                      </p>
                      <p className="text-xs text-gray-500">Total revenue generated</p>
                    </div>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-yellow-100 to-yellow-200">
                      <DollarSign className="h-8 w-8" />
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
              <h2 className="text-2xl md:text-4xl font-black text-black mb-4">Ticket Management</h2>
              <p className="text-gray-600 text-lg font-medium">Manage your event tickets</p>
            </div>

            {/* Ticket Management Tabs */}
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
              <Tabs defaultValue="types" className="w-full">
                <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto mb-8 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-1 gap-1 sm:gap-0">
                  <TabsTrigger value="types" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-500 data-[state=active]:text-white data-[state=active]:shadow-lg">
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
                  <h3 className="text-2xl font-black text-black">Ticket Types</h3>
                  {safeEvent.ticketTypes.length > 0 ? (
                    <div className="space-y-4">
                      {safeEvent.ticketTypes.map((ticket) => (
                        <Card key={ticket.id} className="border border-gray-200 rounded-2xl p-6 bg-white/50 backdrop-blur-sm shadow-lg">
                          <CardContent className="p-0">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="font-bold text-black text-lg">{ticket.name}</h4>
                                {ticket.description && (
                                  <p className="text-sm text-gray-600 mt-1">{ticket.description}</p>
                                )}
                                <p className="text-yellow-600 font-black text-xl mt-2">
                                  KSh {ticket.price.toLocaleString('en-KE', { minimumFractionDigits: 2 })} each
                                </p>
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                              <div>
                                <p className="text-sm text-gray-600">Total Tickets</p>
                                <p className="text-2xl font-black text-black">{ticket.quantity || 0}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Tickets Sold</p>
                                <p className="text-2xl font-black text-black">{ticket.sold || 0}</p>
                                {ticket.quantity > 0 && (
                                  <p className="text-xs text-gray-500">
                                    ({(ticket.sold / ticket.quantity * 100).toFixed(1)}% sold)
                                  </p>
                                )}
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Amount Generated</p>
                                <p className="text-2xl font-black text-black">
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
                      <Ticket className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-xl font-black text-black mb-2">No ticket types available</h3>
                      <p className="text-gray-600">This event doesn't have any ticket types configured.</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="list" className="space-y-6">
                  <h3 className="text-2xl font-black text-black">Individual Tickets</h3>
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
                                  {ticket.ticket_type_name || ticket.ticket_type || 'General'}
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
                    <div className="text-center py-12">
                      <Ticket className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-xl font-black text-black mb-2">No tickets found</h3>
                      <p className="text-gray-600 mb-4">No individual tickets have been purchased for this event yet.</p>
                      <Button
                        variant="outline"
                        onClick={fetchTickets}
                        className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-6 py-3"
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
              <h2 className="text-2xl md:text-4xl font-black text-black mb-4">Event Settings</h2>
              <p className="text-gray-600 text-lg font-medium">Quick actions for your event</p>
            </div>

            {/* Settings Sections */}
            <div className="space-y-8">
              {/* Quick Actions */}
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
                <h3 className="text-2xl font-black text-black mb-6">Quick Actions</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Button
                    variant="outline"
                    className="h-16 justify-start gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-xl"
                    onClick={() => navigate(`/organizer/events/${id}/edit`)}
                  >
                    <Edit className="h-6 w-6" />
                    <div>
                      <p className="font-semibold">Edit Event</p>
                      <p className="text-sm text-gray-500">Modify event details</p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-16 justify-start gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-xl"
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
                      <p className="text-sm text-gray-500">Preview public page</p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-16 justify-start gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-xl"
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
                      <p className="text-sm text-gray-500">View ticket purchase</p>
                    </div>
                  </Button>
                </div>
              </div>

              {/* Share Links */}
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
                <h3 className="text-2xl font-black text-black mb-6">Share Links</h3>
                <div className="space-y-6">
                  {/* Event View Link */}
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-700">Event View Link</Label>
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 flex items-center px-4 py-3 border-2 border-gray-200 rounded-xl bg-white">
                        <LinkIcon className="h-5 w-5 mr-3 text-gray-500 flex-shrink-0" />
                        <a
                          href={getEventUrl(safeEvent, 'view')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate"
                        >
                          {getEventUrl(safeEvent, 'view')}
                        </a>
                      </div>
                      <Button
                        variant="outline"
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
                        className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-3"
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500">
                      Share this link to let people view your event details
                    </p>
                  </div>

                  {/* Direct Purchase Link */}
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-700">Direct Purchase Link</Label>
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 flex items-center px-4 py-3 border-2 border-gray-200 rounded-xl bg-white">
                        <ShoppingCart className="h-5 w-5 mr-3 text-gray-500 flex-shrink-0" />
                        <a
                          href={getEventUrl(safeEvent, 'purchase')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate"
                        >
                          {getEventUrl(safeEvent, 'purchase')}
                        </a>
                      </div>
                      <Button
                        variant="outline"
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
                        className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-3"
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500">
                      Share this link to take people directly to ticket purchase
                    </p>
                  </div>
                </div>
              </div>

              {/* Event Statistics */}
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
                <h3 className="text-2xl font-black text-black mb-6">Event Statistics</h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <div className="text-center p-6 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center">
                      <Ticket className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="text-2xl font-black text-black">{analytics.totalTicketsSold}</p>
                    <p className="text-sm text-gray-600 font-medium">Tickets Sold</p>
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
                    <p className="text-2xl font-black text-black">{analytics.totalScannedTickets}</p>
                    <p className="text-sm text-gray-600 font-medium">Scanned</p>
                  </div>

                  <div className="text-center p-6 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-xl flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-yellow-600" />
                    </div>
                    <p className="text-2xl font-black text-black">{formatCurrency(analytics.totalRevenue)}</p>
                    <p className="text-sm text-gray-600 font-medium">Revenue</p>
                  </div>

                  <div className="text-center p-6 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-purple-600" />
                    </div>
                    <p className="text-2xl font-black text-black">{safeEvent.ticketTypes.length}</p>
                    <p className="text-sm text-gray-600 font-medium">Ticket Types</p>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
                <h3 className="text-2xl font-black text-red-600 mb-6">Danger Zone</h3>
                <div className="p-6 border-2 border-red-200 rounded-2xl bg-red-50/50">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h4 className="font-bold text-red-600 text-lg">Delete this event</h4>
                      <p className="text-sm text-gray-600 mt-1">
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