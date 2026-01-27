import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EventForm } from '@/components/events/EventForm';
import { useToast } from '@/components/ui/use-toast';

import api from '@/lib/api';
import { useOrganizerAuth } from '@/hooks/use-organizer-auth';
import { ApiResponse } from '@/types';

interface TicketType {
  id: string;
  name: string;
  price: number;
  quantity: number;
  description: string;
  quantity_sold?: number;
  quantity_available?: number;
}

interface EventData {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: string;
  venue: string;
  isOnline: boolean;
  onlineUrl?: string;
  ticketTypes: Array<{
    id?: string;
    name: string;
    price: number;
    quantity: number;
    description?: string;
    salesStartDate?: Date;
    salesEndDate?: Date;
  }>;
  image_url?: string;
  status?: string;
  image?: File;
}

// Fetch event data from API
const fetchEvent = async (id: string): Promise<EventData> => {
  try {
    interface EventResponse {
      event: any; // Using any for raw event data as it comes from API
    }
    const response = await api.get<ApiResponse<EventResponse>>(`/organizers/events/${id}`);
    const event = response.data.data.event;

    // Transform the API response to match our form's expected format
    return {
      ...event,
      title: event.name, // Map backend 'name' to frontend 'title'
      venue: event.venue || event.location, // Map venue or fallback to location
      location: event.location,
      startDate: new Date(event.start_date),
      endDate: new Date(event.end_date),
      // Map ticket types if they exist
      ticketTypes: event.ticket_types?.map((ticket: any) => ({
        id: ticket.id?.toString(),
        name: ticket.name,
        price: parseFloat(ticket.price),
        quantity: ticket.quantity_available,
        description: ticket.description || '',
        quantity_sold: ticket.quantity_sold,
        quantity_available: ticket.quantity_available,
      })) || [],
    };
  } catch (error) {
    console.error('Error fetching event:', error);
    throw error;
  }
};

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getToken } = useOrganizerAuth();

  useEffect(() => {
    const loadEvent = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        const token = await getToken();
        if (!token) {
          throw new Error('Authentication required');
        }

        const eventData = await fetchEvent(id);
        setEvent(eventData);
      } catch (error) {
        console.error('Error loading event:', error);
        toast({
          title: 'Error',
          description: error.response?.data?.message || 'Failed to load event. Please try again.',
          variant: 'destructive',
        });

        // Redirect to events list if event not found
        if (error.response?.status === 404) {
          navigate('/organizer/events');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadEvent();
  }, [id, toast, getToken, navigate]);

  const handleSubmit = async (formData: EventData) => {
    if (!id) return;

    try {
      setIsSubmitting(true);
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Convert image to base64 if present
      let imageDataUrl = formData.image_url; // Default to existing URL
      if (formData.image instanceof File) {
        imageDataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(formData.image as File);
        });
      }

      // Ensure all ticket type values are properly converted
      const processedTicketTypes = formData.ticketTypes.map(ticket => ({
        id: ticket.id,
        name: ticket.name,
        price: Number(ticket.price),
        quantity: Number(ticket.quantity),
        description: ticket.description || '',
        salesStartDate: ticket.salesStartDate?.toISOString(),
        salesEndDate: ticket.salesEndDate?.toISOString(),
      }));

      // Prepare event data as JSON
      const eventData = {
        name: formData.title,
        description: formData.description,
        location: formData.location,
        start_date: formData.startDate.toISOString(),
        end_date: formData.endDate.toISOString(),
        ticketTypes: processedTicketTypes,
        image_data_url: imageDataUrl !== formData.image_url ? imageDataUrl : undefined, // Only send if changed
        is_online: formData.isOnline,
        online_url: formData.onlineUrl
      };

      await api.put(`/organizers/events/${id}`, eventData);

      toast({
        title: 'Event updated',
        description: 'Your event has been updated successfully.',
      });

      navigate(`/organizer/events/${id}`);
    } catch (error: any) {
      console.error('Error updating event:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update event. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !event) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Search Header - Sticky */}
      <div className="sticky top-0 z-50 w-full bg-black/80 backdrop-blur-md border-b border-white/10 mb-8">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between h-14 lg:h-16">
            <div className="flex-1 flex items-center justify-start">
              <Button
                variant="secondary-byblos"
                onClick={() => navigate(`/organizer/events/${id}`)}
                className="rounded-xl px-2 sm:px-3 py-1.5 text-xs sm:text-sm h-8"
              >
                <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 text-center w-full max-w-[50%] pointer-events-none">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                Edit Event
              </h1>
            </div>

            <div className="flex-1" />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8">

        <EventForm
          defaultValues={{
            ...event,
            // Ensure ticket types have proper dates
            ticketTypes: event.ticketTypes.map(ticket => ({
              ...ticket,
              salesStartDate: ticket.salesStartDate ? new Date(ticket.salesStartDate) : undefined,
              salesEndDate: ticket.salesEndDate ? new Date(ticket.salesEndDate) : undefined
            }))
          }}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submitLabel="Update Event"
          readOnlyOverview={true}
        />
      </div>
    </div>
  );
}
