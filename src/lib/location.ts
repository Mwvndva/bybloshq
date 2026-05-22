export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface LocationSelection {
  address: string;
  coordinates: LocationCoordinates | null;
}

export interface BuyerLocationPayload {
  address: string;
  lat: number;
  lng: number;
}

export interface OptionalBuyerLocation {
  address: string;
  lat: number | null;
  lng: number | null;
}

type CoordinateInput = {
  lat?: number | null;
  lng?: number | null;
};

export const DEFAULT_MAP_CENTER: LocationCoordinates = {
  lat: -1.2921,
  lng: 36.8219
};

export const normalizeCoordinates = (
  coordinates?: CoordinateInput | null
): LocationCoordinates | null => {
  if (!coordinates) return null;
  if (coordinates.lat === null || coordinates.lat === undefined) return null;
  if (coordinates.lng === null || coordinates.lng === undefined) return null;

  const lat = Number(coordinates.lat);
  const lng = Number(coordinates.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
};

export const createLocationSelection = (
  address: string,
  coordinates?: CoordinateInput | null
): LocationSelection => ({
  address,
  coordinates: normalizeCoordinates(coordinates)
});

export const createOptionalBuyerLocation = (
  address: string,
  coordinates?: CoordinateInput | null
): OptionalBuyerLocation => {
  const normalized = normalizeCoordinates(coordinates);

  return {
    address,
    lat: normalized?.lat ?? null,
    lng: normalized?.lng ?? null
  };
};

export const toBuyerLocationPayload = (
  address: string | undefined | null,
  coordinates?: CoordinateInput | null
): BuyerLocationPayload | null => {
  const normalizedAddress = (address || '').trim();
  const normalizedCoordinates = normalizeCoordinates(coordinates);

  if (!normalizedAddress || !normalizedCoordinates) return null;

  return {
    address: normalizedAddress,
    lat: normalizedCoordinates.lat,
    lng: normalizedCoordinates.lng
  };
};

export const hasPreciseLocation = (
  location?: OptionalBuyerLocation | BuyerLocationPayload | null
): location is BuyerLocationPayload => {
  return Boolean(
    location?.address?.trim() &&
    normalizeCoordinates({ lat: location.lat, lng: location.lng })
  );
};
