export const isNativeApp = () => {
  if (typeof window === 'undefined') return false;
  return (
    Capacitor.isNativePlatform() ||
    window.location.hostname === 'localhost' ||
    window.location.protocol === 'capacitor:'
  );
};

export const getNativePlatform = () => Capacitor.getPlatform();

// Google Play listing for the Byblos Android app (package space.bybloshq.app).
// Used to nudge web buyers to install the app so push notifications reach them.
export const APP_DOWNLOAD_URL = 'https://play.google.com/store/apps/details?id=space.bybloshq.app';

export const getStableDeviceId = () => {
  const storageKey = 'byblosNativeDeviceId';
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;

  const generated = globalThis.crypto?.randomUUID?.()
    || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(storageKey, generated);
  return generated;
};
