import { Capacitor } from '@capacitor/core';

export const isNativeApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    Capacitor.isNativePlatform() ||
    window.location.protocol === 'capacitor:' ||
    Boolean((window as unknown as { Capacitor?: { isNative?: boolean } }).Capacitor?.isNative)
  );
};

export const getNativePlatform = () => Capacitor.getPlatform();

export const APP_DOWNLOAD_URL = 'https://play.google.com/store/apps/details?id=space.bybloshq.app';

export const getStableDeviceId = (): string => {
  const storageKey = 'byblosNativeDeviceId';
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;

    const generated = globalThis.crypto?.randomUUID?.()
      || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

export const getDevicePlatform = (): 'android' | 'ios' | 'desktop' => {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream) return 'ios';
  return 'desktop';
};

// Android Intent link to launch the installed app directly or fallback to Play Store
export const getAndroidDeepLink = (orderNumber?: string | null): string => {
  const path = orderNumber ? `buyer/orders?order=${encodeURIComponent(orderNumber)}` : 'buyer/orders';
  return `intent://byblos.app/${path}#Intent;scheme=byblos;package=space.bybloshq.app;S.browser_fallback_url=${encodeURIComponent(APP_DOWNLOAD_URL)};end;`;
};
