import { isNativeApp } from '@/lib/mobileApp';

export const getShopUsername = (shopName?: string | null) => {
  return String(shopName || '').trim();
};

// The public web origin a buyer can actually open. Inside the native app
// window.location.origin is the in-app WebView host (capacitor://localhost or
// https://localhost) which is useless in a shared link, so shareable shop URLs
// must fall back to the canonical public site.
export const PUBLIC_WEB_ORIGIN =
  ((import.meta.env.VITE_PUBLIC_WEB_URL as string | undefined) || '').replace(/\/$/, '') ||
  'https://bybloshq.space';

const isShareableOrigin = (origin: string) =>
  /^https?:\/\//i.test(origin) && !/localhost|127\.0\.0\.1|\[::1\]/i.test(origin);

/**
 * Pick the origin a shop link should be built on. An explicit origin always
 * wins; otherwise use the current one on the web, but never leak the in-app
 * localhost host — fall back to the canonical public site there.
 */
const resolveShareOrigin = (origin?: string) => {
  if (origin) return origin;
  const current = window.location.origin;
  if (isNativeApp() || !isShareableOrigin(current)) return PUBLIC_WEB_ORIGIN;
  return current;
};

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const getShopUrl = (shopName?: string | null, origin?: string) => {
  const username = getShopUsername(shopName);
  if (!username) return '';
  return `${resolveShareOrigin(origin).replace(/\/$/, '')}/${encodeURIComponent(username)}`;
};

export const getCreatorShopUrl = (
  shopName?: string | null,
  creatorCode?: string | null,
  origin?: string
) => {
  const shopUrl = getShopUrl(shopName, origin);
  if (!shopUrl) return '';
  if (!creatorCode) return shopUrl;
  return `${shopUrl}?creator=${encodeURIComponent(creatorCode)}`;
};

export const copyLinkedTextToClipboard = async (label: string, url: string): Promise<'empty' | 'plain' | 'rich'> => {
  const cleanLabel = getShopUsername(label);
  if (!cleanLabel || !url) return 'empty' as const;

  await navigator.clipboard.writeText(url);
  return 'plain' as const;
};


