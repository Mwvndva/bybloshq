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
    onConfirm: (bookingData: { date: Date; time: string; location: string; locationType?: string; serviceRequirements?: string }) => void;
}

export function ServiceBookingModal({ product, isOpen, onClose, onConfirm }: ServiceBookingModalProps) {
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [time, setTime] = useState<string>('');
    const [location, setLocation] = useState<string>('');
    // For hybrid/buyer_visits_seller: user selects specific location or enters own
    const [selectedLocationType, setSelectedLocationType] = useState<'seller' | 'buyer'>('seller');
    const [customLocation, setCustomLocation] = useState<string>('');
    const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
    const [serviceRequirements, setServiceRequirements] = useState('');

    const serviceOptions = product.service_options || (product as any).serviceOptions || {};

    // Parse service locations
    const rawLocations = product.service_locations || (product as any).serviceLocations;
    // Treat as single location, don't split by comma as users enter full addresses with commas
    const locations = rawLocations ? [rawLocations] : [];

    const wordCount = serviceRequirements.trim().split(/\s+/).filter(w => w.length > 0).length;
    const maxWords = 50;

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setDate(undefined);
            setTime('');
            setCustomLocation('');
            setServiceRequirements('');

            // Auto-select first location if available
            if (locations.length > 0) {
                setLocation(locations[0]);
            } else {
                setLocation('');
            }

            // Default based on product settings
            if (serviceOptions.location_type === 'seller_visits_buyer') {
                setSelectedLocationType('buyer');
            } else {
                setSelectedLocationType('seller');
            }
        }
    }, [isOpen, product]);

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
                locationType: selectedLocationType === 'buyer' ? 'seller_visits_buyer' : 'buyer_visits_seller',
                serviceRequirements: serviceRequirements.trim()
            });
        }
    };

    const locationType = serviceOptions.location_type || 'buyer_visits_seller';
    const isHybrid = locationType === 'hybrid';
    const isSellerVisits = locationType === 'seller_visits_buyer';
    
    // Check if seller is shopless (no physical address)
    const isShopless = !product.seller?.physical_address;

    // Validation
    const isLocationValid = () => {
        if (selectedLocationType === 'buyer' || isSellerVisits) {
            return customLocation.trim().length > 0;
        }
        // Seller location selected
        return location.length > 0 || locations.length === 0;
    };

    const isValid = date && time && isLocationValid() && wordCount <= maxWords;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="flex flex-col w-[95vw] max-w-[400px] max-h-[85dvh] gap-0 p-0 overflow-hidden rounded-[32px] border border-white/5 shadow-2xl bg-[#0a0a0a] text-white">
                <DialogHeader className="p-6 pb-2 shrink-0 space-y-4 pt-8">
                    <div className="mx-auto w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                        <CalendarIcon className="h-6 w-6 text-yellow-400" />
                    </div>
                    <div className="space-y-1 text-center">
                        <DialogTitle className="text-xl font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">Book Service</DialogTitle>
                        <DialogDescription className="text-sm font-medium text-[#666]">
                            {product.name}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="space-y-6">
                        {/* Date Selection */}
                        <div className="space-y-3">
                            <div className="flex justify-center">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    disabled={isDateDisabled}
                                    initialFocus
                                    className="bg-transparent text-white p-0"
                                    classNames={{
                                        nav_button: "border-0 hover:bg-white/5 hover:text-white text-[#666] h-8 w-8",
                                        caption: "text-sm font-bold pt-1",
                                        head_cell: "text-[#666] text-[0.8rem] font-medium pt-1 w-8 sm:w-9",
                                        cell: "h-8 w-8 sm:h-9 sm:w-9 text-center text-sm p-0 flex items-center justify-center",
                                        day: "h-8 w-8 sm:h-9 sm:w-9 p-0 font-normal hover:bg-white/5 rounded-xl aria-selected:opacity-100 text-yellow-400",
                                        day_selected: "!bg-yellow-400 !text-black hover:!bg-yellow-400 hover:!text-black focus:!bg-yellow-400 focus:!text-black font-bold",
                                        day_today: "text-white bg-white/5 font-bold",
                                        day_outside: "text-[#333] opacity-50",
                                        day_disabled: "text-[#333] opacity-50 hover:bg-transparent",
                                    }}
                                />
                            </div>

                        </div>

                        <div className="space-y-4">
                            {/* Time Selection */}
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-[#666]">Time</Label>
                                <Select value={time} onValueChange={setTime}>
                                    <SelectTrigger className="w-full h-11 rounded-xl bg-white/5 border-0 text-base sm:text-sm font-medium focus:ring-1 focus:ring-yellow-400 transition-all text-white">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-[#666]" />
                                            <SelectValue placeholder="Select time" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#111] border-white/5 text-white max-h-[200px]">
                                        {availableTimeSlots.map(slot => (
                                            <SelectItem key={slot} value={slot} className="focus:bg-white/10 focus:text-white text-base sm:text-sm py-2.5 cursor-pointer">{slot}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Location Selection Logic */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-[#666]">Location</Label>

                                {isShopless ? (
                                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#000000] border border-white/5">
                                        <MapPin className="w-5 h-5 text-yellow-400 shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-white line-clamp-1">Location: Online/Remote</p>
                                            <p className="text-[10px] text-[#666] uppercase tracking-wider font-bold">Shopless Service</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Hybrid Toggle */}
                                        {isHybrid && (
                                            <div className="flex p-0.5 bg-white/5 rounded-xl mb-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedLocationType('seller')}
                                                    className={cn(
                                                        "flex-1 py-1.5 rounded-[10px] text-[11px] font-bold transition-all",
                                                        selectedLocationType === 'seller' ? "bg-white/10 text-white shadow-sm" : "text-[#666] hover:text-[#999]"
                                                    )}
                                                >
                                                    In-Store
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedLocationType('buyer')}
                                                    className={cn(
                                                        "flex-1 py-1.5 rounded-[10px] text-[11px] font-bold transition-all",
                                                        selectedLocationType === 'buyer' ? "bg-white/10 text-white shadow-sm" : "text-[#666] hover:text-[#999]"
                                                    )}
                                                >
                                                    Home Service
                                                </button>
                                            </div>
                                        )}

                                        {/* Content based on selection */}
                                        {(selectedLocationType === 'seller' && !isSellerVisits) && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/5">
                                                    <MapPin className="w-5 h-5 text-yellow-400 shrink-0" />
                                                    <div>
                                                        <p className="text-sm font-bold text-white line-clamp-1">{location || product.seller?.location || product.seller?.city || 'Main Shop'}</p>
                                                        <p className="text-[10px] text-[#666] uppercase tracking-wider font-bold">Selected Location</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {(selectedLocationType === 'buyer' || isSellerVisits) && (
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666]" />
                                                <input
                                                    type="text"
                                                    placeholder="Enter address"
                                                    className="flex h-11 w-full rounded-xl bg-white/5 border-0 pl-10 pr-4 text-sm text-white placeholder:text-[#555] focus:ring-1 focus:ring-yellow-400 transition-all font-medium"
                                                    value={customLocation}
                                                    onChange={(e) => setCustomLocation(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Service Requirements */}
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-[#666]">
                                    Service Requirements <span className={`ml-1 ${wordCount > maxWords ? 'text-red-400' : 'text-[#444]'}`}>({wordCount}/{maxWords})</span>
                                </Label>
                                <textarea
                                    placeholder="Describe the service you need..."
                                    value={serviceRequirements}
                                    onChange={(e) => setServiceRequirements(e.target.value)}
                                    className="flex min-h-[80px] w-full rounded-xl bg-white/5 border-0 px-3 py-2 text-sm text-white placeholder:text-[#555] focus:ring-1 focus:ring-yellow-400 focus:outline-none resize-none font-medium"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 pt-2 pb-8 mt-auto shrink-0 space-y-3">
                    {/* Summary Line */}
                    <div className="flex items-center justify-between text-xs px-1 mb-1">
                        <span className="text-[#666] font-medium">Total Price</span>
                        <span className="text-lg font-black text-white">
                            {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(product.price)}
                        </span>
                    </div>

                    <Button
                        onClick={handleConfirm}
                        disabled={!isValid}
                        className="w-full h-12 rounded-xl bg-yellow-400 text-black font-bold text-sm hover:bg-yellow-500 shadow-[0_0_20px_rgba(250,204,21,0.1)] disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
                    >
                        Confirm Booking
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="w-full h-10 rounded-xl text-xs font-bold text-[#666] hover:text-white hover:bg-transparent"
                    >
                        Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
