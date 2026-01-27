import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';

// Fix Leaflet marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map clicks
function LocationMarker({ position, setPosition }: { position: [number, number] | null, setPosition: (pos: [number, number]) => void }) {
    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });

    return position ? <Marker position={position} /> : null;
}

// Component to fly to location
function MapFlyTo({ position }: { position: [number, number] | null }) {
    const map = useMapEvents({});
    useEffect(() => {
        if (position) {
            map.flyTo(position, map.getZoom());
        }
    }, [position, map]);
    return null;
}

interface ShopLocationPickerProps {
    initialAddress?: string;
    initialCoordinates?: { lat: number; lng: number } | null;
    onLocationChange: (address: string, coordinates: { lat: number; lng: number } | null) => void;
}

export default function ShopLocationPicker({ initialAddress = '', initialCoordinates = null, onLocationChange }: ShopLocationPickerProps) {
    // Local state for UI components
    // We initialize from props but do not blindly sync back to parent via effect to avoid loops
    const [address, setAddress] = useState(initialAddress);
    const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(initialCoordinates ? [initialCoordinates.lat, initialCoordinates.lng] : null);
    const [center, setCenter] = useState<[number, number]>(initialCoordinates ? [initialCoordinates.lat, initialCoordinates.lng] : [-1.2921, 36.8219]); // Default Nairobi

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize/Reset state when props change significantly (e.g. initial load or different entity)
    // We use a ref to track if it's the first sync or checking if values match to avoid "echo" loops
    useEffect(() => {
        // Only update local state if props are different from current local state
        if (initialAddress && initialAddress !== address) {
            setAddress(initialAddress);
        }
        if (initialCoordinates) {
            if (!markerPosition || initialCoordinates.lat !== markerPosition[0] || initialCoordinates.lng !== markerPosition[1]) {
                setMarkerPosition([initialCoordinates.lat, initialCoordinates.lng]);
                setCenter([initialCoordinates.lat, initialCoordinates.lng]);
            }
        }
    }, [initialAddress, initialCoordinates]);

    // Search for address using Nominatim (OpenStreetMap)
    const searchAddress = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const response = await axios.get<any[]>(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&headers=${encodeURIComponent('User-Agent: ByblosHQ/1.0')}`);
            setSearchResults(response.data);
            setShowResults(true);
        } catch (error) {
            console.error('Error searching address:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (value.length > 2) {
            searchTimeoutRef.current = setTimeout(() => {
                searchAddress(value);
            }, 500); // Debounce search
        } else {
            setSearchResults([]);
            setShowResults(false);
        }
    };

    const selectLocation = (result: any) => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        const newPos: [number, number] = [lat, lon];
        setMarkerPosition(newPos);
        setCenter(newPos);
        // setAddress(result.display_name); // Stop copying to detailed address
        setSearchQuery(result.display_name);
        setShowResults(false);

        // Directly notify parent of user action - use current detailed address
        onLocationChange(address, { lat, lng: lon });
    };

    const handleManualAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newAddress = e.target.value;
        setAddress(newAddress);
        // Directly notify parent of user action
        // Preserve existing coordinates if just editing text, or clear them? 
        // Keeping them seems safer for minor edits.
        const coords = markerPosition ? { lat: markerPosition[0], lng: markerPosition[1] } : null;
        onLocationChange(newAddress, coords);
    };

    const handleMapClick = (lat: number, lng: number) => {
        const newPos: [number, number] = [lat, lng];
        setMarkerPosition(newPos);
        const coords = { lat, lng };
        // Note: We don't automatically reverse geocode here to update address text 
        // to avoid overwriting user manual entry with potentially less accurate map address.
        onLocationChange(address, coords);
    }

    return (
        <div className="space-y-4">
            <div>
                <Label htmlFor="address-search" className="text-sm font-semibold text-gray-200 block mb-2">
                    Search Location
                </Label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                        id="address-search"
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className="pl-10 h-11"
                        placeholder="Search for your shop's area or street..."
                        autoComplete="off"
                    />
                    {isSearching && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                        </div>
                    )}

                    {/* Search Results Dropdown */}
                    {showResults && searchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-md shadow-lg max-h-60 overflow-auto">
                            {searchResults.map((result, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    className="w-full text-left px-4 py-2 hover:bg-white/5 focus:bg-white/5 focus:outline-none border-b border-white/5 last:border-0 text-sm text-gray-200"
                                    onClick={() => selectLocation(result)}
                                >
                                    {result.display_name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Manual Address Input Backup */}
            <div>
                <Label htmlFor="address-manual" className="text-sm font-semibold text-gray-200 block mb-2">
                    Detailed Address (Building, Floor, Shop No)
                </Label>
                <Input
                    id="address-manual"
                    type="text"
                    value={address}
                    onChange={handleManualAddressChange}
                    className="h-11"
                    placeholder="e.g. Shop B12, Ground Floor, Moi Avenue"
                />
            </div>

            {/* Wrapper for Leaflet Map to ensure consistent size */}
            <div className="h-64 sm:h-80 w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner z-0 relative">
                <MapContainer
                    center={center}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationMarker position={markerPosition} setPosition={(pos) => handleMapClick(pos[0], pos[1])} />
                    <MapFlyTo position={center} />
                </MapContainer>
            </div>
            <p className="text-xs text-gray-500 text-center">
                Click on the map to pin your exact location
            </p>
        </div>
    );
}
