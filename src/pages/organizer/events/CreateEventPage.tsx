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
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-screen-2xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="bg-black/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-10 -mx-4 px-4 py-3 mb-6">
          <div className="relative flex items-center justify-between h-12">
            <div className="flex-1 flex items-center justify-start">
              <Button
                variant="secondary-byblos"
                onClick={() => navigate('/organizer/events')}
                className="rounded-xl px-2 sm:px-3 py-1.5 text-xs sm:text-sm h-8"
              >
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 min-w-0 max-w-[70%] text-center px-1 sm:px-2">
              <h1 className="text-sm sm:text-lg md:text-xl font-semibold text-white tracking-tight truncate">
                Create New Event
              </h1>
              <p className="hidden sm:block text-xs text-gray-300 font-normal truncate">
                Fill in the details to launch your next big event
              </p>
            </div>

            <div className="flex-1" />
          </div>
        </div>

        {/* Form Container */}
        <div className="max-w-5xl mx-auto">
          <EventForm onSubmit={handleSubmit} isSubmitting={isSubmitting} submitLabel="Create Event" />
        </div>
      </div>
    </div>
  );
}