import apiClient from '@/lib/apiClient';
import { registerNativePushNotifications, unregisterNativePushNotifications } from '@/lib/mobileNotifications';

const LOGISTICS_TOKEN_KEY = 'mzigoLogisticsToken';
const LOGISTICS_PARTNER_KEY = 'mzigoLogisticsPartner';

export interface LogisticsPartner {
  id: number;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
}

export function getLogisticsToken() {
  return localStorage.getItem(LOGISTICS_TOKEN_KEY);
}

export function getStoredLogisticsPartner(): LogisticsPartner | null {
  const raw = localStorage.getItem(LOGISTICS_PARTNER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LogisticsPartner;
  } catch {
    return null;
  }
}

export function logisticsHeaders() {
  const token = getLogisticsToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function clearLogisticsSession() {
  void unregisterNativePushNotifications('logistics', { headers: logisticsHeaders() }).catch(() => undefined);
  localStorage.removeItem(LOGISTICS_TOKEN_KEY);
  localStorage.removeItem(LOGISTICS_PARTNER_KEY);
}

function setLogisticsSession(token: string, partner: LogisticsPartner) {
  localStorage.setItem(LOGISTICS_TOKEN_KEY, token);
  localStorage.setItem(LOGISTICS_PARTNER_KEY, JSON.stringify(partner));
}

export async function loginLogisticsPartner(email: string, password: string) {
  const response = await apiClient.post('/logistics/login', { email, password });
  const data = response.data?.data;
  if (!data?.token || !data?.partner) {
    throw new Error('Logistics login response was incomplete');
  }

  setLogisticsSession(data.token, data.partner);
  void registerNativePushNotifications('logistics', { headers: logisticsHeaders() });
  return data as { token: string; partner: LogisticsPartner };
}


