import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios, { AxiosError } from 'axios';
import { cn } from '@/lib/utils';
import {
    DEFAULT_MAP_CENTER,
    createLocationSelection,
    normalizeCoordinates,
    type LocationCoordinates
} from '@/lib/location';

// Fix Leaflet marker icon issue
if (typeof window !== 'undefined') {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
}

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

interface LocationPickerProps {
    initialAddress?: string;
    initialCoordinates?: LocationCoordinates | null;
    onLocationChange: (address: string, coordinates: LocationCoordinates | null) => void;
    placeholder?: string;
    label?: string;
    detailedLabel?: string;
    className?: string;
    mapClassName?: string;
    autoPopulate?: boolean;
    initialValue?: string;
}

const buildSearchQueries = (query: string) => {
    const trimmedQuery = query.trim();
    const lowerQuery = trimmedQuery.toLowerCase();
    const hasKenyaContext = /\b(kenya|nairobi|mombasa|kisumu|nakuru|eldoret|kiambu|thika|rongai|kitengela)\b/.test(lowerQuery);

    return hasKenyaContext ? [trimmedQuery] : [`${trimmedQuery}, Kenya`, trimmedQuery];
};

const uniqueLocationResults = (results: any[]) => {
    const seen = new Set<string>();
    return results.filter((result) => {
        const key = `${result.osm_type || ''}:${result.osm_id || ''}:${result.display_name || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const searchOpenStreetMap = async (query: string) => {
    const responses = await Promise.all(
        buildSearchQueries(query).map((searchQuery) => axios.get<any[]>('https://nominatim.openstreetmap.org/search', {
            params: {
                format: 'json',
                q: searchQuery,
                countrycodes: 'ke',
                addressdetails: 1,
                limit: 6
            }
        }))
    );

    return uniqueLocationResults(responses.flatMap((response) => response.data)).slice(0, 8);
};

const searchPhoton = async (query: string) => {
    const response = await axios.get('https://photon.komoot.io/api/', {
        params: {
            q: query,
            lat: DEFAULT_MAP_CENTER.lat,
            lon: DEFAULT_MAP_CENTER.lng,
            limit: 8,
            lang: 'en'
        }
    });

    const features = Array.isArray(response.data?.features) ? response.data.features : [];

    return features
        .filter((feature: any) => {
            const country = String(feature.properties?.country || feature.properties?.countrycode || '').toLowerCase();
            return !country || country === 'kenya' || country === 'ke';
        })
        .map((feature: any) => {
            const [lon, lat] = feature.geometry?.coordinates || [];
            const properties = feature.properties || {};
            const displayParts = [
                properties.name,
                properties.street,
                properties.district,
                properties.city,
                properties.county,
                properties.country
            ].filter(Boolean);

            return {
                osm_type: 'photon',
                osm_id: properties.osm_id || displayParts.join('-'),
                display_name: displayParts.join(', '),
                lat: String(lat),
                lon: String(lon)
            };
        })
        .filter((result: any) => result.display_name && Number.isFinite(Number(result.lat)) && Number.isFinite(Number(result.lon)));
};

export default function LocationPicker({
    initialAddress = '',
    initialCoordinates = null,
    onLocationChange,
    placeholder = "Search for a location...",
    label = "Search Location",
    detailedLabel = "Detailed Address",
    className,
    mapClassName,
    autoPopulate = true,
    initialValue = ''
}: LocationPickerProps) {
    const normalizedInitialCoordinates = normalizeCoordinates(initialCoordinates);
    const [address, setAddress] = useState(initialAddress);
    const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(normalizedInitialCoordinates ? [normalizedInitialCoordinates.lat, normalizedInitialCoordinates.lng] : null);
    const [center, setCenter] = useState<[number, number]>(normalizedInitialCoordinates ? [normalizedInitialCoordinates.lat, normalizedInitialCoordinates.lng] : [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng]);
    const [searchQuery, setSearchQuery] = useState(initialValue);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (initialAddress && initialAddress !== address) {
            setAddress(initialAddress);
        }
        const nextInitialCoordinates = normalizeCoordinates(initialCoordinates);
        if (nextInitialCoordinates) {
            if (!markerPosition || nextInitialCoordinates.lat !== markerPosition[0] || nextInitialCoordinates.lng !== markerPosition[1]) {
                const newPos: [number, number] = [nextInitialCoordinates.lat, nextInitialCoordinates.lng];
                setMarkerPosition(newPos);
                setCenter(newPos);
            }
        }
    }, [initialAddress, initialCoordinates]);

    const searchAddress = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setSearchError('');
            setHasSearched(false);
            return;
        }

        setIsSearching(true);
        setSearchError('');
        try {
            const openStreetMapResults = await searchOpenStreetMap(query);
            const results = openStreetMapResults.length > 0 ? openStreetMapResults : await searchPhoton(query);
            setSearchResults(uniqueLocationResults(results).slice(0, 8));
            setShowResults(true);
        } catch (error) {
            console.error('Error searching address:', error);
            const status = (error as AxiosError)?.response?.status;
            setSearchError(status === 429
                ? 'Location search is busy. Try again in a few seconds.'
                : 'Could not load locations. Check your connection and try again.');
            setSearchResults([]);
            setShowResults(true);
        } finally {
            setHasSearched(true);
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
            setShowResults(true);
            setHasSearched(false);
            setSearchError('');
            searchTimeoutRef.current = setTimeout(() => {
                searchAddress(value);
            }, 500);
        } else {
            setSearchResults([]);
            setShowResults(false);
            setSearchError('');
            setHasSearched(false);
        }
    };

    const selectLocation = (result: any) => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        const newPos: [number, number] = [lat, lon];
        setMarkerPosition(newPos);
        setCenter(newPos);
        setSearchQuery(result.display_name);
        setShowResults(false);

        // Update detailed address if empty, and trigger change
        const finalDetailedAddress = autoPopulate && address.trim() === '' ? result.display_name : address;
        if (autoPopulate && address.trim() === '') {
            setAddress(result.display_name);
        }

        const selection = createLocationSelection(finalDetailedAddress, { lat, lng: lon });
        onLocationChange(selection.address, selection.coordinates);
    };

    const handleManualAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newAddress = e.target.value;
        setAddress(newAddress);
        const selection = createLocationSelection(
            newAddress,
            markerPosition ? { lat: markerPosition[0], lng: markerPosition[1] } : null
        );
        onLocationChange(selection.address, selection.coordinates);
    };

    const handleMapClick = (lat: number, lng: number) => {
        const newPos: [number, number] = [lat, lng];
        setMarkerPosition(newPos);
        const selection = createLocationSelection(address, { lat, lng });
        onLocationChange(selection.address, selection.coordinates);
    }

    return (
        <div className={cn("space-y-4", className)}>
            <div>
                <Label htmlFor="location-search" className="text-sm font-semibold text-gray-200 block mb-2">
                    {label}
                </Label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                        id="location-search"
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchChange}
                    className="pl-12 md:pl-12 h-11 bg-white border-slate-200 text-slate-950 placeholder:text-slate-400"
                        placeholder={placeholder}
                        autoComplete="off"
                    />
                    {isSearching && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <Loader2 className="h-4 w-4 text-gray-300 animate-spin" />
                        </div>
                    )}

                    {showResults && (
                        <div className="absolute left-0 right-0 top-full z-[5000] mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
                            {searchResults.length > 0 ? (
                                searchResults.map((result, index) => (
                                    <button
                                        key={`${result.osm_type || 'location'}-${result.osm_id || index}`}
                                        type="button"
                                        className="w-full border-b border-slate-100 px-3 py-2.5 text-left text-xs leading-snug hover:bg-slate-50 focus:bg-slate-50 focus:outline-none sm:text-sm last:border-0"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => selectLocation(result)}
                                    >
                                        {result.display_name}
                                    </button>
                                ))
                            ) : (
                                <div className="px-3 py-3 text-xs font-semibold text-slate-500 sm:text-sm">
                                    {isSearching
                                        ? 'Searching locations...'
                                        : searchError || (hasSearched ? 'No locations found. Try adding Nairobi, Kenya, or a nearby landmark.' : 'Keep typing to search locations.')}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div>
                <Label htmlFor="address-detailed" className="text-sm font-semibold text-gray-200 block mb-2">
                    {detailedLabel}
                </Label>
                <Input
                    id="address-detailed"
                    type="text"
                    value={address}
                    onChange={handleManualAddressChange}
                    className="h-11 bg-white border-slate-200 text-slate-950 placeholder:text-slate-400"
                    placeholder="e.g. Building Name, Floor, Office/House No"
                />
            </div>

            <div className={cn("h-56 w-full rounded-xl overflow-hidden border border-white/10 shadow-inner z-0 relative sm:h-64", mapClassName)}>
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
            <p className="text-[10px] text-gray-400 text-center uppercase tracking-wider font-bold">
                Tap the map to pin exact location
            </p>
        </div>
    );
}
