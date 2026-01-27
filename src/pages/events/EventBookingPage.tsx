import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Calendar, MapPin, Clock, ArrowLeft, Loader2, XCircle, RefreshCw, Ticket, CheckCircle2, Users, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getPublicEvent, getEventTicketTypes } from '@/api/eventApi';
import { TicketPurchaseForm } from '@/components/events/TicketPurchaseForm';
import type { TicketType as BaseTicketType } from '@/types/event';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

interface EventTicketType extends Omit<BaseTicketType, 'max_per_order'> {
  max_per_order?: number;
  min_per_order?: number;
  sold?: number;
  available?: number;
  is_sold_out?: boolean;
}

interface Event {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  image_url: string | null;
  ticket_price: number;
  ticket_quantity: number;
  available_tickets?: number;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string;
  ticket_types?: EventTicketType[];
  ticketTypes?: EventTicketType[]; // For backward compatibility
}

interface BookingFormData {
  name: string;
  email: string;
  phone: string;
  ticketCount: number;
}

interface PurchaseResponse {
  success: boolean;
  message: string;
  reference?: string;
}

interface EventBookingPageProps {
  eventId?: string;
}

export default function EventBookingPage({ eventId: propEventId }: EventBookingPageProps = {}) {
  const params = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Use propEventId if provided, otherwise fall back to URL params
  const eventId = propEventId || params.eventId;

  if (!eventId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center shadow-2xl">
            <XCircle className="h-12 w-12 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white mb-3 tracking-tight">Event Not Found</h1>
            <p className="text-[#a1a1a1] text-lg font-medium mb-8">The event you're looking for doesn't exist or has been removed.</p>
            <Button
              variant="secondary-byblos"
              onClick={() => navigate('/events')}
              className="px-8 py-3 rounded-xl font-bold shadow-xl"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Events
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<{
    eventName: string;
    bookingReference: string;
    customerEmail: string;
  } | null>(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketTypes, setTicketTypes] = useState<EventTicketType[]>([]);
  const [loadingTicketTypes, setLoadingTicketTypes] = useState(false);

  // Calculate total price with 2 decimal places


  // Format event date and time
  const formatEventDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'EEEE, MMMM d, yyyy');
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Date not available';
    }
  };

  const formatEventTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'h:mm a');
    } catch (e) {
      console.error('Error formatting time:', e);
      return 'Time not available';
    }
  };

  // Fetch event data
  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) return;

      try {
        setIsLoading(true);
        setError(null);

        // Fetch event data
        const eventData = await getPublicEvent(eventId);

        // If the event is not published, don't show it
        if (eventData.status !== 'published') {
          throw new Error('This event is not available for booking');
        }

        // Fetch ticket types for this event
        try {
          const types = await getEventTicketTypes(eventData.id);

          // Process the ticket types to ensure they have all required fields
          const processedTypes = types.map(type => ({
            ...type,
            event_id: type.event_id || eventData.id,
            quantity_available: type.quantity_available ?? (type.quantity - (type.sold || 0)),
            price: Number(type.price) || 0,
            quantity: type.quantity || 0,
            sold: type.sold || 0,
            created_at: type.created_at || new Date().toISOString(),
            updated_at: type.updated_at || new Date().toISOString()
          }));

          // Filter out any ticket types that are sold out or have no quantity
          const availableTypes = processedTypes.filter(
            type => type.quantity_available > 0 && type.quantity > 0
          );

          // Update event with its ticket types
          setEvent({
            ...eventData,
            ticket_types: availableTypes,
            ticketTypes: availableTypes
          });

        } catch (ticketError) {
          console.error('Error fetching ticket types:', ticketError);
          // Still set the event even if ticket types fail to load
          setEvent(eventData);
          toast({
            title: 'Warning',
            description: 'Event loaded, but there was an issue loading ticket types. Please try again later.',
            variant: 'default'
          });
        }

      } catch (err: any) {
        console.error('Error fetching event:', err);
        const errorMessage = err.message || 'Failed to load event details';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [eventId, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl">
            <Loader2 className="h-12 w-12 text-yellow-400 animate-spin" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Loading Event</h3>
            <p className="text-[#a1a1a1] text-lg font-medium">Please wait while we fetch the event details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center shadow-2xl">
            <XCircle className="h-12 w-12 text-red-500" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white mb-3 tracking-tight">Event Not Found</h2>
            <p className="text-[#a1a1a1] text-lg font-medium mb-8">The event you're looking for doesn't exist or has been removed.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="secondary-byblos"
                onClick={() => window.location.reload()}
                className="rounded-xl px-6 py-3 font-bold"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Try Again
              </Button>
              <Button
                variant="secondary-byblos"
                onClick={() => navigate('/')}
                className="rounded-xl px-6 py-3 font-bold shadow-xl"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate available tickets
  const calculateAvailableTickets = () => {
    // If we have ticket types, sum their available quantities
    if (event.ticket_types?.length) {
      return event.ticket_types.reduce((sum, type) => {
        const available = type.quantity_available ?? (type.quantity - (type.sold || 0));
        return sum + Math.max(0, available);
      }, 0);
    }
    // Fall back to event-level availability
    return event.available_tickets ?? event.ticket_quantity;
  };

  const availableTickets = calculateAvailableTickets();

  // Get event image URL or fallback to a default image
  const getEventImage = (event: Event) => {
    return event.image_url || 'https://images.unsplash.com/photo-1505373876331-ff89baa8f5f8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1740&q=80';
  };

  // Handle ticket purchase
  const handleBuyTicket = async () => {
    if (!event) return;

    // Check if the event is sold out before proceeding
    const availableTickets = calculateAvailableTickets();
    if (availableTickets <= 0) {
      // Don't proceed further if event is sold out
      return;
    }

    try {
      setLoadingTicketTypes(true);

      // First, check if we have ticket types in the event data
      let types = event.ticket_types || event.ticketTypes;

      // If no ticket types in the event data, try to fetch them
      if (!types || types.length === 0) {
        try {
          types = await getEventTicketTypes(event.id);

          // Update the event with the fetched ticket types
          setEvent(prev => ({
            ...prev!,
            ticket_types: types,
            ticketTypes: types
          }));
        } catch (fetchError) {
          console.error('Error fetching ticket types:', fetchError);
          throw new Error('Failed to load ticket types. Please try again.');
        }
      }

      if (!types || types.length === 0) {
        throw new Error('No ticket types available for this event');
      }

      // Process the ticket types to ensure they have all required fields
      const currentDate = new Date();
      const processedTypes = types.map(type => ({
        ...type,
        event_id: type.event_id || event.id,
        quantity_available: type.quantity_available ?? (type.quantity - (type.sold || 0)),
        price: Number(type.price) || 0,
        quantity: type.quantity || 0,
        sold: type.sold || 0,
        min_per_order: type.min_per_order || 1,
        max_per_order: type.max_per_order || 10,
        sales_start_date: type.sales_start_date || event.start_date,
        sales_end_date: type.sales_end_date || event.end_date,
        is_active: type.is_active !== undefined ? type.is_active : true,
        created_at: type.created_at || new Date().toISOString(),
        updated_at: type.updated_at || new Date().toISOString(),
        // Additional calculated fields
        is_available: (type.quantity_available ?? (type.quantity - (type.sold || 0))) > 0 &&
          type.is_active !== false &&
          (!type.sales_start_date || new Date(type.sales_start_date) <= currentDate) &&
          (!type.sales_end_date || new Date(type.sales_end_date) >= currentDate)
      }));

      // Filter out any ticket types that are not available
      const availableTypes = processedTypes.filter(type => type.is_available);

      // Check if we have any available tickets across all types
      const hasAvailableTickets = availableTypes.length > 0 &&
        availableTypes.some(type => (type.quantity_available ?? 1) > 0);

      if (!hasAvailableTickets) {
        // Check for specific reasons why tickets might not be available
        const now = currentDate.getTime();
        const hasInactiveTickets = processedTypes.some(t => !t.is_active);
        const hasFutureSales = processedTypes.some(t =>
          t.sales_start_date && new Date(t.sales_start_date).getTime() > now
        );
        const hasPastSales = processedTypes.some(t =>
          t.sales_end_date && new Date(t.sales_end_date).getTime() < now
        );

        let errorMessage = 'No tickets are currently available for purchase';

        if (hasInactiveTickets) {
          errorMessage = 'All ticket types are currently inactive';
        } else if (processedTypes.every(t => (t.quantity_available ?? 0) <= 0)) {
          errorMessage = 'This event is sold out';
        } else if (hasFutureSales) {
          errorMessage = 'Ticket sales have not started yet';
        } else if (hasPastSales) {
          errorMessage = 'Ticket sales have ended';
        }

        // Show toast with the error message
        toast({
          title: 'Tickets Unavailable',
          description: errorMessage,
          variant: 'destructive',
        });

        // Don't show the form if there are no tickets available
        setShowTicketForm(false);
        return;
      }

      // Sort by price (cheapest first)
      availableTypes.sort((a, b) => a.price - b.price);

      setTicketTypes(availableTypes);
      setShowTicketForm(true);
    } catch (error) {
      console.error('Error in handleBuyTicket:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load ticket information';

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });

      setShowTicketForm(false);
    } finally {
      setLoadingTicketTypes(false);
    }
  };

  // Handle successful ticket purchase
  const handlePurchaseSuccess = () => {
    setShowSuccess(true);
    setShowTicketForm(false);

    // Refresh event data to update available tickets
    if (event) {
      getPublicEvent(event.id).then(updatedEvent => {
        setEvent(updatedEvent);
      }).catch(err => {
        console.error('Error refreshing event data:', err);
      });
    }
  };


  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden w-full">
      {/* Header - Sticky Full Width */}
      <div className="bg-black/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="secondary-byblos"
                onClick={() => navigate(-1)}
                className="rounded-xl px-2 sm:px-3 py-1.5 text-xs sm:text-sm h-8"
              >
                <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-black" />
                </div>
                <span className="text-lg font-black text-white">Event Details</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {error && (
          <div className="bg-red-500/5 backdrop-blur-sm border border-red-500/20 rounded-2xl p-6 mb-8 shadow-2xl">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <XCircle className="h-6 w-6 text-red-500" />
              </div>
              <div className="ml-4">
                <p className="text-red-400 font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Event Details */}
          <div className="lg:col-span-2">
            {event.image_url && (
              <div className="mb-8 overflow-hidden rounded-3xl bg-[#111111] shadow-2xl border border-white/5 aspect-video">
                <img
                  src={event.image_url}
                  alt={event.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const container = target.parentElement;
                    if (container) {
                      container.style.display = 'none';
                    }
                  }}
                />
              </div>
            )}
            <div className="bg-[#111111]/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/10">
              <div className="space-y-8">
                <div>
                  <h1 className="text-2xl sm:text-4xl font-black text-white mb-4 tracking-tight">{event.name}</h1>
                  <p className="text-[#a1a1a1] text-base sm:text-lg font-medium leading-relaxed">{event.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center text-white mb-2">
                      <Calendar className="mr-2 h-4 w-4 text-yellow-500" />
                      <span className="font-bold text-sm">Date</span>
                    </div>
                    <p className="text-[#a1a1a1] text-sm ml-6">
                      {formatEventDate(event.start_date)}
                      {event.end_date && event.end_date !== event.start_date && (
                        <span> - {formatEventDate(event.end_date)}</span>
                      )}
                    </p>
                  </div>

                  <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center text-white mb-2">
                      <Clock className="mr-2 h-4 w-4 text-yellow-500" />
                      <span className="font-bold text-sm">Time</span>
                    </div>
                    <p className="text-[#a1a1a1] text-sm ml-6">
                      {formatEventTime(event.start_date)}
                      {event.end_date && event.end_date !== event.start_date && (
                        <span> - {formatEventTime(event.end_date)}</span>
                      )}
                    </p>
                  </div>

                  <div className="bg-white/5 border border-white/5 rounded-2xl p-6 md:col-span-2">
                    <div className="flex items-center text-white mb-2">
                      <MapPin className="mr-2 h-4 w-4 text-yellow-500" />
                      <span className="font-bold text-sm">Location</span>
                    </div>
                    <p className="text-[#a1a1a1] text-sm ml-6">{event.location}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ticket Purchase Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-[#111111]/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/10 sticky top-12">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-black text-white mb-4 tracking-tight">Reserve Your Spot</h3>
                </div>

                <Button
                  onClick={handleBuyTicket}
                  variant="secondary-byblos"
                  className={`w-full h-12 text-base font-black rounded-xl transition-all duration-300 transform active:scale-95 shadow-xl hover:shadow-yellow-400/20 ${availableTickets <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={availableTickets <= 0 || loadingTicketTypes}
                >
                  {loadingTicketTypes ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Ticket className="mr-2 h-5 w-5" />
                      {availableTickets <= 0 ? 'Sold Out' : 'Book Tickets Now'}
                    </>
                  )}
                </Button>

                {availableTickets <= 0 && (
                  <div className="bg-red-500/5 rounded-2xl p-6 border border-red-500/20">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <XCircle className="h-6 w-6 text-red-500" />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-bold text-red-400 mb-2">Sold Out</h3>
                        <p className="text-[#a1a1a1] leading-relaxed text-sm">
                          All tickets for this event have been sold. Check back later for any last-minute availability.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {availableTickets > 0 && (
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                    <div className="flex items-center mb-3">
                      <Star className="h-5 w-5 text-yellow-500 mr-2" />
                      <span className="font-bold text-white text-sm">Direct Checkout</span>
                    </div>
                    <p className="text-[#a1a1a1] text-xs leading-relaxed">
                      Your tickets are secured instantly upon payment. A confirmation email will be sent immediately.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Ticket Purchase Form */}
        <TicketPurchaseForm
          event={{
            id: event.id,
            name: event.name,
            ticketTypes: ticketTypes
          }}
          open={showTicketForm}
          onOpenChange={(open) => {
            setShowTicketForm(open);
            if (!open) {
              // Reset loading state when closing the form
              setLoadingTicketTypes(false);
            }
          }}
        />
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="bg-[#111111]/95 backdrop-blur-md border border-white/10 shadow-2xl rounded-3xl max-w-md max-h-[85vh] overflow-y-auto p-0 overflow-hidden text-white">
          <div className="p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20 shadow-2xl mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-400" />
            </div>
            <h2 className="text-3xl font-black text-white mb-4 tracking-tight">
              Confirmed!
            </h2>
            <div className="space-y-6">
              <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                <p className="text-[#a1a1a1] leading-relaxed">
                  Thank you for booking <span className="font-bold text-white">{bookingDetails?.eventName}</span>.
                  Check <span className="font-bold text-white">{bookingDetails?.customerEmail}</span> for your tickets.
                </p>
              </div>
              <div className="bg-yellow-400/5 rounded-2xl p-4 border border-yellow-400/10">
                <p className="text-xs text-yellow-500 uppercase tracking-widest font-black mb-1">
                  Reference
                </p>
                <p className="font-mono text-xl text-yellow-400 font-bold">{bookingDetails?.bookingReference}</p>
              </div>
              <div className="flex flex-col gap-3 pt-4">
                <Button
                  variant="secondary-byblos"
                  onClick={() => navigate('/events')}
                  className="rounded-xl px-6 py-4 font-black text-base shadow-xl"
                >
                  Back to Events
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowSuccess(false)}
                  className="text-[#a1a1a1] hover:text-white hover:bg-white/5 rounded-xl font-bold"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
