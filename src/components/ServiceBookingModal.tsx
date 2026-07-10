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
import { cn, isSellerShopless } from '@/lib/utils';
import { Calendar as CalendarIcon, Clock, MapPin, Edit2, Loader2 } from 'lucide-react';
import { useBuyerAuth, useGlobalAuth } from '@/features/auth/contexts';
import LocationPicker from './common/LocationPicker';
import { toast } from 'sonner';
import {
    createOptionalBuyerLocation,
    hasPreciseLocation,
    toBuyerLocationPayload,
    type BuyerLocationPayload,
    type LocationCoordinates,
    type OptionalBuyerLocation
} from '@/lib/location';

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
        buyerLocation?: BuyerLocationPayload | null
    }) => void;
    initialBuyerLocation?: BuyerLocationPayload | null;
}

export function ServiceBookingModal({ product, isOpen, onClose, onConfirm, initialBuyerLocation = null }: ServiceBookingModalProps & { product: ProductWithApiFields }) {
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [time, setTime] = useState<string>('');
    const [location, setLocation] = useState<string | null>(null);
    const [customLocation, setCustomLocation] = useState<string | null>(null);
    const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
    const [serviceRequirements, setServiceRequirements] = useState('');

    // Managed Location state
    const { user: buyerProfile } = useBuyerAuth();
    const { updateProfile } = useGlobalAuth();

    const [isChangingLocation, setIsChangingLocation] = useState(false);
    const [buyerLocation, setBuyerLocation] = useState<OptionalBuyerLocation | null>(null);
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const serviceOptions = useMemo(() => product.service_options || product.serviceOptions || {}, [product.service_options, product.serviceOptions]);


    const wordCount = serviceRequirements.trim().split(/\s+/).filter(w => w.length > 0).length;
    const maxWords = 50;

    const isShopless = isSellerShopless(product);
    const seller = product.seller || product.seller;

    // Standardized Mode: If seller has a shop, we prioritize 'At Shop' (In-store)
    const isSellerVisits = isShopless;

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setDate(undefined);
            setTime('');
            setServiceRequirements('');

            // PRE-FILL logic for coordinates (Mobile Services / Home Service)
            if (isShopless || initialBuyerLocation?.lat) {
                if (initialBuyerLocation && initialBuyerLocation.lat && initialBuyerLocation.lng) {
                    setBuyerLocation(initialBuyerLocation);
                    setCustomLocation(initialBuyerLocation.address || '');
                } else {
                    setBuyerLocation(null);
                    setCustomLocation('');
                }
            }

            // AUTO-SELECT Shop location if In-Store (Task BUG-SHOP-12)
            if (!isShopless) {
                const shopAddress = seller?.physicalAddress || seller?.physical_address;
                setLocation(shopAddress || 'Our Shop');
            } else {
                setLocation(null);
            }

        }
    }, [isOpen, initialBuyerLocation, isShopless, seller]); // Only trigger when modal opens/closes or initial location data changes

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

    const handleLocationPickerChange = (address: string, coords: LocationCoordinates | null) => {
        const newLoc = createOptionalBuyerLocation(address, coords);

        if (isShopless && !hasPreciseLocation(newLoc)) {
            toast.error('Search Precise Location', {
                description: 'Please select a suggested location from the map to ensure we can reach you.'
            });
        }

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
            const preciseLocation = toBuyerLocationPayload(buyerLocation.address, {
                lat: buyerLocation.lat,
                lng: buyerLocation.lng
            });

            if (!preciseLocation) {
                toast.error('Search Precise Location', {
                    description: 'Please select a suggested location from the map to ensure we can reach you.'
                });
                return;
            }

            await updateProfile({
                fullAddress: preciseLocation.address,
                latitude: preciseLocation.lat,
                longitude: preciseLocation.lng
            } as unknown as Partial<import('@/features/auth/types/authTypes').UserProfile>, 'buyer');
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
        const finalLocation = isShopless ? (buyerLocation?.address || null) : location;

        if (date && time && isLocationValid() && finalLocation) {
            const preciseBuyerLocation = isShopless
                ? toBuyerLocationPayload(finalLocation, { lat: buyerLocation?.lat, lng: buyerLocation?.lng })
                : null;

            onConfirm({
                date,
                time,
                location: finalLocation,
                serviceRequirements: serviceRequirements.trim() || '',
                buyerLocation: preciseBuyerLocation
            });
        }
    };

    const isLocationValid = () => {
        if (isShopless) {
            return hasPreciseLocation(buyerLocation);
        }
        return !!location;
    };

    const isValid = date && time && isLocationValid() && wordCount <= maxWords;

    const getDisabledReason = () => {
        if (!date) return 'Please select a date';
        if (!time) return 'Please select a time';
        if (!isLocationValid()) {
            if (isShopless) {
                if (!buyerLocation?.address) return 'Please set your location';
                if (!hasPreciseLocation(buyerLocation)) return 'Please select a specific location from suggestions';
            }
            if (isSellerVisits) return 'Please enter your address';
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

                <div className="flex-1 overflow-y-auto px-6 py-4 no-scrollbar">
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

                            {/* Location Selection - STRICT MODE */}
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-yellow-400/80 tracking-widest pl-1">
                                    {isShopless ? "Your Service Address / My Location" : "Service Location"}
                                </Label>

                                {isShopless ? (
                                    <div className="space-y-4 animate-in fade-in duration-500">
                                        {isChangingLocation ? (
                                            <div className="space-y-4 bg-white/5 p-4 rounded-3xl border border-white/10">
                                                <LocationPicker
                                                    onLocationChange={handleLocationPickerChange}
                                                    initialAddress={customLocation || buyerProfile?.fullAddress}
                                                    mapClassName="h-44 sm:h-56"
                                                />
                                                <Button
                                                    onClick={saveLocationToProfile}
                                                    disabled={isUpdatingProfile || !buyerLocation}
                                                    className="w-full h-12 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-2xl shadow-lg shadow-yellow-400/20"
                                                >
                                                    {isUpdatingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Precise Address'}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-start gap-4 p-4 bg-white/5 rounded-3xl border border-white/5 hover:border-white/20 transition-all group">
                                                <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-yellow-400/10 transition-colors">
                                                    <MapPin className="h-5 w-5 text-[#666] group-hover:text-yellow-400" />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <p className="text-sm font-medium text-white/90">
                                                        {customLocation || buyerProfile?.fullAddress || 'Search Precise Location...'}
                                                    </p>
                                                    <button
                                                        onClick={() => setIsChangingLocation(true)}
                                                        className="text-[10px] font-bold text-yellow-400 hover:text-yellow-300 uppercase tracking-wider flex items-center gap-1.5"
                                                    >
                                                        <Edit2 className="h-3 w-3" />
                                                        Edit Address
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {!isShopless ? (
                                            // Always use seller profile address for In-Store (Task BUG-SHOP-12)
                                            <div
                                                className="flex items-center gap-4 p-4 bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.1)] rounded-3xl border-2 border-yellow-400 transition-all cursor-default"
                                            >
                                                <div className="w-10 h-10 bg-black/10 rounded-2xl flex items-center justify-center shrink-0">
                                                    <MapPin className="h-5 w-5 text-black" />
                                                </div>
                                                <p className="text-sm font-bold text-black">
                                                    {location || seller?.physicalAddress || 'Our Shop'}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-white/5 rounded-3xl border border-white/5 text-center italic text-[#666] text-xs">
                                                Please select a location above!
                                            </div>
                                        )}
                                    </div>
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

                    <div className="flex-1 overflow-y-auto px-6 py-4 no-scrollbar">
                        <LocationPicker
                            initialAddress={buyerLocation?.address}
                            initialCoordinates={hasPreciseLocation(buyerLocation) ? { lat: buyerLocation.lat, lng: buyerLocation.lng } : null}
                            onLocationChange={handleLocationPickerChange}
                            label="Search Address"
                            autoPopulate={false}
                            initialValue={buyerLocation?.address || ''}
                            mapClassName="h-44 sm:h-56"
                        />
                    </div>

                    <DialogFooter className="p-6 pt-2 pb-8 mt-auto shrink-0 flex flex-col gap-3">
                        <Button
                            onClick={saveLocationToProfile}
                            disabled={isUpdatingProfile || !buyerLocation?.address}
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


