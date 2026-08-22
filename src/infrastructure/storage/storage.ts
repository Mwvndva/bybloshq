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

    try {
      const { value } = await Preferences.get({ key });
      return value || localStorage.getItem(key);
    } catch (e: any) {
      console.warn(`[Storage] Failed to get ${key} from Preferences`, e?.message || e);
      return localStorage.getItem(key);
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore localstorage error */
    }

    if (!isNativeApp()) return;

    try {
      await Preferences.set({ key, value });
    } catch (e: any) {
      console.warn(`[Storage] Failed to set ${key} in Preferences`, e?.message || e);
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
