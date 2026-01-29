import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Product } from '@/types';
import { format, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';

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
            if (serviceOptions.location_type === 'seller_visits_buyer') {
                setSelectedLocationType('buyer');
            } else {
                setSelectedLocationType('seller');
            }
        }
    }, [isOpen, product, serviceOptions]);

    // Generate time slots
    useEffect(() => {
        if (serviceOptions.start_time && serviceOptions.end_time) {
            const slots: string[] = [];
            const start = parseInt(serviceOptions.start_time.split(':')[0]);
            const end = parseInt(serviceOptions.end_time.split(':')[0]);
            for (let i = start; i < end; i++) {
                slots.push(`${i.toString().padStart(2, '0')}:00 - ${(i + 1).toString().padStart(2, '0')}:00`);
            }
            setAvailableTimeSlots(slots);
        } else {
            setAvailableTimeSlots([
                '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
                '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00'
            ]);
        }
    }, [product, serviceOptions]);

    const rawLocations = product.service_locations || (product as any).serviceLocations;
    const locations = rawLocations ? [rawLocations] : [];
    const availableDays = serviceOptions.availability_days || [];

    const isDateDisabled = (date: Date) => {
        if (isBefore(date, startOfDay(new Date()))) return true;
        if (availableDays.length > 0) {
            const dayName = format(date, 'EEE');
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

    const isLocationValid = () => {
        if (selectedLocationType === 'buyer' || isSellerVisits) {
            return customLocation.trim().length > 0;
        }
        return location.length > 0 || locations.length === 0;
    };

    const isValid = date && time && isLocationValid();

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[450px] p-0 border-none bg-transparent shadow-none overflow-visible">
                {/* GLASS MINIMALIST CARD */}
                <div className="relative w-full p-10 text-white text-center bg-[#0a0a0ae6] backdrop-blur-xl border border-yellow-400/30 shadow-[0_0_40px_rgba(0,0,0,0.8)] rounded-sm">

                    {/* Header */}
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-[50px] h-[50px] mb-5 border border-yellow-400 flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="1.5" className="w-6 h-6">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                        </div>
                        <h1 className="font-bebas text-4xl tracking-[4px] leading-none mb-1">
                            BOOK SERVICE
                        </h1>
                        <p className="text-[10px] text-gray-400 tracking-[1px] uppercase">
                            {product.name}
                        </p>
                        <button
                            onClick={onClose}
                            className="absolute top-5 right-5 text-gray-400 hover:text-white transition-colors text-2xl leading-none"
                        >
                            &times;
                        </button>
                    </div>

                    {/* Body */}
                    <div className="text-left space-y-6">

                        {/* 01. Date */}
                        <div>
                            <Label className="block text-[10px] text-yellow-400 tracking-[2px] font-bold mb-3 uppercase">
                                01. Select Expedition Date
                            </Label>
                            <div className="border border-[#333] p-4 bg-[#0a0a0a]/50">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    disabled={isDateDisabled}
                                    initialFocus
                                    className="p-0 pointer-events-auto"
                                    classNames={{
                                        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 text-white font-playfair",
                                        month: "space-y-4 w-full",
                                        caption: "flex justify-center pt-1 relative items-center mb-2",
                                        caption_label: "text-base font-medium font-playfair uppercase tracking-widest",
                                        nav: "space-x-1 flex items-center",
                                        nav_button: "h-7 w-7 bg-transparent p-0 text-gray-400 hover:text-white hover:bg-transparent",
                                        nav_button_previous: "absolute left-1",
                                        nav_button_next: "absolute right-1",
                                        table: "w-full border-collapse space-y-1",
                                        head_row: "flex",
                                        head_cell: "text-gray-500 rounded-md w-9 font-normal text-[0.8rem] uppercase font-bebas tracking-wider",
                                        row: "flex w-full mt-2",
                                        cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-transparent focus-within:relative focus-within:z-20",
                                        day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-[#222] hover:text-white text-gray-300 rounded-sm font-sans",
                                        day_selected: "!bg-[#FFD700] !text-black !font-black !shadow-[0_0_15px_rgba(255,215,0,0.4)] hover:bg-[#FFD700] hover:text-black",
                                        day_today: "bg-white/5 text-white/70",
                                        day_outside: "text-gray-700 opacity-50",
                                        day_disabled: "text-gray-800 opacity-30",
                                        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                                        day_hidden: "invisible",
                                    }}
                                />
                            </div>
                        </div>

                        {/* Inline Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* 02. Time */}
                            <div className="space-y-3">
                                <Label className="block text-[10px] text-yellow-400 tracking-[2px] font-bold uppercase">
                                    02. Select Time
                                </Label>
                                <Select value={time} onValueChange={setTime}>
                                    <SelectTrigger className="w-full h-[45px] rounded-none border border-[#333] bg-transparent text-xs text-white uppercase focus:ring-1 focus:ring-yellow-400/50">
                                        <SelectValue placeholder="CHOOSE A TIME" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#0a0a0ae6] backdrop-blur-xl border border-[#333] text-white rounded-none">
                                        {availableTimeSlots.map(slot => (
                                            <SelectItem key={slot} value={slot} className="text-xs uppercase focus:bg-yellow-400/20 focus:text-yellow-400 cursor-pointer">{slot}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* 03. Location */}
                            <div className="space-y-3">
                                <Label className="block text-[10px] text-yellow-400 tracking-[2px] font-bold uppercase">
                                    03. Select Location
                                </Label>

                                {isHybrid ? (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex border border-[#333] rounded-sm overflow-hidden h-[45px]">
                                            <button
                                                onClick={() => setSelectedLocationType('seller')}
                                                className={cn("flex-1 text-[10px] font-bold uppercase transition-colors", selectedLocationType === 'seller' ? "bg-white text-black" : "bg-transparent text-[#555] hover:text-white")}
                                            >
                                                Shop
                                            </button>
                                            <button
                                                onClick={() => setSelectedLocationType('buyer')}
                                                className={cn("flex-1 text-[10px] font-bold uppercase transition-colors border-l border-[#333]", selectedLocationType === 'buyer' ? "bg-white text-black" : "bg-transparent text-[#555] hover:text-white")}
                                            >
                                                Custom
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="border border-[#333] h-[45px] flex items-center px-3 gap-2">
                                        <div className="w-[4px] h-[20px] bg-[#FFD700]"></div>
                                        <span className="text-[10px] text-white uppercase truncate">
                                            {isSellerVisits ? "Custom Location" : "Shop Location"}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Dynamic Location Input */}
                        <div className="mt-2 text-left">
                            {(selectedLocationType === 'buyer' || isSellerVisits) && (
                                <input
                                    type="text"
                                    placeholder="ENTER FULL ADDRESS"
                                    className="w-full h-[45px] bg-[#0a0a0ae6] border border-[#333] p-3 text-xs text-white placeholder:text-[#444] rounded-none focus:outline-none focus:border-yellow-400 transition-colors uppercase"
                                    value={customLocation}
                                    onChange={(e) => setCustomLocation(e.target.value)}
                                />
                            )}

                            {(selectedLocationType === 'seller' && !isSellerVisits && locations.length > 0) && (
                                <Select value={location} onValueChange={setLocation}>
                                    <SelectTrigger className="w-full h-[45px] rounded-none border border-[#333] bg-transparent text-xs text-white uppercase focus:ring-1 focus:ring-yellow-400/50">
                                        <SelectValue placeholder="CHOOSE SHOP BRANCH" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#0a0a0ae6] backdrop-blur-xl border border-[#333] text-white rounded-none">
                                        {locations.map(loc => (
                                            <SelectItem key={loc} value={loc} className="text-xs uppercase focus:bg-yellow-400/20 focus:text-yellow-400 cursor-pointer">{loc}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            {(selectedLocationType === 'seller' && !isSellerVisits && locations.length === 0) && (
                                <div className="border border-[#333] p-3 flex items-center gap-2">
                                    <MapPin className="w-3 h-3 text-[#555]" />
                                    <span className="text-[10px] text-[#888] uppercase tracking-wide">
                                        {product.seller?.location || product.seller?.city || 'Main Branch'}
                                    </span>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="mt-8">
                        <button
                            onClick={handleConfirm}
                            disabled={!isValid}
                            className="w-full bg-[#FFD700] text-black h-[50px] font-bebas text-lg tracking-[2px] transition-all hover:bg-white hover:shadow-[0_0_20px_rgba(255,215,0,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#FFD700] disabled:hover:shadow-none"
                        >
                            CONFIRM BOOKING
                        </button>
                        <button
                            onClick={onClose}
                            className="mt-4 text-[10px] text-[#666] tracking-[2px] font-bold uppercase hover:text-white transition-colors"
                        >
                            CANCEL
                        </button>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
}
