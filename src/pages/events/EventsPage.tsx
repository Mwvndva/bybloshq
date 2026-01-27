import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { Calendar, MapPin, Clock, Ticket, Home, ArrowRight, AlertCircle, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { getUpcomingEvents, getEventTicketTypes, purchaseTickets } from '@/api/eventApi';
import type { Event, TicketType } from '@/types/event';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { TicketPurchaseForm } from '@/components/events/TicketPurchaseForm';

interface EventsPageProps {
  eventId?: string;
  isEmbed?: boolean;
}

export default function EventsPage({ eventId, isEmbed = false }: EventsPageProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loadingTicketTypes, setLoadingTicketTypes] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setRefreshing(!showLoading);

      const data = await getUpcomingEvents(20); // Get up to 20 upcoming events

      // Debug log the raw API response
      console.log('Raw API response:', data);

      // The backend already filters for upcoming events, so we just need to ensure they're valid
      const validEvents = data.filter(event => {
        const isValid = event && event.start_date && event.end_date;
        if (isValid) {
          console.log(`Event ${event.id} (${event.name}):`, {
            available_tickets: event.available_tickets,
            tickets_sold: event.tickets_sold,
            ticket_quantity: event.ticket_quantity,
            calculatedAvailable: event.ticket_quantity - (event.tickets_sold || 0)
          });
        }
        return isValid;
      });

      setEvents(validEvents);
      setError(null);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load events. Please try again later.';
      console.error('Error fetching events:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });

      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvents();

    // Set up auto-refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchEvents(false);
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

  // Format event date and time
  const formatEventDate = (dateString: string) => {
    return format(parseISO(dateString), 'PPP');
  };

  const formatEventTime = (dateString: string) => {
    return format(parseISO(dateString), 'h:mm a');
  };

  const isEventUpcoming = (event: Event) => {
    const now = new Date();
    return isAfter(parseISO(event.start_date), now);
  };

  const isEventHappeningNow = (event: Event) => {
    const now = new Date();
    return (
      isBefore(parseISO(event.start_date), now) &&
      isAfter(parseISO(event.end_date), now)
    );
  };

  // Calculate available tickets
  const getAvailableTickets = (event: Event) => {
    // If the event has ticket types, check if any are available
    if (event.ticket_types && event.ticket_types.length > 0) {
      const availableTickets = event.ticket_types.reduce((sum, type) => {
        const available = type.available !== undefined ? type.available : (type.quantity - (type.sold || 0));
        return sum + Math.max(0, available);
      }, 0);

      console.log(`Event ${event.id} (${event.name}) has ${availableTickets} tickets available across all types`);
      return availableTickets;
    }

    // Fall back to event-level ticket availability
    let available = 0;

    if (typeof event.available_tickets === 'number' && !isNaN(event.available_tickets)) {
      available = event.available_tickets;
    } else if (typeof event.tickets_sold === 'number' && typeof event.ticket_quantity === 'number') {
      available = event.ticket_quantity - event.tickets_sold;
    } else if (typeof event.ticket_quantity === 'number') {
      available = event.ticket_quantity;
    }

    // Ensure we don't return negative numbers
    return Math.max(0, available);
  };

  // Get event image URL or fallback to a default image
  const getEventImage = (event: Event) => {
    return event.image_url || 'https://images.unsplash.com/photo-1505373876331-ff89baa8f5f8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1740&q=80';
  };

  const handleBuyTicket = async (event: Event) => {
    console.log('handleBuyTicket called for event:', event.id);
    try {
      console.log('Setting selected event and showing loading state');
      setSelectedEvent(event);
      setLoadingTicketTypes(true);

      // First check if the event is sold out using available_tickets
      const availableTickets = event.available_tickets ?? event.ticket_quantity;
      if (availableTickets <= 0) {
        throw new Error('This event is sold out');
      }

      console.log('Fetching ticket types...');
      const types = await getEventTicketTypes(event.id);
      console.log('Received ticket types:', types);

      // Check if we have valid ticket types with available quantities
      const hasAvailableTickets = types.length === 0 || types.some(type =>
        type.quantity_available > 0 || type.quantity_available === undefined
      );

      if (!hasAvailableTickets) {
        throw new Error('No tickets available for this event');
      }

      // Set the ticket types and show the form
      console.log('Setting ticket types in state');
      setTicketTypes(types);
      setShowTicketForm(true);

      console.log('Ticket form is now visible with types');
    } catch (error) {
      console.error('Error in handleBuyTicket:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load ticket information';

      toast({
        title: 'Tickets Unavailable',
        description: errorMessage,
        variant: 'destructive',
      });

      // Always hide the form on error
      setShowTicketForm(false);
    } finally {
      console.log('Setting loading to false');
      setLoadingTicketTypes(false);
    }
  };

  interface PurchaseFormData {
    customerName: string;
    customerEmail: string;
    phoneNumber: string;
    ticketTypeId?: string | number;
    quantity: number;
    eventId?: number;
  }

  const handleTicketPurchase = async (data: PurchaseFormData) => {
    if (!selectedEvent) {
      throw new Error('No event selected');
    }

    try {
      console.log('Starting ticket purchase with data:', data);

      // Trim all string fields and ensure proper types
      const trimmedData = {
        ...data,
        customerName: data.customerName?.trim() || '',
        customerEmail: data.customerEmail?.trim().toLowerCase() || '',
        phoneNumber: data.phoneNumber?.replace(/\s+/g, '') || '', // Remove all whitespace from phone
        quantity: Number(data.quantity) || 1,
        ticketTypeId: data.ticketTypeId ? Number(data.ticketTypeId) : null
      };

      console.log('Processed form data:', trimmedData);

      // Validate required fields
      const validationErrors: string[] = [];

      if (!trimmedData.customerName || trimmedData.customerName.length < 2) {
        validationErrors.push('Please enter a valid name (at least 2 characters)');
      } else if (trimmedData.customerName.length > 100) {
        validationErrors.push('Name cannot exceed 100 characters');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!trimmedData.customerEmail) {
        validationErrors.push('Please enter your email address');
      } else if (!emailRegex.test(trimmedData.customerEmail)) {
        validationErrors.push('Please enter a valid email address');
      } else if (trimmedData.customerEmail.length > 255) {
        validationErrors.push('Email address cannot exceed 255 characters');
      }

      if (!trimmedData.phoneNumber) {
        validationErrors.push('Please enter your phone number');
      } else if (!/^\+?[0-9\s-]{8,20}$/.test(trimmedData.phoneNumber)) {
        validationErrors.push('Please enter a valid phone number (8-20 digits)');
      }

      if (isNaN(trimmedData.quantity) || trimmedData.quantity < 1) {
        validationErrors.push('Please enter a valid quantity');
      }

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('\n'));
      }

      // Check ticket availability before proceeding
      const availableTickets = selectedEvent.available_tickets ?? selectedEvent.ticket_quantity;
      const requestedQuantity = Number(data.quantity) || 1;

      if (availableTickets <= 0) {
        toast({
          title: 'Tickets Sold Out',
          description: 'Sorry, this event is completely sold out.',
          variant: 'destructive',
        });
        setShowTicketForm(false);
        return;
      }

      if (requestedQuantity > availableTickets) {
        toast({
          title: 'Not Enough Tickets',
          description: `Only ${availableTickets} ticket${availableTickets !== 1 ? 's' : ''} available.`,
          variant: 'destructive',
        });
        return;
      }

      // Prepare purchase data with proper types
      let ticketTypeId: number | undefined;

      if (trimmedData.ticketTypeId) {
        // If ticketTypeId is a string, convert it to a number
        ticketTypeId = typeof trimmedData.ticketTypeId === 'string'
          ? parseInt(trimmedData.ticketTypeId, 10)
          : trimmedData.ticketTypeId;
      } else if (selectedEvent.ticketTypes?.[0]?.id) {
        // Fall back to first available ticket type if none selected
        ticketTypeId = selectedEvent.ticketTypes[0].id;
      }

      const purchaseData = {
        eventId: selectedEvent.id,
        quantity: requestedQuantity,
        customerName: trimmedData.customerName,
        customerEmail: trimmedData.customerEmail,
        phoneNumber: trimmedData.phoneNumber,
        ticketTypeId: ticketTypeId !== undefined ? ticketTypeId : undefined
      };

      console.log('Prepared purchase data:', purchaseData);

      // Call the API to process the ticket purchase
      const result = await purchaseTickets(purchaseData);

      // Show success message with transaction details
      toast({
        title: 'Purchase Successful!',
        description: `Your tickets for ${selectedEvent.name} have been booked. A confirmation has been sent to ${trimmedData.customerEmail}.`,
        variant: 'default',
        duration: 10000,
      });

      // Refresh events to update available tickets
      await fetchEvents(false);

      // Close the form
      setShowTicketForm(false);

    } catch (error) {
      console.error('Error purchasing tickets:', error);

      // Show user-friendly error message
      toast({
        title: 'Purchase Failed',
        description: error.message || 'Failed to process ticket purchase. Please try again.',
        variant: 'destructive',
      });

      // If the error is about ticket availability, close the form
      if (error.message?.toLowerCase().includes('ticket') &&
        (error.message.toLowerCase().includes('sold out') ||
          error.message.toLowerCase().includes('available'))) {
        setShowTicketForm(false);
      }

      throw error; // Re-throw for form handling if needed
    }
  };

  const handleViewEvent = (eventId: number) => {
    navigate(`/events/${eventId}`);
  };

  const handleRefresh = () => {
    fetchEvents();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Header - Sticky */}
        <div className="bg-black/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Button
                  variant="secondary-byblos"
                  onClick={() => navigate('/')}
                  className="rounded-xl px-2 sm:px-3 py-1.5 text-xs sm:text-sm h-8"
                >
                  <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-black" />
                  </div>
                  <span className="text-xl font-black text-white">Events</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Content */}
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center space-y-6">
            <div className="w-24 h-24 mx-auto bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl">
              <Loader2 className="h-12 w-12 text-yellow-400 animate-spin" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white mb-2">Loading Events</h3>
              <p className="text-[#a1a1a1] text-lg font-medium">Fetching the latest events for you...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Header - Sticky */}
        <div className="bg-black/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Button
                  variant="secondary-byblos"
                  onClick={() => navigate('/')}
                  className="rounded-xl px-2 sm:px-3 py-1.5 text-xs sm:text-sm h-8"
                >
                  <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-black" />
                  </div>
                  <span className="text-xl font-black text-white">Events</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Content */}
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center space-y-6 p-8">
            <div className="w-24 h-24 mx-auto bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center shadow-2xl">
              <AlertCircle className="h-12 w-12 text-red-500" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white mb-2">Unable to Load Events</h3>
              <p className="text-[#a1a1a1] text-lg font-medium max-w-md mx-auto mb-8">
                {error || 'Something went wrong while loading events. Please try again.'}
              </p>
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                variant="secondary-byblos"
                className="shadow-xl px-8 py-3 rounded-xl font-bold"
              >
                {refreshing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Try Again
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden w-full">
      {/* Header - Sticky */}
      <div className="bg-black/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="secondary-byblos"
                onClick={() => navigate('/')}
                className="rounded-xl px-2 sm:px-3 py-1.5 text-xs sm:text-sm h-8"
              >
                <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-black" />
                </div>
                <span className="text-lg font-black text-white">Events</span>
              </div>
            </div>
            <Button
              variant="secondary-byblos"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-xl px-4 py-2 h-9 text-sm"
            >
              {refreshing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-5xl font-black text-white mb-4 tracking-tight">Upcoming Events</h1>
          <p className="text-[#a1a1a1] text-lg font-medium">Find and book tickets for amazing events</p>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-8 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl">
              <Calendar className="h-12 w-12 text-yellow-400" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2">No Upcoming Events</h3>
            <p className="text-[#a1a1a1] text-lg font-medium max-w-md mx-auto">
              There are no upcoming events at the moment. Please check back later for new events.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {events.map((event) => {
              const isUpcoming = isEventUpcoming(event);
              const isHappeningNow = isEventHappeningNow(event);

              return (
                <Card key={event.id} className="group hover:shadow-[0_0_50px_rgba(250,204,21,0.1)] transition-all duration-500 border border-white/10 bg-[#111111]/80 backdrop-blur-sm transform hover:-translate-y-2 overflow-hidden rounded-2xl">
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={event.image_url || 'https://images.unsplash.com/photo-1505373877841-8d25f96d3b4a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80'}
                      alt={event.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent opacity-60" />
                    {(() => {
                      const availableTickets = getAvailableTickets(event);

                      if (availableTickets <= 0) {
                        return (
                          <Badge className="absolute top-4 right-4 bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1 text-xs font-bold rounded-lg shadow-lg backdrop-blur-md">
                            Sold Out
                          </Badge>
                        );
                      } else if (isHappeningNow) {
                        return (
                          <Badge className="absolute top-4 right-4 bg-blue-500/10 text-blue-400 border border-blue-400/20 px-3 py-1 text-xs font-bold rounded-lg shadow-lg backdrop-blur-md">
                            Happening Now
                          </Badge>
                        );
                      } else if (isUpcoming) {
                        return (
                          <Badge className="absolute top-4 right-4 bg-green-500/10 text-green-400 border border-green-400/20 px-3 py-1 text-xs font-bold rounded-lg shadow-lg backdrop-blur-md">
                            Upcoming
                          </Badge>
                        );
                      } else {
                        return (
                          <Badge className="absolute top-4 right-4 bg-white/5 text-[#a1a1a1] border border-white/10 px-3 py-1 text-xs font-bold rounded-lg shadow-lg backdrop-blur-md">
                            Past Event
                          </Badge>
                        );
                      }
                    })()}
                  </div>

                  <CardContent className="p-5 sm:p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 min-w-0 pr-3">
                        <h3 className="text-lg sm:text-xl font-black text-white mb-2 line-clamp-2 leading-tight group-hover:text-yellow-400 transition-colors">
                          {event.name}
                        </h3>
                        <div className="flex items-center text-[#a1a1a1] text-xs">
                          <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Badge variant="outline" className="text-sm font-black border-yellow-400/30 text-yellow-400 bg-yellow-400/5 px-2.5 py-1">
                          {event.ticket_price && !isNaN(Number(event.ticket_price)) && Number(event.ticket_price) > 0
                            ? `KSh ${Number(event.ticket_price).toLocaleString('en-US')}`
                            : 'Free'}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="flex items-center text-xs text-[#a1a1a1] bg-white/5 rounded-lg px-2.5 py-2 border border-white/5">
                        <Calendar className="h-3.5 w-3.5 mr-2 text-yellow-500/70" />
                        <span className="truncate">{formatEventDate(event.start_date)}</span>
                      </div>
                      <div className="flex items-center text-xs text-[#a1a1a1] bg-white/5 rounded-lg px-2.5 py-2 border border-white/5">
                        <Clock className="h-3.5 w-3.5 mr-2 text-yellow-500/70" />
                        <span className="truncate">{formatEventTime(event.start_date)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center text-xs">
                        <div className={`h-2 w-2 rounded-full mr-2 ${getAvailableTickets(event) > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className={`font-bold ${getAvailableTickets(event) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {getAvailableTickets(event) > 0 ? 'Tickets Available' : 'Sold Out'}
                        </span>
                      </div>
                      {getAvailableTickets(event) > 0 && (
                        <span className="text-[10px] text-[#a1a1a1] font-medium uppercase tracking-wider">
                          Limited quantities
                        </span>
                      )}
                    </div>

                    {getAvailableTickets(event) > 0 ? (
                      <Button
                        onClick={() => handleBuyTicket(event)}
                        variant="secondary-byblos"
                        className="w-full h-11 rounded-xl font-black text-sm transition-all duration-300 transform active:scale-95 group-hover:shadow-[0_0_20px_rgba(250,204,21,0.2)]"
                        disabled={!isUpcoming && !isHappeningNow}
                      >
                        {isHappeningNow ? 'Join Event' : 'Book Tickets'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full h-11 bg-white/5 border-white/10 text-[#555555] cursor-not-allowed rounded-xl font-bold"
                        disabled
                      >
                        Unavailable
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Ticket Purchase Form Modal */}
        {selectedEvent && (
          <TicketPurchaseForm
            event={{
              id: selectedEvent.id,
              name: selectedEvent.name,
              ticketTypes: ticketTypes
            }}
            open={showTicketForm}
            onOpenChange={setShowTicketForm}
          />
        )}
      </div>
    </div>
  );
}
