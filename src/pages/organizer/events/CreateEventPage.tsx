import { useState } from 'react';
import { ApiResponse } from '@/types';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EventForm } from '@/components/events/EventForm';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';

export default function CreateEventPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (formData: any) => {
    try {
      setIsSubmitting(true);

      // Convert image to base64 if present
      let imageDataUrl = '';
      if (formData.image) {
        imageDataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(formData.image);
        });
      }

      // Ensure all ticket type values are properly converted to numbers
      const processedTicketTypes = formData.ticketTypes.map((type: any) => {
        // Ensure price is a number
        const price = typeof type.price === 'string' ?
          parseFloat(type.price) || 0 :
          Number(type.price) || 0;

        // Ensure quantity is an integer
        const quantity = typeof type.quantity === 'string' ?
          parseInt(type.quantity, 10) || 1 :
          Math.max(1, Math.floor(Number(type.quantity) || 1));

        return {
          name: type.name,
          price: price,
          quantity: quantity,
          description: type.description || '',
          salesStartDate: type.salesStartDate?.toISOString(),
          salesEndDate: type.salesEndDate?.toISOString()
        };
      });


      // Prepare the event data for the API
      const eventData = {
        name: formData.title,
        description: formData.description,
        location: formData.isOnline ? 'Online' : formData.venue,
        start_date: formData.startDate.toISOString(),
        end_date: formData.endDate.toISOString(),
        image_data_url: imageDataUrl,
        ticketTypes: processedTicketTypes
      };

      // Make the API request
      console.log('Submitting event data:', eventData);
      const response = await api.post<ApiResponse<{ event: any }>>('/organizers/events', eventData);

      if (response.data.status === 'success') {
        toast({
          title: 'Event created successfully!',
          description: 'Your event has been published.',
        });

        // Redirect to event list
        navigate('/organizer/events');
      } else {
        throw new Error(response.data.message || 'Failed to create event');
      }
    } catch (error: any) {
      console.error('Error creating event:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create event. Please try again.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <h1 className="text-4xl font-black text-black mb-4">Create New Event</h1>
          <p className="text-gray-600 text-lg font-medium">Fill in the details below to create your event</p>
        </div>

        {/* Form Card */}
        <div className="bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-3xl p-8">
          <EventForm onSubmit={handleSubmit} isSubmitting={isSubmitting} submitLabel="Create Event" />
        </div>
      </div>
    </div>
  );
}