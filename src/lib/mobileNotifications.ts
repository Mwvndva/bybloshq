import { PushNotifications, type Token } from '@capacitor/push-notifications';
import type { AxiosRequestConfig } from 'axios';
import apiClient from '@/lib/apiClient';
import { getNativePlatform, getStableDeviceId, isNativeApp } from '@/lib/mobileApp';
import type { UserRole } from '@/contexts/auth/authTypes';

type AppNotificationRole = UserRole | 'logistics';

const TOKEN_STORAGE_KEY = 'byblosNativePushToken';
const REGISTRATION_STORAGE_KEY = 'byblosNativePushRegistration';

let listenersReady = false;
let pendingRole: AppNotificationRole | null = null;
let pendingRequestConfig: AxiosRequestConfig | undefined;
let registrationPromise: Promise<void> | null = null;

function appVersion() {
  return String(import.meta.env.VITE_APP_VERSION || import.meta.env.VITE_VERSION || '0.0.0');
}

function notificationEndpoint(role: AppNotificationRole) {
  return role === 'logistics' ? '/notifications/logistics/devices' : '/notifications/devices';
}

async function persistDeviceToken(
  token: string,
  role: AppNotificationRole,
  requestConfig?: AxiosRequestConfig
) {
  await apiClient.post(notificationEndpoint(role), {
    platform: getNativePlatform(),
    token,
    deviceId: getStableDeviceId(),
    appVersion: appVersion(),
  }, requestConfig);

  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify({
    role,
    platform: getNativePlatform(),
    registeredAt: new Date().toISOString(),
  }));
}

function ensurePushListeners() {
  if (listenersReady) return;
  listenersReady = true;

  PushNotifications.addListener('registration', async (token: Token) => {
    if (!pendingRole || !token.value) return;
    await persistDeviceToken(token.value, pendingRole, pendingRequestConfig);
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.warn('[MobileNotifications] Push registration failed', error);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
    const targetPath = event.notification.data?.path || event.notification.data?.url;
    if (typeof targetPath === 'string' && targetPath.startsWith('/')) {
      window.location.assign(targetPath);
    }
  });
}

export async function registerNativePushNotifications(
  role: AppNotificationRole,
  requestConfig?: AxiosRequestConfig
) {
  if (!isNativeApp()) return;
  if (registrationPromise) return registrationPromise;

  pendingRole = role;
  pendingRequestConfig = requestConfig;
  ensurePushListeners();

  registrationPromise = (async () => {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return;

    await PushNotifications.register();
  })().finally(() => {
    registrationPromise = null;
  });

  return registrationPromise;
}

export async function unregisterNativePushNotifications(
  role?: AppNotificationRole,
  requestConfig?: AxiosRequestConfig
) {
  if (!isNativeApp()) return;

  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const registration = localStorage.getItem(REGISTRATION_STORAGE_KEY);
  const registeredRole = role || (registration ? JSON.parse(registration).role : undefined);

  if (token && registeredRole) {
    await apiClient.delete(notificationEndpoint(registeredRole), {
      ...requestConfig,
      data: { token },
    });
  }

  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REGISTRATION_STORAGE_KEY);
}
