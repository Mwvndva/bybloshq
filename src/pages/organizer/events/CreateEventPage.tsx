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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/organizer/events')}
              className="rounded-full hover:bg-white/50 text-gray-500 hover:text-black transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-gray-900">
                Create New Event
              </h1>
              <p className="text-lg text-gray-500 font-medium mt-1">
                Fill in the details to launch your next big event
              </p>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <EventForm onSubmit={handleSubmit} isSubmitting={isSubmitting} submitLabel="Create Event" />
      </div>
    </div>
  );
}