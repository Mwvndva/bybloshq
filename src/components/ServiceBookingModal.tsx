import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    onConfirm: (bookingData: { date: Date; time: string; location: string; locationType?: string }) => void;
}

export function ServiceBookingModal({ product, isOpen, onClose, onConfirm }: ServiceBookingModalProps) {
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [time, setTime] = useState<string>('');
    const [location, setLocation] = useState<string>('');
    // For hybrid/buyer_visits_seller: user selects specific location or enters own
    const [selectedLocationType, setSelectedLocationType] = useState<'seller' | 'buyer'>('seller');
    const [customLocation, setCustomLocation] = useState<string>('');
    const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);

    const serviceOptions = product.service_options || (product as any).serviceOptions || {};

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setDate(undefined);
            setTime('');
            setLocation('');
            setCustomLocation('');
            // Default based on product settings
            if (serviceOptions.location_type === 'seller_visits_buyer') {
                setSelectedLocationType('buyer');
            } else {
                setSelectedLocationType('seller');
            }
        }
    }, [isOpen, product, serviceOptions]);

    // Generate time slots based on product service options
    useEffect(() => {
        if (serviceOptions.start_time && serviceOptions.end_time) {
            const slots: string[] = [];
            const start = parseInt(serviceOptions.start_time.split(':')[0]);
            const end = parseInt(serviceOptions.end_time.split(':')[0]);

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
    }, [product, serviceOptions]);

    // Parse service locations
    const rawLocations = product.service_locations || (product as any).serviceLocations;
    // Treat as single location, don't split by comma as users enter full addresses with commas
    const locations = rawLocations ? [rawLocations] : [];

    // Parse availability days
    const availableDays = serviceOptions.availability_days || [];

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
        let finalLocation = location;

        if (selectedLocationType === 'buyer') {
            finalLocation = customLocation;
        } else if (locations.length === 0 && !location) {
            finalLocation = 'Default Seller Location';
        }

        if (date && time && finalLocation) {
            onConfirm({
                date,
                time,
                location: finalLocation,
                locationType: selectedLocationType === 'buyer' ? 'seller_visits_buyer' : 'buyer_visits_seller'
            });
        }
    };

    const locationType = serviceOptions.location_type || 'buyer_visits_seller';
    const isHybrid = locationType === 'hybrid';
    const isSellerVisits = locationType === 'seller_visits_buyer';

    // Validation
    const isLocationValid = () => {
        if (selectedLocationType === 'buyer' || isSellerVisits) {
            return customLocation.trim().length > 0;
        }
        // Seller location selected
        return location.length > 0 || locations.length === 0;
    };

    const isValid = date && time && isLocationValid();

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Book Service
                        {isHybrid && <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-100">Hybrid Service</Badge>}
                    </DialogTitle>
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

                    {/* Location Selection Logic */}
                    <div className="flex flex-col gap-2">
                        <Label className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Select Location
                        </Label>

                        {/* Hybrid Toggle */}
                        {isHybrid && (
                            <div className="flex space-x-2 mb-2">
                                <Button
                                    variant={selectedLocationType === 'seller' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setSelectedLocationType('seller')}
                                    className="flex-1"
                                >
                                    Visit Shop
                                </Button>
                                <Button
                                    variant={selectedLocationType === 'buyer' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setSelectedLocationType('buyer')}
                                    className="flex-1"
                                >
                                    Come to Me
                                </Button>
                            </div>
                        )}

                        {/* Content based on selection */}
                        {(selectedLocationType === 'seller' && !isSellerVisits) && (
                            <>
                                {locations.length > 0 ? (
                                    <RadioGroup value={location} onValueChange={setLocation} className="gap-2">
                                        {locations.map(loc => (
                                            <div key={loc} className="flex items-center space-x-2 border rounded-md p-2 hover:bg-accent cursor-pointer" onClick={() => setLocation(loc)}>
                                                <RadioGroupItem value={loc} id={loc} />
                                                <Label htmlFor={loc} className="cursor-pointer flex-1">{loc}</Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                ) : (
                                    <div className="text-sm text-muted-foreground p-2 border rounded-md bg-gray-50">
                                        Location: {product.seller?.location || product.seller?.city || 'Seller Shop Address'}
                                    </div>
                                )}
                            </>
                        )}

                        {(selectedLocationType === 'buyer' || isSellerVisits) && (
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    placeholder="Enter your address/location"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={customLocation}
                                    onChange={(e) => setCustomLocation(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Please provide the full address where you want the service to be performed.
                                </p>
                            </div>
                        )}
                    </div>
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
