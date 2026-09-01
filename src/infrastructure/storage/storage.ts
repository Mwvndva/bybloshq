import { Preferences } from '@capacitor/preferences';
import { isNativeApp } from '../navigation/mobileApp';

export const BYBLOS_AUTH_KEYS = {
  ACTIVE_ROLE: 'byblos.auth.active_role',
  SESSION: 'byblos.auth.session',
  TOKEN: 'byblos.auth.token',
  REFRESH_TOKEN: 'byblos.auth.refresh_token',
  CSRF_TOKEN: 'byblos.auth.csrf_token',
} as const;

export const LEGACY_AUTH_KEYS = [
  'buyer_token_legacy',
  'buyer_session_legacy',
  'seller_token_legacy',
  'seller_session_legacy',
  'creator_token_legacy',
  'creator_session_legacy',
  'admin_token_legacy',
  'admin_authenticated',
  'marketing_token_legacy',
  'marketing_session_legacy',
  'logistics_token_legacy',
  'mzigoLogisticsToken',
] as const;

export const storage = {
  async get(key: string): Promise<string | null> {
    if (!isNativeApp()) {
      try {
        return sessionStorage.getItem(key) || localStorage.getItem(key);
      } catch {
        return null;
      }
    }

    // 1. Try native Keystore-backed SecureStorage first
    try {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
      const val = await SecureStorage.getItem(key);
      if (val !== null && val !== undefined) {
        return String(val);
      }
    } catch (e: any) {
      console.warn(`[Storage] Failed to read ${key} from SecureStorage`, e?.message || e);
    }

    // 2. Migration fallback: Check Preferences for previously stored tokens
    try {
      const { value } = await Preferences.get({ key });
      if (value !== null && value !== undefined) {
        // Automatically migrate to SecureStorage and clean up unencrypted Preferences
        try {
          const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
          await SecureStorage.setItem(key, value);
          await Preferences.remove({ key });
        } catch {
          // ignore migration write failure
        }
        return value;
      }
    } catch (e: any) {
      console.warn(`[Storage] Failed to get ${key} from Preferences fallback`, e?.message || e);
    }

    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    if (!isNativeApp()) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* ignore localstorage error */
      }
      return;
    }

    // On native Android/iOS, write exclusively to Keystore-backed SecureStorage
    try {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
      await SecureStorage.setItem(key, value);
      // Clean up any stale unencrypted copy in Preferences
      await Preferences.remove({ key }).catch(() => {});
    } catch (e: any) {
      console.warn(`[Storage] Failed to set ${key} in SecureStorage, using fallback`, e?.message || e);
      try {
        await Preferences.set({ key, value });
      } catch (prefErr: any) {
        console.warn(`[Storage] Failed to set ${key} in Preferences fallback`, prefErr?.message || prefErr);
      }
    }
  },

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }

    if (!isNativeApp()) return;

    try {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
      await SecureStorage.removeItem(key);
    } catch (e: any) {
      console.warn(`[Storage] Failed to remove ${key} from SecureStorage`, e?.message || e);
    }

    try {
      await Preferences.remove({ key });
    } catch (e: any) {
      console.warn(`[Storage] Failed to remove ${key} from Preferences`, e?.message || e);
    }
  },

  async clear(): Promise<void> {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }

    if (!isNativeApp()) return;

    try {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
      await SecureStorage.clear();
    } catch (e: any) {
      console.warn(`[Storage] Failed to clear SecureStorage`, e?.message || e);
    }

    try {
      await Preferences.clear();
    } catch (e: any) {
      console.warn(`[Storage] Failed to clear Preferences`, e?.message || e);
    }
  }
};

export const authStorage = {
  async purgeLegacyAndInactiveKeys(activeRole?: string): Promise<void> {
    const removalPromises: Promise<void>[] = [];

    for (const key of LEGACY_AUTH_KEYS) {
      removalPromises.push(storage.remove(key));
    }

    const allRoles = ['buyer', 'seller', 'creator', 'admin', 'marketing', 'logistics'];
    for (const r of allRoles) {
      if (r !== activeRole) {
        removalPromises.push(storage.remove(`${r}Token`));
        removalPromises.push(storage.remove(`${r}RefreshToken`));
        removalPromises.push(storage.remove(`${r}SessionActive`));
      }
    }

    await Promise.all(removalPromises);
  },

  async setActiveRole(role: string): Promise<void> {
    await storage.set(BYBLOS_AUTH_KEYS.ACTIVE_ROLE, role);
  },

  async getActiveRole(): Promise<string | null> {
    return storage.get(BYBLOS_AUTH_KEYS.ACTIVE_ROLE);
  },

  async setSessionData(session: unknown): Promise<void> {
    const serialized = JSON.stringify(session);
    await storage.set(BYBLOS_AUTH_KEYS.SESSION, serialized);
  },

  async getSessionData<T = unknown>(): Promise<T | null> {
    const raw = await storage.get(BYBLOS_AUTH_KEYS.SESSION);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async clearAuth(): Promise<void> {
    await storage.remove(BYBLOS_AUTH_KEYS.ACTIVE_ROLE);
    await storage.remove(BYBLOS_AUTH_KEYS.SESSION);
    await storage.remove(BYBLOS_AUTH_KEYS.TOKEN);
    await storage.remove(BYBLOS_AUTH_KEYS.REFRESH_TOKEN);
    await storage.remove(BYBLOS_AUTH_KEYS.CSRF_TOKEN);
    await this.purgeLegacyAndInactiveKeys();
  }
};
