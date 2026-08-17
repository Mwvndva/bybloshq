import apiClient from '@/lib/apiClient';
import { registerNativePushNotifications, unregisterNativePushNotifications } from '@/lib/mobileNotifications';
import { isNativeApp } from '@/lib/mobileApp';
import { storage } from '@/lib/storage';

const LOGISTICS_PARTNER_KEY = 'mzigoLogisticsPartner';
const LOGISTICS_ACTIVE_KEY = 'mzigoLogisticsActive';

export interface LogisticsPartner {
  id: number;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
}

export function isLogisticsSessionActive(): boolean {
  return sessionStorage.getItem(LOGISTICS_ACTIVE_KEY) === 'true';
}

// Deprecated token getter maintained for backwards compatibility
export function getLogisticsToken(): string | null {
  return isLogisticsSessionActive() ? 'cookie-session' : null;
}

export function getStoredLogisticsPartner(): LogisticsPartner | null {
  const raw = sessionStorage.getItem(LOGISTICS_PARTNER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LogisticsPartner;
  } catch {
    return null;
  }
}

export function logisticsHeaders() {
  return {};
}

export async function clearLogisticsSession() {
  void unregisterNativePushNotifications('logistics', { headers: logisticsHeaders() }).catch(() => undefined);
  sessionStorage.removeItem(LOGISTICS_ACTIVE_KEY);
  sessionStorage.removeItem(LOGISTICS_PARTNER_KEY);
  localStorage.removeItem('mzigoLogisticsToken');
  localStorage.removeItem('mzigoLogisticsPartner');
  if (isNativeApp()) {
    await storage.remove('logisticsToken');
    await storage.remove('logisticsRefreshToken');
  }
  try {
    await apiClient.post('/logistics/logout');
  } catch {
    /* ignore network errors on logout */
  }
}

function setLogisticsSession(partner: LogisticsPartner) {
  sessionStorage.setItem(LOGISTICS_ACTIVE_KEY, 'true');
  sessionStorage.setItem(LOGISTICS_PARTNER_KEY, JSON.stringify(partner));
  // Clean up legacy plaintext localStorage entries if present
  localStorage.removeItem('mzigoLogisticsToken');
  localStorage.removeItem('mzigoLogisticsPartner');
}

export async function loginLogisticsPartner(email: string, password: string) {
  const response = await apiClient.post('/logistics/login', { email, password });
  const data = response.data?.data;
  if (!data?.partner) {
    throw new Error('Logistics login response was incomplete');
  }

  if (isNativeApp() && data?.token) {
    await storage.set('logisticsToken', data.token);
    const refreshToken = (data as { refreshToken?: string }).refreshToken;
    if (refreshToken) await storage.set('logisticsRefreshToken', refreshToken);
  }

  setLogisticsSession(data.partner);
  void registerNativePushNotifications('logistics', { headers: logisticsHeaders() });
  return data as { token?: string; partner: LogisticsPartner };
}



