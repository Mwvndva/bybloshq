import LocationPicker from '@/shared/components/LocationPicker';
import type { LocationCoordinates } from '@/infrastructure/location/location';

interface ShopLocationPickerProps {
    initialAddress?: string;
    initialCoordinates?: LocationCoordinates | null;
    onLocationChange: (address: string, coordinates: LocationCoordinates | null) => void;
}

export default function ShopLocationPicker({ initialAddress = '', initialCoordinates = null, onLocationChange }: ShopLocationPickerProps) {
    return (
        <LocationPicker
            initialAddress={initialAddress}
            initialCoordinates={initialCoordinates}
            onLocationChange={onLocationChange}
            placeholder="Search for your shop's area or street..."
            label="Search Location"
            detailedLabel="Detailed Address (Building, Floor, Shop No)"
            autoPopulate={false}
        />
    );
}
export { ShopLocationPicker };
