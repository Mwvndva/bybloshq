import { StorageAdapter } from './types';
import { storage as capacitorStorage } from '../storage';
import { isNativeApp } from '../mobileApp';

export class NativeStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return capacitorStorage.get(key);
  }
  async setItem(key: string, value: string): Promise<void> {
    await capacitorStorage.set(key, value);
  }
  async removeItem(key: string): Promise<void> {
    await capacitorStorage.remove(key);
  }
  async clear(): Promise<void> {
    await capacitorStorage.clear();
  }
}

export class WebLocalStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[WebLocalStorageAdapter] Failed to set item:', e);
    }
  }
  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[WebLocalStorageAdapter] Failed to remove item:', e);
    }
  }
  async clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('[WebLocalStorageAdapter] Failed to clear:', e);
    }
  }
}

export class WebSessionStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
  async setItem(key: string, value: string): Promise<void> {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      console.warn('[WebSessionStorageAdapter] Failed to set item:', e);
    }
  }
  async removeItem(key: string): Promise<void> {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      console.warn('[WebSessionStorageAdapter] Failed to remove item:', e);
    }
  }
  async clear(): Promise<void> {
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn('[WebSessionStorageAdapter] Failed to clear:', e);
    }
  }
}

export const createDefaultStorageAdapter = (): StorageAdapter => {
  if (isNativeApp()) {
    return new NativeStorageAdapter();
  }
  return new WebLocalStorageAdapter();
};
