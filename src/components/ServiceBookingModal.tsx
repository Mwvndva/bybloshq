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
import { Calendar as CalendarIcon, Clock, MapPin, Edit2, Loader2 } from 'lucide-react';
import { useBuyerAuth, useGlobalAuth } from '@/contexts/GlobalAuthContext';
import LocationPicker from './common/LocationPicker';
import { toast } from 'sonner';

interface ServiceBookingModalProps {
    product: Product;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (bookingData: {
        date: Date;
        time: string;
        location: string;
        locationType?: string;
        serviceRequirements?: string;
        buyerLocation?: { latitude: number; longitude: number; fullAddress: string } | null
    }) => void;
}

export function ServiceBookingModal({ product, isOpen, onClose, onConfirm }: ServiceBookingModalProps) {
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [time, setTime] = useState<string>('');
    const [location, setLocation] = useState<string>('');
    const [selectedLocationType, setSelectedLocationType] = useState<'seller' | 'buyer'>('seller');
    const [customLocation, setCustomLocation] = useState<string>('');
    const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
    const [serviceRequirements, setServiceRequirements] = useState('');

    // Managed Location state
    const { user: buyerProfile } = useBuyerAuth();
    const { updateProfile } = useGlobalAuth();

    const [isChangingLocation, setIsChangingLocation] = useState(false);
    const [buyerLocation, setBuyerLocation] = useState<{ latitude: number; longitude: number; fullAddress: string } | null>(null);
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

    const serviceOptions = product.service_options || (product as any).serviceOptions || {};
    const rawLocations = product.service_locations || (product as any).serviceLocations;
    const locations = rawLocations ? [rawLocations] : [];

    const wordCount = serviceRequirements.trim().split(/\s+/).filter(w => w.length > 0).length;
    const maxWords = 50;

    const locationType = serviceOptions.location_type || 'buyer_visits_seller';
    const isHybrid = locationType === 'hybrid';
    const isSellerVisits = locationType === 'seller_visits_buyer';
    const isShopless = !product.seller?.physicalAddress;

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setDate(undefined);
            setTime('');
            setServiceRequirements('');

            // Initialize buyer location from profile
            if (buyerProfile) {
                const loc = {
                    latitude: (buyerProfile as any).latitude || 0,
                    longitude: (buyerProfile as any).longitude || 0,
                    fullAddress: (buyerProfile as any).fullAddress || buyerProfile.location || ''
                };
                setBuyerLocation(loc);
                setCustomLocation(loc.fullAddress);
            } else {
                setBuyerLocation(null);
                setCustomLocation('');
            }

            // Auto-select first location if available
            if (locations.length > 0) {
                setLocation(locations[0]);
            } else {
                setLocation('');
            }

            // Default based on product settings
            if (isShopless || isSellerVisits) {
                setSelectedLocationType('buyer');
            } else {
                setSelectedLocationType('seller');
            }
        }
    }, [isOpen, product, buyerProfile, isShopless, isSellerVisits]);

    // Generate time slots
    useEffect(() => {
        if (serviceOptions.start_time && serviceOptions.end_time) {
            const slots: string[] = [];
            const start = parseInt(serviceOptions.start_time.split(':')[0]);
            const end = parseInt(serviceOptions.end_time.split(':')[0]);

            for (let i = start; i < end; i++) {
                const hour = i.toString().padStart(2, '0');
                const nextHour = (i + 1).toString().padStart(2, '0');
                slots.push(`${hour}:00 - ${nextHour}:00`);
            }
            setAvailableTimeSlots(slots);
        } else {
            setAvailableTimeSlots([
                '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
                '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00'
            ]);
        }
    }, [product, serviceOptions]);

    const isDateDisabled = (date: Date) => {
        const dayName = format(date, 'EEE');
        if (isBefore(date, startOfDay(new Date()))) return true;
        const availableDays = serviceOptions.availability_days || [];
        if (availableDays.length > 0) {
            const dayNameFull = format(date, 'EEEE');
            const isAvailable = availableDays.some((d: string) =>
                d.toLowerCase().includes(dayName.toLowerCase()) ||
                d.toLowerCase() === dayNameFull.toLowerCase()
            );
            if (!isAvailable) return true;
        }
        return false;
    };

    const handleLocationPickerChange = (address: string, coords: { lat: number; lng: number } | null) => {
        const newLoc = {
            latitude: coords?.lat || 0,
            longitude: coords?.lng || 0,
            fullAddress: address
        };
        setBuyerLocation(newLoc);
        setCustomLocation(address);
    };

    const saveLocationToProfile = async () => {
        if (!buyerLocation) return;

        // If not logged in as buyer, just use the location for this session
        if (!buyerProfile) {
            setIsChangingLocation(false);
            toast.success('Location updated', {
                description: 'Location set for this booking.'
            });
            return;
        }

        setIsUpdatingProfile(true);
        try {
            await updateProfile({
                fullAddress: buyerLocation.fullAddress,
                latitude: buyerLocation.latitude,
                longitude: buyerLocation.longitude
            } as any, 'buyer');
            setIsChangingLocation(false);
            toast.success('Location updated', {
                description: 'Your default service location has been saved.'
            });
        } catch (error) {
            console.error('Error saving location:', error);
            toast.error('Update Failed', {
                description: 'Failed to save your location to profile.'
            });
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const handleConfirm = () => {
        let finalLocation = location;

        if (isShopless) {
            finalLocation = buyerLocation?.fullAddress || 'Buyer Location';
        } else if (selectedLocationType === 'buyer') {
            finalLocation = customLocation;
        } else if (locations.length === 0 && !location) {
            finalLocation = 'Default Seller Location';
        }

        if (date && time && finalLocation) {
            onConfirm({
                date,
                time,
                location: finalLocation,
                locationType: isShopless ? 'seller_visits_buyer' : (selectedLocationType === 'buyer' ? 'seller_visits_buyer' : 'buyer_visits_seller'),
                serviceRequirements: serviceRequirements.trim() || '',
                buyerLocation: (isShopless || selectedLocationType === 'buyer' || isSellerVisits) ? {
                    latitude: buyerLocation?.latitude || 0,
                    longitude: buyerLocation?.longitude || 0,
                    fullAddress: finalLocation
                } : null
            });
        }
    };

    const isLocationValid = () => {
        if (isShopless) return !!buyerLocation?.fullAddress;
        if (selectedLocationType === 'buyer' || isSellerVisits) return customLocation.trim().length > 0;
        return location.length > 0 || locations.length === 0;
    };

    const isValid = date && time && isLocationValid() && wordCount <= maxWords;

    const getDisabledReason = () => {
        if (!date) return 'Please select a date';
        if (!time) return 'Please select a time';
        if (!isLocationValid()) {
            if (isShopless && !buyerLocation?.fullAddress) return 'Please set your location';
            if (selectedLocationType === 'buyer' || isSellerVisits) return 'Please enter your address';
            return 'Please select a location';
        }
        if (wordCount > maxWords) return 'Service requirements too long';
        return '';
    };

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
                        <div className="space-y-3">
                            <div className="flex justify-center">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    disabled={isDateDisabled}
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

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-[#666]">Location</Label>
                                {isShopless ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#000000] border border-white/5">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <MapPin className="w-5 h-5 text-yellow-400 shrink-0" />
                                                <div className="overflow-hidden">
                                                    <p className="text-sm font-bold text-white truncate">
                                                        {buyerLocation?.fullAddress || 'No address set'}
                                                    </p>
                                                    <p className="text-[10px] text-[#666] uppercase tracking-wider font-bold">My Location (Auto-applied)</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setIsChangingLocation(true)}
                                                className="h-8 w-8 p-0 rounded-lg hover:bg-white/5 shrink-0"
                                            >
                                                <Edit2 className="w-4 h-4 text-yellow-400" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
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

                                        {(selectedLocationType === 'seller' && !isSellerVisits) && (
                                            <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                                                <MapPin className="w-5 h-5 text-yellow-400 shrink-0" />
                                                <div>
                                                    <p className="text-sm font-bold text-white line-clamp-1">{location || product.seller?.location || product.seller?.city || 'Main Shop'}</p>
                                                    <p className="text-[10px] text-[#666] uppercase tracking-wider font-bold">Selected Location</p>
                                                </div>
                                            </div>
                                        )}

                                        {(selectedLocationType === 'buyer' || isSellerVisits) && (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/5">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <MapPin className="w-5 h-5 text-yellow-400 shrink-0" />
                                                        <div className="overflow-hidden">
                                                            <p className="text-sm font-bold text-white truncate">
                                                                {buyerLocation?.fullAddress || 'No address set'}
                                                            </p>
                                                            <p className="text-[10px] text-[#666] uppercase tracking-wider font-bold">My Location</p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setIsChangingLocation(true)}
                                                        className="h-8 w-8 p-0 rounded-lg hover:bg-white/5 shrink-0"
                                                    >
                                                        <Edit2 className="w-4 h-4 text-yellow-400" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-[#666]">
                                    Service Requirements <span className={`ml-1 ${wordCount > maxWords ? 'text-red-400' : 'text-[#444]'}`}>({wordCount}/{maxWords})</span>
                                </Label>
                                <textarea
                                    placeholder="Describe your needs..."
                                    value={serviceRequirements}
                                    onChange={(e) => setServiceRequirements(e.target.value)}
                                    className="flex min-h-[80px] w-full rounded-xl bg-white/5 border-0 px-3 py-2 text-sm text-white placeholder:text-[#555] focus:ring-1 focus:ring-yellow-400 focus:outline-none resize-none font-medium"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 pt-2 pb-8 mt-auto shrink-0 space-y-3">
                    <div className="flex items-center justify-between text-xs px-1 mb-1">
                        <span className="text-[#666] font-medium">Total Price</span>
                        <span className="text-lg font-black text-white">
                            {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(product.price)}
                        </span>
                    </div>

                    <Button
                        onClick={handleConfirm}
                        disabled={!isValid}
                        className="w-full h-12 rounded-xl bg-yellow-400 text-black font-bold text-sm hover:bg-yellow-500 shadow-[0_0_20px_rgba(250,204,21,0.1)] disabled:opacity-50 transition-all active:scale-[0.98]"
                    >
                        Confirm Booking
                    </Button>
                    {!isValid && (
                        <p className="text-xs text-[#666] text-center font-medium">
                            {getDisabledReason()}
                        </p>
                    )}
                    <Button variant="ghost" onClick={onClose} className="w-full h-10 rounded-xl text-xs font-bold text-[#666] hover:text-white">
                        Cancel
                    </Button>
                </div>
            </DialogContent>

            <Dialog open={isChangingLocation} onOpenChange={setIsChangingLocation}>
                <DialogContent className="flex flex-col w-[95vw] max-w-[450px] max-h-[90dvh] gap-0 p-0 overflow-hidden rounded-[32px] border border-white/5 shadow-2xl bg-[#0a0a0a] text-white z-[60]">
                    <DialogHeader className="p-6 pb-2 shrink-0 space-y-4 pt-8">
                        <div className="mx-auto w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                            <MapPin className="h-6 w-6 text-yellow-400" />
                        </div>
                        <div className="space-y-1 text-center">
                            <DialogTitle className="text-xl font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">Update My Location</DialogTitle>
                            <DialogDescription className="text-sm font-medium text-[#666]">
                                This location will be saved to your profile.
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        <LocationPicker
                            initialAddress={buyerLocation?.fullAddress}
                            initialCoordinates={buyerLocation ? { lat: buyerLocation.latitude, lng: buyerLocation.longitude } : null}
                            onLocationChange={handleLocationPickerChange}
                            label="Search Address"
                        />
                    </div>

                    <DialogFooter className="p-6 pt-2 pb-8 mt-auto shrink-0 flex flex-col gap-3">
                        <Button
                            onClick={saveLocationToProfile}
                            disabled={isUpdatingProfile || !buyerLocation?.fullAddress}
                            className="w-full h-12 rounded-xl bg-yellow-400 text-black font-bold text-sm hover:bg-yellow-500 shadow-[0_0_20px_rgba(250,204,21,0.1)] disabled:opacity-50 transition-all active:scale-[0.98]"
                        >
                            {isUpdatingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Save & Use Location
                        </Button>
                        <Button variant="ghost" onClick={() => setIsChangingLocation(false)} className="w-full h-10 rounded-xl text-xs font-bold text-[#666] hover:text-white">
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}
