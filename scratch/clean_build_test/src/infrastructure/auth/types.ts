import { Capacitor } from '@capacitor/core';

export type AuthPlatform = 'web' | 'android';
export type AppRole = 'buyer' | 'seller' | 'creator' | 'logistics' | 'admin' | 'marketing';

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface AuthStrategy {
  readonly platform: AuthPlatform;
  getAuthHeaders(role?: AppRole): Promise<Record<string, string>>;
  getCsrfHeader(): Promise<Record<string, string>>;
  handleUnauthorized(role?: AppRole): Promise<boolean>;
  clearSession(role?: AppRole): Promise<void>;
}
