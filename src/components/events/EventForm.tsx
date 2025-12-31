import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Image as ImageIcon, UploadCloud, X } from 'lucide-react';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';

const eventFormSchema = z.object({
  title: z.string().min(1, 'Event title is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  startDate: z.date({
    required_error: 'Start date is required',
  }),
  endDate: z.date({
    required_error: 'End date is required',
  }),
  location: z.string().min(1, 'Location is required'),
  venue: z.string().min(1, 'Venue name is required'),
  image: z.instanceof(File).optional(),
  ticketTypes: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1, 'Ticket type name is required'),
      price: z.number().min(0, 'Price must be 0 or more'),
      quantity: z.number().min(1, 'Quantity must be at least 1'),
      description: z.string().optional(),
      salesStartDate: z.date().optional(),
      salesEndDate: z.date().optional(),
    })
  ).min(1, 'At least one ticket type is required')
    .refine(tickets => tickets.some(t => t.price > 0), {
      message: 'At least one ticket type must have a price greater than 0',
      path: ['ticketTypes'],
    }),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

interface EventFormProps {
  defaultValues?: Partial<EventFormValues>;
  onSubmit: (data: EventFormValues) => void;
  isSubmitting: boolean;
  submitLabel?: string;
}

export function EventForm({ defaultValues, onSubmit, isSubmitting, submitLabel }: EventFormProps) {

  const [imagePreview, setImagePreview] = useState<string | null>(
    defaultValues?.image ? URL.createObjectURL(defaultValues.image as unknown as Blob) : null
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    control,
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      ticketTypes: [{ name: 'General Admission', price: 0, quantity: 100 }],
      ...defaultValues,
    },
  });

  const ticketTypes = watch('ticketTypes');

  // Helper function to safely format time
  const formatTime = (date: Date | string | undefined): string => {
    if (!date) return '';
    try {
      const d = new Date(date);
      return isNaN(d.getTime()) ? '' : format(d, 'HH:mm');
    } catch (e) {
      return '';
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setValue('image', file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setValue('image', undefined);
    setImagePreview(null);
  };

  const addTicketType = () => {
    setValue('ticketTypes', [
      ...ticketTypes,
      {
        name: '',
        price: 0,
        quantity: 100,
        description: '',
        salesStartDate: new Date(),
        salesEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      },
    ]);
  };

  const removeTicketType = (index: number) => {
    if (ticketTypes.length > 1) {
      const updated = [...ticketTypes];
      updated.splice(index, 1);
      setValue('ticketTypes', updated);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="space-y-8">
        {/* Event Image */}
        <div>
          <Label className="text-lg font-semibold text-black mb-4 block">Event Image</Label>
          <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
            <div className="relative h-40 w-40 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 shadow-lg">
              {imagePreview ? (
                <>
                  <img
                    src={imagePreview}
                    alt="Event preview"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 bg-red-500/80 rounded-full p-1.5 text-white hover:bg-red-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-400">
                  <ImageIcon className="h-12 w-12" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <input
                type="file"
                id="image"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
              <Label
                htmlFor="image"
                className="inline-flex items-center px-6 py-3 border-2 border-dashed border-gray-300 rounded-2xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 cursor-pointer transition-all duration-200"
              >
                <UploadCloud className="h-5 w-5 mr-2" />
                {imagePreview ? 'Change Image' : 'Upload Image'}
              </Label>
              <p className="mt-2 text-sm text-gray-500">
                Recommended size: 1200x630px (2:1 aspect ratio)
              </p>
              {errors.image && (
                <p className="mt-1 text-sm text-red-600">{errors.image.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Event Details */}
        <div className="space-y-6">
          <h3 className="text-2xl font-black text-black">Event Details</h3>

          <div>
            <Label htmlFor="title" className="text-base font-semibold text-black mb-2 block">Event Title *</Label>
            <Input
              id="title"
              {...register('title')}
              className={`h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 text-black ${errors.title ? 'border-red-500' : ''}`}
              placeholder="Enter your event title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description" className="text-base font-semibold text-black mb-2 block">Description *</Label>
            <Textarea
              id="description"
              rows={4}
              {...register('description')}
              className={`rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 text-black ${errors.description ? 'border-red-500' : ''}`}
              placeholder="Describe your event in detail"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <Label className="text-base font-semibold text-black mb-2 block">Start Date & Time *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full h-12 justify-start text-left font-normal text-black rounded-xl border-gray-200 hover:border-yellow-400 focus:border-yellow-400',
                      errors.startDate && 'border-red-500'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watch('startDate') && !isNaN(new Date(watch('startDate') as Date).getTime()) ? (
                      format(new Date(watch('startDate') as Date), 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={watch('startDate')}
                    onSelect={(date) => setValue('startDate', date as Date)}
                    initialFocus
                  />
                  <div className="p-3 border-t">
                    <Input
                      type="time"
                      value={formatTime(watch('startDate'))}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':').map(Number);
                        const currentDate = watch('startDate');
                        const date = currentDate ? new Date(currentDate) : new Date();

                        // Only update if we have valid hours and minutes
                        if (!isNaN(hours) && !isNaN(minutes)) {
                          date.setHours(hours, minutes, 0, 0);
                          setValue('startDate', date);
                        }
                      }}
                      className="w-full text-black"
                    />
                  </div>
                </PopoverContent>
              </Popover>
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
              )}
            </div>

            <div>
              <Label className="text-base font-semibold text-black mb-2 block">End Date & Time *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full h-12 justify-start text-left font-normal text-black rounded-xl border-gray-200 hover:border-yellow-400 focus:border-yellow-400',
                      errors.endDate && 'border-red-500'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watch('endDate') && !isNaN(new Date(watch('endDate') as Date).getTime()) ? (
                      format(new Date(watch('endDate') as Date), 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={watch('endDate')}
                    onSelect={(date) => setValue('endDate', date as Date)}
                    initialFocus
                  />
                  <div className="p-3 border-t">
                    <Input
                      type="time"
                      value={formatTime(watch('endDate'))}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':').map(Number);
                        const currentDate = watch('endDate');
                        const date = currentDate ? new Date(currentDate) : new Date();

                        // Only update if we have valid hours and minutes
                        if (!isNaN(hours) && !isNaN(minutes)) {
                          date.setHours(hours, minutes, 0, 0);
                          setValue('endDate', date);
                        }
                      }}
                      className="w-full text-black"
                    />
                  </div>
                </PopoverContent>
              </Popover>
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="venue" className="text-base font-semibold text-black mb-2 block">Venue Name *</Label>
              <Input
                id="venue"
                {...register('venue')}
                className={`h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 text-black ${errors.venue ? 'border-red-500' : ''}`}
                placeholder="Enter venue name"
              />
              {errors.venue && (
                <p className="mt-1 text-sm text-red-600">{errors.venue.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="location" className="text-base font-semibold text-black mb-2 block">Location *</Label>
              <Input
                id="location"
                placeholder="123 Main St, City, Country"
                {...register('location')}
                className={`h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 text-black ${errors.location ? 'border-red-500' : ''}`}
              />
              {errors.location && (
                <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Ticket Types */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-black">Ticket Types</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTicketType}
              className="bg-white text-black border-gray-300 hover:bg-gray-50 hover:text-black hover:border-gray-400 rounded-xl px-4 py-2 font-semibold"
            >
              Add Ticket Type
            </Button>
          </div>

          {ticketTypes.map((ticket, index) => (
            <div key={index} className="border border-gray-200 rounded-2xl p-6 space-y-4 bg-white/50 backdrop-blur-sm shadow-lg">
              <div className="flex justify-between items-start">
                <h4 className="font-medium">Ticket Type {index + 1}</h4>
                {ticketTypes.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTicketType(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`ticketTypes.${index}.name`}>Name *</Label>
                  <Input
                    id={`ticketTypes.${index}.name`}
                    {...register(`ticketTypes.${index}.name` as const)}
                    defaultValue={ticket.name}
                    className="text-black"
                  />
                  {errors.ticketTypes?.[index]?.name && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.ticketTypes[index]?.name?.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor={`ticketTypes.${index}.price`}>Price *</Label>
                  <div className="relative mt-1 rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">KSh</span>
                    </div>
                    <Input
                      type="number"
                      id={`ticketTypes.${index}.price`}
                      {...register(`ticketTypes.${index}.price` as const, {
                        valueAsNumber: true,
                        setValueAs: (value) => {
                          // Convert empty string to 0, otherwise parse as integer
                          if (value === '') return 0;
                          const num = parseInt(value, 10);
                          return isNaN(num) ? 0 : Math.max(0, num);
                        },
                      })}
                      defaultValue={ticket.price || ''}
                      placeholder="0"
                      min="0"
                      step="1"
                      className="text-black pl-12"
                      onKeyDown={(e) => {
                        // Allow: backspace, delete, tab, escape, enter, numbers
                        if (
                          [46, 8, 9, 27, 13].includes(e.keyCode) ||
                          // Allow: Ctrl+A, Command+A
                          (e.keyCode === 65 && (e.ctrlKey === true || e.metaKey === true)) ||
                          // Allow: Ctrl+C, Command+C
                          (e.keyCode === 67 && (e.ctrlKey === true || e.metaKey === true)) ||
                          // Allow: Ctrl+V, Command+V
                          (e.keyCode === 86 && (e.ctrlKey === true || e.metaKey === true)) ||
                          // Allow: home, end, left, right
                          (e.keyCode >= 35 && e.keyCode <= 39) ||
                          // Allow: 0-9 and numpad 0-9
                          (e.keyCode >= 48 && e.keyCode <= 57) ||
                          (e.keyCode >= 96 && e.keyCode <= 105)
                        ) {
                          // Let it happen, don't do anything
                          return;
                        }
                        // Prevent the rest
                        e.preventDefault();
                      }}
                    />
                  </div>
                  {errors.ticketTypes?.[index]?.price && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.ticketTypes[index]?.price?.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`ticketTypes.${index}.quantity`}>Quantity *</Label>
                  <Input
                    type="number"
                    id={`ticketTypes.${index}.quantity`}
                    {...register(`ticketTypes.${index}.quantity` as const, {
                      valueAsNumber: true,
                      setValueAs: (value) => {
                        // Convert empty string to 1, otherwise parse as integer
                        if (value === '') return 1;
                        const num = parseInt(value, 10);
                        return isNaN(num) ? 1 : Math.max(1, num);
                      },
                    })}
                    defaultValue={ticket.quantity || 100}
                    min={1}
                    className="text-black"
                  />
                  {errors.ticketTypes?.[index]?.quantity && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.ticketTypes[index]?.quantity?.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor={`ticketTypes.${index}.description`}>
                    Description (Optional)
                  </Label>
                  <Textarea
                    id={`ticketTypes.${index}.description`}
                    rows={2}
                    {...register(`ticketTypes.${index}.description` as const)}
                    defaultValue={ticket.description}
                    placeholder="Description (optional)"
                    className="text-black"
                  />
                </div>
              </div>
            </div>
          ))}
          {errors.ticketTypes?.root && (
            <p className="text-sm text-red-600">{errors.ticketTypes.root.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-center pt-8">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-12 py-4 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (submitLabel ? 'Saving...' : 'Creating Event...') : (submitLabel || 'Create Event')}
        </Button>
      </div>
    </form>
  );
}
