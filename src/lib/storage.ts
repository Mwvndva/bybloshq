import { Preferences } from '@capacitor/preferences';
import { isNativeApp } from './mobileApp';

export const storage = {
  async get(key: string): Promise<string | null> {
    if (!isNativeApp()) {
      return localStorage.getItem(key);
    }

    try {
      const { value } = await Preferences.get({ key });
      return value;
    } catch (e) {
      console.warn(`[Storage] Failed to get ${key} from Preferences`, e);
      // Fallback for non-Capacitor environments like standard web browsers
      return localStorage.getItem(key);
    }
  },

  async set(key: string, value: string): Promise<void> {
    if (!isNativeApp()) {
      localStorage.setItem(key, value);
      return;
    }

    try {
      await Preferences.set({ key, value });
    } catch (e) {
      console.warn(`[Storage] Failed to set ${key} in Preferences`, e);
      localStorage.setItem(key, value);
    }
  },

  async remove(key: string): Promise<void> {
    if (!isNativeApp()) {
      localStorage.removeItem(key);
      return;
    }

    try {
      await Preferences.remove({ key });
    } catch (e) {
      console.warn(`[Storage] Failed to remove ${key} from Preferences`, e);
      localStorage.removeItem(key);
    }
  },
  
  async clear(): Promise<void> {
    if (!isNativeApp()) {
      localStorage.clear();
      return;
    }

    try {
      await Preferences.clear();
    } catch (e) {
      console.warn(`[Storage] Failed to clear Preferences`, e);
      localStorage.clear();
    }
  }
};
