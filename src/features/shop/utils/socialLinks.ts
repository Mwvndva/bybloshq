/** Shared helpers for rendering seller social + location links (buyer cards + shop header). */

/** Normalise a stored handle or URL into an openable social link, or null if empty. */
export function socialUrl(kind: 'instagram' | 'tiktok', value?: string | null): string | null {
  const raw = (value || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, '');
  return kind === 'instagram'
    ? `https://instagram.com/${handle}`
    : `https://www.tiktok.com/@${handle}`;
}

/** A Google Maps link for valid coordinates, or null when coords are missing/zero. */
export function coordsMapUrl(lat?: number | string | null, lng?: number | string | null): string | null {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;
  if (parsedLat === 0 && parsedLng === 0) return null;
  return `https://www.google.com/maps?q=${parsedLat},${parsedLng}`;
}
