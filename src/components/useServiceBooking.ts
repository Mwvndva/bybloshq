import { useState, useEffect, useMemo } from 'react';
import { format, addDays, isBefore, startOfDay, parse } from 'date-fns';
import { cn, isSellerShopless } from '@/lib/utils';
import { useBuyerAuth, useGlobalAuth } from '@/features/auth/contexts';
import { toast } from 'sonner';
import { Product, type ApiSellerProduct } from '@/types';
import {
    createOptionalBuyerLocation,
    hasPreciseLocation,
    toBuyerLocationPayload,
    type BuyerLocationPayload,
    type LocationCoordinates,
    type OptionalBuyerLocation
} from '@/lib/location';

export type ProductWithApiFields = Product & Partial<ApiSellerProduct>;

export function useServiceBooking(
    product: ProductWithApiFields,
    isOpen: boolean,
    onConfirm: (bookingData: {
        date: Date;
        time: string;
        location: string;
        locationType?: string;
        serviceRequirements?: string;
        buyerLocation?: BuyerLocationPayload | null
    }) => void,
    initialBuyerLocation: BuyerLocationPayload | null = null
) {
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
    const serviceOptions = useMemo(() => (product.service_options || product.serviceOptions || {}) as { location_type?: string; price_type?: string; start_time?: string; end_time?: string; availability_days?: string[] }, [product.service_options, product.serviceOptions]);


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
                const shopAddress = seller?.physicalAddress || (seller as { physical_address?: string })?.physical_address;
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

    return {
        date,
        setDate,
        isDateDisabled,
        time,
        setTime,
        availableTimeSlots,
        isShopless,
        isChangingLocation,
        setIsChangingLocation,
        handleLocationPickerChange,
        customLocation,
        buyerProfile,
        saveLocationToProfile,
        isUpdatingProfile,
        buyerLocation,
        location,
        seller,
        serviceRequirements,
        setServiceRequirements,
        wordCount,
        maxWords,
        handleConfirm,
        isValid,
        getDisabledReason,
    };
}
