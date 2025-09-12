import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EventForm } from '@/components/events/EventForm';
import { useToast } from '@/components/ui/use-toast';

import api from '@/lib/api';
import { useOrganizerAuth } from '@/hooks/use-organizer-auth';

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
    const response = await api.get(`/organizers/events/${id}`);
    const event = response.data.data.event;
    
    // Transform the API response to match our form's expected format
    return {
      ...event,
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
      
      const formDataToSend = new FormData();
      
      // Add basic fields
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('start_date', formData.startDate.toISOString());
      formDataToSend.append('end_date', formData.endDate.toISOString());
      formDataToSend.append('location', formData.location);
      formDataToSend.append('venue', formData.venue);
      formDataToSend.append('is_online', String(formData.isOnline));
      
      if (formData.onlineUrl) {
        formDataToSend.append('online_url', formData.onlineUrl);
      }
      
      // Add image if it's a new file
      if (formData.image instanceof File) {
        formDataToSend.append('image', formData.image);
      }
      
      // Add ticket types
      formDataToSend.append('ticket_types', JSON.stringify(
        formData.ticketTypes.map(ticket => ({
          id: ticket.id,
          name: ticket.name,
          price: ticket.price,
          quantity: ticket.quantity,
          description: ticket.description || '',
          sales_start_date: ticket.salesStartDate?.toISOString(),
          sales_end_date: ticket.salesEndDate?.toISOString(),
        }))
      ));
      
      await api.put(`/organizers/events/${id}`, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      
      toast({
        title: 'Event updated',
        description: 'Your event has been updated successfully.',
      });
      
      navigate(`/organizer/events/${id}`);
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        title: 'Error',
        description: 'Failed to update event. Please try again.',
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
    <div className="space-y-6">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mr-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Event</h1>
          <p className="text-muted-foreground">
            Update the details of your event
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
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
        />
      </div>
    </div>
  );
}
