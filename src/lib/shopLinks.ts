export const getShopUsername = (shopName?: string | null) => {
  return String(shopName || '').trim();
};

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const getShopUrl = (shopName?: string | null, origin = window.location.origin) => {
  const username = getShopUsername(shopName);
  if (!username) return '';
  return `${origin.replace(/\/$/, '')}/${encodeURIComponent(username)}`;
};

export const getCreatorShopUrl = (
  shopName?: string | null,
  creatorCode?: string | null,
  origin = window.location.origin
) => {
  const shopUrl = getShopUrl(shopName, origin);
  if (!shopUrl) return '';
  if (!creatorCode) return shopUrl;
  return `${shopUrl}?creator=${encodeURIComponent(creatorCode)}`;
};

export const copyLinkedTextToClipboard = async (label: string, url: string) => {
  const cleanLabel = getShopUsername(label);
  if (!cleanLabel || !url) return 'empty' as const;

  await navigator.clipboard.writeText(url);
  return 'plain' as const;
};


