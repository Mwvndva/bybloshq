import apiClient from '@/infrastructure/http/apiClient';
import { registerNativePushNotifications, unregisterNativePushNotifications } from '@/features/notifications/utils/mobileNotifications';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { storage } from '@/infrastructure/storage/storage';

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
  return sessionStorage.getItem(LOGISTICS_ACTIVE_KEY) === 'true' || localStorage.getItem(LOGISTICS_ACTIVE_KEY) === 'true' || localStorage.getItem('logisticsSessionActive') === 'true';
}

// Deprecated token getter maintained for backwards compatibility
export function getLogisticsToken(): string | null {
  return isLogisticsSessionActive() ? 'cookie-session' : null;
}

export function getStoredLogisticsPartner(): LogisticsPartner | null {
  const raw = sessionStorage.getItem(LOGISTICS_PARTNER_KEY) || localStorage.getItem(LOGISTICS_PARTNER_KEY);
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
  localStorage.setItem(LOGISTICS_ACTIVE_KEY, 'true');
  localStorage.setItem(LOGISTICS_PARTNER_KEY, JSON.stringify(partner));
}



