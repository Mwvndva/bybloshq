import axios from 'axios';
import { AuthStrategy, AuthPlatform, AppRole, StorageAdapter } from './types';
import { buildApiBaseUrl } from '../http/apiBaseUrl';

let csrfTokenCache: string | null = null;
let lastFetchedAt: number = 0;
const CSRF_TTL = 10 * 60 * 1000; // 10 minutes

export const getFreshCsrfToken = async (): Promise<string | null> => {
  try {
    const baseURL = buildApiBaseUrl();
    const response = await axios.get(`${baseURL}/public/csrf-token`, { withCredentials: true });
    csrfTokenCache = (response as import('axios').AxiosResponse<{ data?: { csrfToken?: string } }>).data?.data?.csrfToken || null;
    lastFetchedAt = Date.now();
    if (csrfTokenCache && typeof document !== 'undefined') {
      try {
        document.cookie = `csrf-token-v2=${csrfTokenCache}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `_csrf=${csrfTokenCache}; path=/; max-age=86400; SameSite=Lax`;
      } catch {
        /* ignore cookie write errors */
      }
    }
    return csrfTokenCache;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    return null;
  }
};

export const getCachedCsrfToken = (): string | null => csrfTokenCache;

export const setCachedCsrfToken = (token: string | null): void => {
  csrfTokenCache = token;
  if (token) lastFetchedAt = Date.now();
};

export class WebAuthStrategy implements AuthStrategy {
  readonly platform: AuthPlatform = 'web';

  constructor(private storageAdapter: StorageAdapter) {}

  async getAuthHeaders(): Promise<Record<string, string>> {
    // Web strategy relies on HttpOnly jwt cookie; no Authorization Bearer header sent on Web.
    return {};
  }

  async getCsrfHeader(): Promise<Record<string, string>> {
    const isFresh = csrfTokenCache && (Date.now() - lastFetchedAt < CSRF_TTL);
    let token = isFresh ? csrfTokenCache : null;
    if (!token) {
      token = await getFreshCsrfToken();
    }
    return token ? {
      'X-CSRF-Token': token,
      'Cookie': `csrf-token-v2=${token}; _csrf=${token}`
    } : {};
  }

  async handleUnauthorized(): Promise<boolean> {
    try {
      const baseURL = buildApiBaseUrl();
      const csrf = await this.getCsrfHeader();
      await axios.post(
        `${baseURL}/auth/refresh-token`,
        {},
        { withCredentials: true, headers: csrf }
      );
      return true;
    } catch {
      return false;
    }
  }

  async clearSession(role?: AppRole): Promise<void> {
    if (role) {
      await this.storageAdapter.removeItem(`${role}SessionActive`);
      await this.storageAdapter.removeItem(`${role}Token`);
      await this.storageAdapter.removeItem(`${role}RefreshToken`);
    } else {
      await this.storageAdapter.clear();
    }
  }
}
