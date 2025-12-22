import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Product } from '@/types';
import { format, addDays, isBefore, startOfDay, parse } from 'date-fns';
import { Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';

interface ServiceBookingModalProps {
    product: Product;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (bookingData: { date: Date; time: string; location: string }) => void;
}

export function ServiceBookingModal({ product, isOpen, onClose, onConfirm }: ServiceBookingModalProps) {
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [time, setTime] = useState<string>('');
    const [location, setLocation] = useState<string>('');
    const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setDate(undefined);
            setTime('');
            setLocation('');
        }
    }, [isOpen]);

    // Generate time slots based on product service options
    useEffect(() => {
        if (product.service_options?.start_time && product.service_options?.end_time) {
            const slots: string[] = [];
            const start = parseInt(product.service_options.start_time.split(':')[0]);
            const end = parseInt(product.service_options.end_time.split(':')[0]);

            for (let i = start; i < end; i++) {
                // Create 1-hour slots for simplicity
                const hour = i.toString().padStart(2, '0');
                const nextHour = (i + 1).toString().padStart(2, '0');
                slots.push(`${hour}:00 - ${nextHour}:00`);
            }
            setAvailableTimeSlots(slots);
        } else {
            // Default slots if not specified
            setAvailableTimeSlots([
                '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
                '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00'
            ]);
        }
    }, [product]);

    // Parse service locations
    const locations = product.service_locations
        ? product.service_locations.split(',').map(l => l.trim()).filter(Boolean)
        : [];

    // Parse availability days
    const availableDays = product.service_options?.availability_days || [];

    // Disable unavailable days
    const isDateDisabled = (date: Date) => {
        const dayName = format(date, 'EEE'); // Mon, Tue, Wed...

        // 1. Disable past dates
        if (isBefore(date, startOfDay(new Date()))) return true;

        // 2. Disable days not in availability_days (if specified)
        if (availableDays.length > 0) {
            // Map short names to what presumably is stored or match logic
            // Assuming stored as "Mon", "Tue" etc or full names. 
            // Let's do a loose check.
            const dayNameFull = format(date, 'EEEE');
            const isAvailable = availableDays.some(d =>
                d.toLowerCase().includes(dayName.toLowerCase()) ||
                d.toLowerCase() === dayNameFull.toLowerCase()
            );
            if (!isAvailable) return true;
        }

        return false;
    };

    const handleConfirm = () => {
        if (date && time && (location || locations.length === 0)) {
            onConfirm({
                date,
                time,
                location: location || 'Default Location'
            });
        }
    };

    const isValid = date && time && (location || locations.length === 0);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Book Service</DialogTitle>
                    <DialogDescription>
                        Select your preferred date, time, and location for {product.name}.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Date Selection */}
                    <div className="flex flex-col gap-2">
                        <Label className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            Select Date
                        </Label>
                        <div className="border rounded-md p-2 flex justify-center">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                disabled={isDateDisabled}
                                initialFocus
                                className="rounded-md border shadow-sm"
                            />
                        </div>
                        {date && <p className="text-sm text-muted-foreground text-center">Selected: {format(date, 'PPP')}</p>}
                    </div>

                    {/* Time Selection */}
                    <div className="flex flex-col gap-2">
                        <Label className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Select Time Slot
                        </Label>
                        <Select value={time} onValueChange={setTime}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choose a time slot" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableTimeSlots.map(slot => (
                                    <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Location Selection (if applicable) */}
                    {locations.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <Label className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                Select Location
                            </Label>
                            <RadioGroup value={location} onValueChange={setLocation} className="gap-2">
                                {locations.map(loc => (
                                    <div key={loc} className="flex items-center space-x-2 border rounded-md p-2 hover:bg-accent cursor-pointer" onClick={() => setLocation(loc)}>
                                        <RadioGroupItem value={loc} id={loc} />
                                        <Label htmlFor={loc} className="cursor-pointer flex-1">{loc}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={!isValid} className="bg-purple-600 hover:bg-purple-700 text-white">
                        Confirm Booking
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
