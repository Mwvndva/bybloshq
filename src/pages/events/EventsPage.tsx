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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/')}
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl px-3 py-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xl font-black text-black">Events</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Content */}
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-6">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
              <Loader2 className="h-12 w-12 text-yellow-600 animate-spin" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-black mb-3">Loading Events</h3>
              <p className="text-gray-600 text-lg font-medium">Fetching the latest events for you...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/')}
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl px-3 py-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xl font-black text-black">Events</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Content */}
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-6 p-8">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-100 to-red-200 rounded-3xl flex items-center justify-center shadow-lg">
              <AlertCircle className="h-12 w-12 text-red-600" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-black mb-3">Unable to Load Events</h3>
              <p className="text-gray-600 text-lg font-medium max-w-md mx-auto mb-6">
                {error || 'Something went wrong while loading events. Please try again.'}
              </p>
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 overflow-x-hidden w-full">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl px-3 py-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-black text-black">Events</span>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
              className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-2"
            >
              {refreshing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Events
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl font-black text-black mb-2 sm:mb-3">Upcoming Events</h1>
          <p className="text-sm sm:text-base text-gray-600 font-medium">Find and book tickets for amazing events</p>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
              <Calendar className="h-12 w-12 text-yellow-600" />
            </div>
            <h3 className="text-2xl font-black text-black mb-3">No Upcoming Events</h3>
            <p className="text-gray-600 text-lg font-medium max-w-md mx-auto">
              There are no upcoming events at the moment. Please check back later for new events.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {events.map((event) => {
              const isUpcoming = isEventUpcoming(event);
              const isHappeningNow = isEventHappeningNow(event);

              return (
                <Card key={event.id} className="group hover:shadow-2xl transition-all duration-500 border-0 bg-white/80 backdrop-blur-sm transform hover:-translate-y-2 overflow-hidden">
                  <div className="relative">
                    <img
                      src={event.image_url || 'https://images.unsplash.com/photo-1505373877841-8d25f96d3b4a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80'}
                      alt={event.name}
                      className="w-full h-44 sm:h-48 object-cover"
                    />
                    {(() => {
                      const availableTickets = getAvailableTickets(event);

                      if (availableTickets <= 0) {
                        return (
                          <Badge className="absolute top-4 right-4 bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1 text-xs font-bold rounded-xl shadow-lg">
                            Sold Out
                          </Badge>
                        );
                      } else if (isHappeningNow) {
                        return (
                          <Badge className="absolute top-4 right-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-1 text-xs font-bold rounded-xl shadow-lg">
                            Happening Now
                          </Badge>
                        );
                      } else if (isUpcoming) {
                        return (
                          <Badge className="absolute top-4 right-4 bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1 text-xs font-bold rounded-xl shadow-lg">
                            Upcoming
                          </Badge>
                        );
                      } else {
                        return (
                          <Badge className="absolute top-4 right-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white px-3 py-1 text-xs font-bold rounded-xl shadow-lg">
                            Past Event
                          </Badge>
                        );
                      }
                    })()}
                  </div>

                  <CardContent className="p-4 sm:p-6">
                    <div className="flex justify-between items-start mb-3 sm:mb-4">
                      <div className="flex-1 mr-2">
                        <h3 className="text-base sm:text-lg font-black text-black mb-1 line-clamp-2 leading-tight">{event.name}</h3>
                        <p className="text-gray-600 text-xs mb-2 line-clamp-1">{event.location}</p>
                      </div>
                      <Badge variant="outline" className="text-sm font-bold border-yellow-300 text-yellow-600 bg-yellow-50">
                        {event.ticket_price && !isNaN(Number(event.ticket_price)) && Number(event.ticket_price) > 0
                          ? `KSh ${Number(event.ticket_price).toLocaleString('en-US')}`
                          : 'Free'}
                      </Badge>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center text-xs text-gray-600">
                        <Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                        <span className="font-medium">{formatEventDate(event.start_date)}</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-600">
                        <Clock className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                        <span>{formatEventTime(event.start_date)} - {formatEventTime(event.end_date)}</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-600">
                        <MapPin className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                        <span className="truncate">{event.location}</span>
                      </div>
                      <div className="flex items-center text-xs">
                        <Ticket className={`h-4 w-4 mr-2 ${getAvailableTickets(event) > 0 ? 'text-green-500' : 'text-red-500'}`} />
                        <span className={`font-medium ${getAvailableTickets(event) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {getAvailableTickets(event) > 0 ? 'Tickets Available' : 'Sold Out'}
                        </span>
                      </div>
                    </div>

                    {getAvailableTickets(event) > 0 ? (
                      <Button
                        onClick={() => handleBuyTicket(event)}
                        className="w-full h-10 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-md rounded-xl font-bold text-sm transition-all duration-200"
                        disabled={!isUpcoming && !isHappeningNow}
                      >
                        {isHappeningNow ? 'Join Now' : 'Get Tickets'}
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full h-12 bg-gray-100 text-gray-500 cursor-not-allowed rounded-xl font-bold"
                        disabled
                      >
                        Sold Out
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
