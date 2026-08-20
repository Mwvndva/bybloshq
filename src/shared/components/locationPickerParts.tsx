import { useEffect } from 'react';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import L from 'leaflet';

// Fix Leaflet marker icon issue
if (typeof window !== 'undefined') {
    delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: markerIcon2x,
        iconUrl: markerIcon,
        shadowUrl: markerShadow,
    });
}

// Component to handle map clicks
export function LocationMarker({ position, setPosition }: { position: [number, number] | null, setPosition: (pos: [number, number]) => void }) {
    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });

    return position ? <Marker position={position} /> : null;
}

export function MapSizeInvalidator({ watchKey }: { watchKey: string }) {
    const map = useMap();

    useEffect(() => {
        const invalidate = () => map.invalidateSize({ animate: false });
        const first = window.setTimeout(invalidate, 80);
        const second = window.setTimeout(invalidate, 300);

        return () => {
            window.clearTimeout(first);
            window.clearTimeout(second);
        };
    }, [map, watchKey]);

    return null;
}

// Component to fly to location
export function MapFlyTo({ position }: { position: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.invalidateSize({ animate: false });
            map.flyTo(position, Math.max(map.getZoom(), 15), {
                animate: true,
                duration: 0.6
            });
        }
    }, [position, map]);
    return null;
}
