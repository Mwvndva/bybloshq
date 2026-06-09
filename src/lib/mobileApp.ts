import { Capacitor } from '@capacitor/core';

export const isNativeApp = () => Capacitor.isNativePlatform();

export const getNativePlatform = () => Capacitor.getPlatform();

export const getStableDeviceId = () => {
  const storageKey = 'byblosNativeDeviceId';
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;

  const generated = globalThis.crypto?.randomUUID?.()
    || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(storageKey, generated);
  return generated;
};
