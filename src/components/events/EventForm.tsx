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
import { CalendarIcon, Image as ImageIcon, UploadCloud, X, Ticket, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

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
  readOnlyOverview?: boolean;
}

export function EventForm({ defaultValues, onSubmit, isSubmitting, submitLabel, readOnlyOverview }: EventFormProps) {

  const [imagePreview, setImagePreview] = useState<string | null>(
    defaultValues?.image ? URL.createObjectURL(defaultValues.image as unknown as Blob) : (defaultValues as any)?.image_url || null
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

  const [activeTab, setActiveTab] = useState(readOnlyOverview ? 'tickets' : 'overview');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="flex flex-wrap justify-center gap-2 mb-8 bg-[#111111] p-2 rounded-2xl border border-[#222222] w-full sm:w-fit mx-auto">
        <Button
          type="button"
          variant={activeTab === 'overview' ? 'byblos' : 'ghost'}
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-3 rounded-xl transition-all duration-300 font-semibold ${activeTab === 'overview'
            ? 'shadow-lg transform scale-105'
            : 'text-gray-400 hover:text-white hover:bg-white/5 hover:scale-105'
            }`}
        >
          <CalendarIcon className="h-5 w-5 mr-2" />
          Overview
        </Button>
        <Button
          type="button"
          variant={activeTab === 'tickets' ? 'byblos' : 'ghost'}
          onClick={() => setActiveTab('tickets')}
          className={`px-6 py-3 rounded-xl transition-all duration-300 font-semibold ${activeTab === 'tickets'
            ? 'shadow-lg transform scale-105'
            : 'text-gray-400 hover:text-white hover:bg-white/5 hover:scale-105'
            }`}
        >
          <Ticket className="h-5 w-5 mr-2" />
          Tickets
        </Button>
      </div>

      <div className={cn("space-y-8", activeTab !== 'overview' && "hidden")}>
        {/* Event Image */}
        <div className="bg-[#111111] rounded-3xl p-6 sm:p-8 border border-[#222222]">
          <Label className="text-xl font-semibold text-white mb-6 block">Event Image</Label>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative h-48 w-48 rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-inner">
              {imagePreview ? (
                <>
                  <img
                    src={imagePreview}
                    alt="Event preview"
                    className="h-full w-full object-cover"
                  />
                  {!readOnlyOverview && (
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-red-500/80 rounded-full p-2 text-white hover:bg-red-600 transition-colors backdrop-blur-sm"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </>
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                  <ImageIcon className="h-12 w-12 mb-2" />
                  <span className="text-xs">No image uploaded</span>
                </div>
              )}
            </div>
            {!readOnlyOverview && (
              <div className="flex-1 space-y-4">
                <input
                  type="file"
                  id="image"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor="image"
                    className="inline-flex items-center justify-center px-6 py-3 border border-yellow-400/40 rounded-xl shadow-sm text-sm font-medium text-yellow-100 bg-yellow-400/10 hover:bg-yellow-400/20 hover:border-yellow-400 focus:outline-none cursor-pointer transition-all duration-200"
                  >
                    <UploadCloud className="h-5 w-5 mr-2" />
                    {imagePreview ? 'Change Image' : 'Upload Image'}
                  </Label>
                  <p className="text-sm text-gray-400">
                    Recommended size: 1200x630px (2:1 aspect ratio)
                  </p>
                </div>
                {errors.image && (
                  <p className="text-sm text-red-600 font-medium flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {errors.image.message}
                  </p>
                )}
              </div>
            )}
            {readOnlyOverview && (
              <div className="flex-1">
                <p className="text-gray-400 italic">Image editing is disabled for existing events.</p>
              </div>
            )}
          </div>
        </div>

        {/* Event Details */}
        <div className="bg-[#111111] rounded-3xl p-6 sm:p-8 border border-[#222222] space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-semibold text-white mb-2">Event Details</h3>
            {readOnlyOverview && <Badge variant="secondary" className="bg-white/10 text-gray-300 border border-white/10">Read Only</Badge>}
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-base font-semibold text-white mb-2 block">Event Title</Label>
              <Input
                id="title"
                disabled={readOnlyOverview}
                {...register('title')}
                className={`h-12 rounded-xl border border-[#222222] bg-black focus:border-yellow-400 focus:ring-yellow-400 text-white text-lg placeholder:text-gray-500 ${errors.title ? 'border-red-500' : ''}`}
                placeholder="Enter a catchy title for your event"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description" className="text-base font-semibold text-white mb-2 block">Description</Label>
              <Textarea
                id="description"
                disabled={readOnlyOverview}
                rows={5}
                {...register('description')}
                className={`rounded-xl border border-[#222222] bg-black focus:border-yellow-400 focus:ring-yellow-400 text-[#a1a1a1] placeholder:text-gray-500 resize-none ${errors.description ? 'border-red-500' : ''}`}
                placeholder="Describe what makes your event special..."
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label className="text-base font-semibold text-white mb-2 block">Start Date & Time</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={readOnlyOverview}
                      className={cn(
                        'w-full h-12 justify-start text-left font-normal text-white rounded-xl border border-[#222222] bg-black hover:border-yellow-400 focus:border-yellow-400',
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
                  {/* ... Only render content if strictly needed, but Popover handles disabled trigger ... */}
                  <PopoverContent className="w-auto p-0 rounded-xl shadow-xl border border-white/10 bg-[rgba(20,20,20,0.9)]">
                    <Calendar
                      mode="single"
                      selected={watch('startDate')}
                      onSelect={(date) => setValue('startDate', date as Date)}
                      initialFocus
                      className="rounded-xl border border-white/10 bg-[rgba(20,20,20,0.9)]"
                    />
                    <div className="p-3 border-t border-white/10 bg-black/40">
                      <Input
                        type="time"
                        value={formatTime(watch('startDate'))}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':').map(Number);
                          const currentDate = watch('startDate');
                          const date = currentDate ? new Date(currentDate) : new Date();

                          if (!isNaN(hours) && !isNaN(minutes)) {
                            date.setHours(hours, minutes, 0, 0);
                            setValue('startDate', date);
                          }
                        }}
                        className="w-full text-white bg-black rounded-lg border border-[#222222] focus:border-yellow-400 focus:ring-yellow-400"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
                )}
              </div>

              <div>
                <Label className="text-base font-semibold text-white mb-2 block">End Date & Time</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={readOnlyOverview}
                      className={cn(
                        'w-full h-12 justify-start text-left font-normal text-white rounded-xl border border-[#222222] bg-black hover:border-yellow-400 focus:border-yellow-400',
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
                  <PopoverContent className="w-auto p-0 rounded-xl shadow-xl border border-white/10 bg-[rgba(20,20,20,0.9)]">
                    <Calendar
                      mode="single"
                      selected={watch('endDate')}
                      onSelect={(date) => setValue('endDate', date as Date)}
                      initialFocus
                      className="rounded-xl border border-white/10 bg-[rgba(20,20,20,0.9)]"
                    />
                    <div className="p-3 border-t border-white/10 bg-black/40">
                      <Input
                        type="time"
                        value={formatTime(watch('endDate'))}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':').map(Number);
                          const currentDate = watch('endDate');
                          const date = currentDate ? new Date(currentDate) : new Date();

                          if (!isNaN(hours) && !isNaN(minutes)) {
                            date.setHours(hours, minutes, 0, 0);
                            setValue('endDate', date);
                          }
                        }}
                        className="w-full text-white bg-black rounded-lg border border-[#222222] focus:border-yellow-400 focus:ring-yellow-400"
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
                <Label htmlFor="venue" className="text-base font-semibold text-white mb-2 block">Venue Name</Label>
                <Input
                  id="venue"
                  disabled={readOnlyOverview}
                  {...register('venue')}
                  className={`h-12 rounded-xl border border-[#222222] bg-black focus:border-yellow-400 focus:ring-yellow-400 text-white placeholder:text-gray-500 ${errors.venue ? 'border-red-500' : ''}`}
                  placeholder="e.g. KICC, Nairobi"
                />
                {errors.venue && (
                  <p className="mt-1 text-sm text-red-600">{errors.venue.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="location" className="text-base font-semibold text-white mb-2 block">Location Address</Label>
                <Input
                  id="location"
                  disabled={readOnlyOverview}
                  placeholder="Street address, City"
                  {...register('location')}
                  className={`h-12 rounded-xl border border-[#222222] bg-black focus:border-yellow-400 focus:ring-yellow-400 text-white placeholder:text-gray-500 ${errors.location ? 'border-red-500' : ''}`}
                />
                {errors.location && (
                  <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Types Tab */}
      <div className={cn("space-y-6", activeTab !== 'tickets' && "hidden")}>
        <div className="bg-[#111111] rounded-3xl p-6 sm:p-8 border border-[#222222]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-semibold text-white">Ticket Types</h3>
              <p className="text-gray-400">Configure your ticket options and pricing</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={addTicketType}
              className="bg-transparent border-2 border-white/10 text-gray-200 hover:bg-white/5 hover:border-yellow-400/30 rounded-xl px-4 py-2 font-semibold shadow-sm transition-all"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Ticket Type
            </Button>
          </div>

          <div className="space-y-4">
            {ticketTypes.map((ticket, index) => (
              <div key={index} className="bg-[rgba(20,20,20,0.6)] rounded-2xl p-6 shadow-sm border border-white/10 hover:shadow-md transition-shadow duration-200">
                <div className="flex justify-between items-start mb-4">
                  <Badge variant="outline" className="bg-white/10 text-gray-300 border border-white/10">
                    Ticket Type {index + 1}
                  </Badge>
                  {ticketTypes.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTicketType(index)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg -mr-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <Label htmlFor={`ticketTypes.${index}.name`} className="mb-2 block font-medium text-white">Ticket Name</Label>
                    <Input
                      id={`ticketTypes.${index}.name`}
                      {...register(`ticketTypes.${index}.name` as const)}
                      defaultValue={ticket.name}
                      placeholder="e.g. Early Bird, VIP"
                      className="h-11 rounded-xl border border-[#222222] bg-black text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400"
                    />
                    {errors.ticketTypes?.[index]?.name && (
                      <p className="mt-1 text-xs text-red-600 font-medium">
                        {errors.ticketTypes[index]?.name?.message}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-3">
                    <Label htmlFor={`ticketTypes.${index}.price`} className="mb-2 block font-medium text-white">Price (KES)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        id={`ticketTypes.${index}.price`}
                        {...register(`ticketTypes.${index}.price` as const, {
                          valueAsNumber: true,
                          setValueAs: (value) => value === '' ? 0 : parseFloat(value)
                        })}
                        defaultValue={ticket.price || ''}
                        placeholder="0"
                        min="0"
                        className="h-11 rounded-xl border border-[#222222] bg-black text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400 pl-3"
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      />
                    </div>
                    {errors.ticketTypes?.[index]?.price && (
                      <p className="mt-1 text-xs text-red-600 font-medium">
                        {errors.ticketTypes[index]?.price?.message}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-4">
                    <Label htmlFor={`ticketTypes.${index}.quantity`} className="mb-2 block font-medium text-white">Quantity Available</Label>
                    <Input
                      type="number"
                      id={`ticketTypes.${index}.quantity`}
                      {...register(`ticketTypes.${index}.quantity` as const, {
                        valueAsNumber: true,
                        setValueAs: (value) => value === '' ? 1 : parseInt(value, 10)
                      })}
                      defaultValue={ticket.quantity || 100}
                      min={1}
                      className="h-11 rounded-xl border border-[#222222] bg-black text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400"
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    />
                    {errors.ticketTypes?.[index]?.quantity && (
                      <p className="mt-1 text-xs text-red-600 font-medium">
                        {errors.ticketTypes[index]?.quantity?.message}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-12">
                    <Label htmlFor={`ticketTypes.${index}.description`} className="mb-2 block font-medium text-white">Description (Optional)</Label>
                    <Input
                      id={`ticketTypes.${index}.description`}
                      {...register(`ticketTypes.${index}.description` as const)}
                      defaultValue={ticket.description}
                      placeholder="What does this ticket include?"
                      className="h-11 rounded-xl border border-[#222222] bg-black text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400"
                    />
                  </div>
                </div>
              </div>
            ))}
            {errors.ticketTypes?.root && (
              <p className="text-sm text-red-300 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{errors.ticketTypes.root.message}</p>
            )}

            <div className="pt-4 flex justify-between items-center text-sm text-gray-400 bg-white/5 p-4 rounded-xl border border-white/10">
              <span className="flex items-center">
                <Ticket className="h-4 w-4 mr-2" />
                Total Types: {ticketTypes.length}
              </span>
              <span className="flex items-center">
                <span className="font-semibold text-white mr-1">
                  {ticketTypes.reduce((acc, curr) => acc + (parseInt(curr.quantity as any) || 0), 0)}
                </span>
                Total Tickets
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md border-t border-white/10 p-4 z-40 sm:sticky sm:bottom-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:p-0">
        <div className="max-w-4xl mx-auto sm:max-w-none flex justify-center">
          <Button
            type="submit"
            disabled={isSubmitting}
            variant="byblos"
            className="w-full sm:w-auto shadow-xl px-12 py-6 rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transform transition-transform active:scale-95"
          >
            {isSubmitting ? (submitLabel ? 'Saving Changes...' : 'Creating Event...') : (submitLabel || 'Create Event')}
          </Button>
        </div>
      </div>
    </form>
  );
}
