import LocationPicker from '../common/LocationPicker';

interface ShopLocationPickerProps {
    initialAddress?: string;
    initialCoordinates?: { lat: number; lng: number } | null;
    onLocationChange: (address: string, coordinates: { lat: number; lng: number } | null) => void;
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
