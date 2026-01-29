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
import { cn } from '@/lib/utils';
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
            <DialogContent className="flex flex-col w-[95vw] max-w-[425px] max-h-[85dvh] gap-0 p-0 overflow-hidden rounded-3xl border border-white/10 shadow-2xl bg-[#0a0a0a] text-white">
                <DialogHeader className="p-6 sm:p-8 pb-3 shrink-0 space-y-4">
                    <div className="mx-auto w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-inner">
                        <CalendarIcon className="h-7 w-7 text-yellow-400" />
                    </div>
                    <div className="space-y-1">
                        <DialogTitle className="text-2xl font-black text-center text-white">Book Service</DialogTitle>
                        <DialogDescription className="text-center text-[#a1a1a1] font-medium text-sm">
                            {product.name}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 sm:p-8 py-2">
                    <div className="grid gap-6">
                        {/* Date Selection */}
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-wider text-[#a1a1a1/70] flex items-center gap-2">
                                1. Select Date
                            </Label>
                            <div className="border border-white/10 rounded-2xl p-2 flex justify-center bg-white/5 shadow-inner backdrop-blur-sm">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    disabled={isDateDisabled}
                                    initialFocus
                                    className="bg-transparent text-white"
                                />
                            </div>
                            {date && <p className="text-xs font-bold text-yellow-400 text-center uppercase tracking-tighter">Selected: {format(date, 'PPP')}</p>}
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {/* Time Selection */}
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-wider text-[#a1a1a1/70] flex items-center gap-2">
                                    2. Select Time
                                </Label>
                                <Select value={time} onValueChange={setTime}>
                                    <SelectTrigger className="rounded-xl border-white/10 h-12 focus:ring-yellow-400 bg-white/5 text-white">
                                        <SelectValue placeholder="Choose a time slot" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#111111] border-white/10 text-white">
                                        {availableTimeSlots.map(slot => (
                                            <SelectItem key={slot} value={slot} className="focus:bg-white/5">{slot}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Location Selection Logic */}
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-wider text-[#a1a1a1/70] flex items-center gap-2">
                                    3. Select Location
                                </Label>

                                {/* Hybrid Toggle */}
                                {isHybrid && (
                                    <div className="flex p-1 bg-white/5 rounded-xl border border-white/10 mb-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedLocationType('seller')}
                                            className={cn(
                                                "flex-1 py-2 rounded-lg text-xs font-black transition-all",
                                                selectedLocationType === 'seller' ? "bg-white/10 text-white shadow-sm" : "text-[#555555] hover:text-[#a1a1a1]"
                                            )}
                                        >
                                            Visit Shop
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedLocationType('buyer')}
                                            className={cn(
                                                "flex-1 py-2 rounded-lg text-xs font-black transition-all",
                                                selectedLocationType === 'buyer' ? "bg-white/10 text-white shadow-sm" : "text-[#555555] hover:text-[#a1a1a1]"
                                            )}
                                        >
                                            Come to Me
                                        </button>
                                    </div>
                                )}

                                {/* Content based on selection */}
                                {(selectedLocationType === 'seller' && !isSellerVisits) && (
                                    <div className="space-y-2">
                                        {locations.length > 0 ? (
                                            <RadioGroup value={location} onValueChange={setLocation} className="gap-2">
                                                {locations.map(loc => (
                                                    <div
                                                        key={loc}
                                                        className={cn(
                                                            "flex items-center space-x-3 border rounded-xl p-3 cursor-pointer transition-all",
                                                            location === loc ? "border-yellow-400/50 bg-yellow-400/5" : "border-white/5 bg-white/2 hover:border-white/10"
                                                        )}
                                                        onClick={() => setLocation(loc)}
                                                    >
                                                        <RadioGroupItem value={loc} id={loc} className="border-white/20 text-yellow-400" />
                                                        <Label htmlFor={loc} className="cursor-pointer flex-1 text-sm font-bold text-white pr-2">{loc}</Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        ) : (
                                            <div className="text-xs font-medium text-[#a1a1a1] p-4 border border-white/5 rounded-xl bg-white/2 backdrop-blur-sm">
                                                <span className="text-[#555555] block mb-1 font-black uppercase tracking-widest text-[9px]">Shop Address</span>
                                                {product.seller?.location || product.seller?.city || 'Seller Shop Address'}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(selectedLocationType === 'buyer' || isSellerVisits) && (
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555555]" />
                                            <input
                                                type="text"
                                                placeholder="Enter your address/location"
                                                className="flex h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white placeholder:text-[#555555] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 transition-all"
                                                value={customLocation}
                                                onChange={(e) => setCustomLocation(e.target.value)}
                                            />
                                        </div>
                                        <p className="text-[10px] font-bold text-[#555555] uppercase tracking-wide leading-relaxed px-1">
                                            Provide the address where you'd like the service.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3 p-6 sm:p-8 pt-4 mt-auto border-t border-white/5 shrink-0 bg-white/2 backdrop-blur-sm">
                    <Button
                        onClick={handleConfirm}
                        disabled={!isValid}
                        variant="secondary-byblos"
                        className="w-full h-12 rounded-xl font-black text-base shadow-lg transition-all active:scale-[0.98]"
                    >
                        Confirm Booking
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="w-full text-sm font-bold text-[#a1a1a1] hover:text-white"
                    >
                        Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
