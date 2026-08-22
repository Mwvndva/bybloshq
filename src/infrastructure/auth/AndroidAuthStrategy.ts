import axios from 'axios';
import { AuthStrategy, AuthPlatform, AppRole, StorageAdapter } from './types';
import { buildApiBaseUrl } from '../http/apiBaseUrl';

import { getFreshCsrfToken, getCachedCsrfToken } from './WebAuthStrategy';

export class AndroidAuthStrategy implements AuthStrategy {
  readonly platform: AuthPlatform = 'android';

  constructor(private storageAdapter: StorageAdapter) {}

  async getAuthHeaders(role?: AppRole): Promise<Record<string, string>> {
    let token: string | null = null;
    if (role) {
      token = await this.storageAdapter.getItem(`${role}Token`);
    }
    if (!token) {
      for (const r of ['buyer', 'seller', 'creator', 'admin', 'logistics', 'marketing']) {
        token = await this.storageAdapter.getItem(`${r}Token`);
        if (token) break;
      }
    }
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getCsrfHeader(): Promise<Record<string, string>> {
    let token = getCachedCsrfToken();
    if (!token) {
      token = await getFreshCsrfToken();
    }
    return token ? {
      'X-CSRF-Token': token,
      'Cookie': `csrf-token-v2=${token}; _csrf=${token}`
    } : {};
  }

  async handleUnauthorized(role?: AppRole): Promise<boolean> {
    if (!role) return false;
    const refreshToken = await this.storageAdapter.getItem(`${role}RefreshToken`);
    if (!refreshToken) return false;

    try {
      const baseURL = buildApiBaseUrl();
      const resp = await axios.post(
        `${baseURL}/auth/refresh-token`,
        { refreshToken },
        { withCredentials: true }
      );
      const data = (resp.data as { data?: { accessToken?: string; refreshToken?: string } })?.data;
      if (!data?.accessToken) return false;

      await this.storageAdapter.setItem(`${role}Token`, data.accessToken);
      if (data.refreshToken) {
        await this.storageAdapter.setItem(`${role}RefreshToken`, data.refreshToken);
      }
      return true;
    } catch {
      await this.storageAdapter.removeItem(`${role}RefreshToken`);
      return false;
    }
  }

  async clearSession(role?: AppRole): Promise<void> {
    if (role) {
      await this.storageAdapter.removeItem(`${role}Token`);
      await this.storageAdapter.removeItem(`${role}RefreshToken`);
      await this.storageAdapter.removeItem(`${role}SessionActive`);
    } else {
      await this.storageAdapter.clear();
    }
  }
}
