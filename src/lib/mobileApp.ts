import { Capacitor } from '@capacitor/core';

export const isNativeApp = () => Capacitor.isNativePlatform();

export const getNativePlatform = () => Capacitor.getPlatform();

// Google Play listing for the Byblos Android app (package site.byblosafrica.app).
export const APP_DOWNLOAD_URL = 'https://play.google.com/store/apps/details?id=site.byblosafrica.app';

export const isAndroidDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
};

/**
 * Attempts to launch the native Android app using Intent URI deep linking.
 * If installed -> opens native app route.
 * If not installed -> seamlessly falls back to fallbackUrl in browser.
 */
export const openInAndroidApp = (path: string, fallbackUrl: string): void => {
  if (typeof window === 'undefined') return;
  const cleanPath = path.replace(/^\//, '');
  const encodedFallback = encodeURIComponent(fallbackUrl);
  const intentUrl = `intent://${cleanPath}#Intent;scheme=site.byblosafrica.app;package=site.byblosafrica.app;S.browser_fallback_url=${encodedFallback};end;`;
  window.location.href = intentUrl;
};

export const getStableDeviceId = (): string => {
  const storageKey = 'byblosNativeDeviceId';
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;

  const generated = globalThis.crypto?.randomUUID?.()
    || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(storageKey, generated);
  return generated;
};
