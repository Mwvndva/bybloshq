import axios from 'axios';

const DEFAULT_MAP_CENTER = {
  lat: -1.2921,
  lng: 36.8219,
};

const USER_AGENT = 'ByblosHQ/1.0 (location-search; https://www.bybloshq.space)';

function buildSearchQueries(query) {
  const trimmedQuery = String(query || '').trim();
  const lowerQuery = trimmedQuery.toLowerCase();
  const hasKenyaContext = /\b(kenya|nairobi|mombasa|kisumu|nakuru|eldoret|kiambu|thika|rongai|kitengela)\b/.test(lowerQuery);

  return hasKenyaContext ? [trimmedQuery] : [`${trimmedQuery}, Kenya`, trimmedQuery];
}

function uniqueLocationResults(results) {
  const seen = new Set();

  return results.filter((result) => {
    const key = `${result.provider || ''}:${result.id || ''}:${result.displayName || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeLatLng(lat, lng) {
  const normalizedLat = Number(lat);
  const normalizedLng = Number(lng);

  if (!Number.isFinite(normalizedLat) || !Number.isFinite(normalizedLng)) return null;

  return {
    lat: normalizedLat,
    lng: normalizedLng,
  };
}

function toOpenStreetMapResult(result) {
  const coordinates = normalizeLatLng(result.lat, result.lon);
  if (!coordinates || !result.display_name) return null;

  return {
    provider: 'openstreetmap',
    id: `${result.osm_type || 'osm'}:${result.osm_id || result.place_id || result.display_name}`,
    displayName: result.display_name,
    lat: coordinates.lat,
    lng: coordinates.lng,
  };
}

function toPhotonResult(feature) {
  const [lng, lat] = feature?.geometry?.coordinates || [];
  const coordinates = normalizeLatLng(lat, lng);
  if (!coordinates) return null;

  const properties = feature.properties || {};
  const country = String(properties.country || properties.countrycode || '').toLowerCase();
  if (country && country !== 'kenya' && country !== 'ke') return null;

  const displayParts = [
    properties.name,
    properties.street,
    properties.district,
    properties.city,
    properties.county,
    properties.country,
  ].filter(Boolean);
  const displayName = displayParts.join(', ');
  if (!displayName) return null;

  return {
    provider: 'photon',
    id: `photon:${properties.osm_id || displayName}`,
    displayName,
    lat: coordinates.lat,
    lng: coordinates.lng,
  };
}

async function searchOpenStreetMap(query) {
  const responses = [];

  for (const searchQuery of buildSearchQueries(query)) {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        format: 'json',
        q: searchQuery,
        countrycodes: 'ke',
        addressdetails: 1,
        limit: 6,
      },
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      timeout: 7000,
    });
    responses.push(...response.data);
  }

  return uniqueLocationResults(responses.map(toOpenStreetMapResult).filter(Boolean)).slice(0, 8);
}

async function searchPhoton(query) {
  const response = await axios.get('https://photon.komoot.io/api/', {
    params: {
      q: query,
      lat: DEFAULT_MAP_CENTER.lat,
      lon: DEFAULT_MAP_CENTER.lng,
      limit: 8,
      lang: 'en',
    },
    timeout: 7000,
  });

  const features = Array.isArray(response.data?.features) ? response.data.features : [];
  return uniqueLocationResults(features.map(toPhotonResult).filter(Boolean)).slice(0, 8);
}

export async function searchLocations(query) {
  const normalizedQuery = String(query || '').trim();
  if (normalizedQuery.length < 3) return [];

  const errors = [];

  try {
    const openStreetMapResults = await searchOpenStreetMap(normalizedQuery);
    if (openStreetMapResults.length > 0) return openStreetMapResults;
  } catch (error) {
    errors.push(`openstreetmap:${error.message}`);
  }

  try {
    const photonResults = await searchPhoton(normalizedQuery);
    if (photonResults.length > 0) return photonResults;
  } catch (error) {
    errors.push(`photon:${error.message}`);
  }

  if (errors.length > 1) {
    const error = new Error('Location providers unavailable');
    error.providerErrors = errors;
    throw error;
  }

  return [];
}
