import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Importing the shared marker parts also runs Leaflet's default-icon asset fix.
import { MapSizeInvalidator } from '@/components/common/locationPickerParts';

const MAP_TILE_URLS = [
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
];

// A pulsing yellow dot for the moving courier, distinct from the pin destination.
const courierIcon = L.divIcon({
  className: 'byblos-courier-marker',
  html: '<span class="byblos-courier-dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const destinationIcon = L.divIcon({
  className: 'byblos-destination-marker',
  html: '<span class="byblos-destination-pin"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

type LatLng = [number, number];

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 15), { animate: true });
    } else if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
    }
  }, [map, points]);
  return null;
}

function timeAgo(iso: string, now: number) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(1, Math.floor((now - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ago`;
}

export function LiveDeliveryMap({
  courier,
  destination,
  updatedAt,
  destinationLabel = 'Destination',
}: {
  courier: LatLng;
  destination?: LatLng | null;
  updatedAt?: string | null;
  destinationLabel?: string;
}) {
  const [tileIndex, setTileIndex] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => { setNow(Date.now()); }, 10_000);
    return () => { window.clearInterval(timer); };
  }, []);

  const points = useMemo<LatLng[]>(
    () => (destination ? [courier, destination] : [courier]),
    [courier, destination]
  );
  const watchKey = points.map((p) => p.join(',')).join('|');
  const tileUrl = MAP_TILE_URLS.at(tileIndex) ?? MAP_TILE_URLS[0];

  return (
    <div>
      <div className="relative h-52 w-full overflow-hidden rounded-xl border border-white/10">
        <MapContainer
          center={courier}
          zoom={15}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
        >
          <TileLayer
            key={tileUrl}
            attribution='&copy; OpenStreetMap &copy; CARTO'
            url={tileUrl}
            eventHandlers={{
              tileerror: () => { setTileIndex((i) => Math.min(i + 1, MAP_TILE_URLS.length - 1)); },
            }}
          />
          <Marker position={courier} icon={courierIcon} />
          {destination && <Marker position={destination} icon={destinationIcon} />}
          <FitBounds points={points} />
          <MapSizeInvalidator watchKey={watchKey} />
        </MapContainer>
        <style>{`
          .byblos-courier-dot {
            display: block; width: 16px; height: 16px; border-radius: 9999px;
            background: #facc15; border: 3px solid #000;
            box-shadow: 0 0 0 4px rgba(250,204,21,0.35);
            animation: byblos-pulse 1.6s ease-out infinite;
          }
          .byblos-destination-pin {
            display: block; width: 12px; height: 12px; border-radius: 9999px;
            background: #34d399; border: 3px solid #000;
          }
          @keyframes byblos-pulse {
            0% { box-shadow: 0 0 0 0 rgba(250,204,21,0.5); }
            100% { box-shadow: 0 0 0 12px rgba(250,204,21,0); }
          }
          @media (prefers-reduced-motion: reduce) {
            .byblos-courier-dot { animation: none; }
          }
        `}</style>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/55">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-yellow-400" /> Courier
          <span className="ml-2 h-2 w-2 rounded-full bg-emerald-400" /> {destinationLabel}
        </span>
        {updatedAt && <span>Updated {timeAgo(updatedAt, now)}</span>}
      </div>
    </div>
  );
}
