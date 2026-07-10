import { PushNotifications, type Token } from '@capacitor/push-notifications';
import type { AxiosRequestConfig } from 'axios';
import apiClient from '@/lib/apiClient';
import { getNativePlatform, getStableDeviceId, isNativeApp } from '@/lib/mobileApp';
import type { UserRole } from '@/features/auth/types/authTypes';

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

let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000; // 10 seconds

function ensurePushListeners() {
  if (listenersReady) return;
  listenersReady = true;

  PushNotifications.addListener('registration', async (token: Token) => {
    if (!pendingRole || !token.value) return;
    retryCount = 0; // Reset retry count on successful registration
    await persistDeviceToken(token.value, pendingRole, pendingRequestConfig);
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.warn('[MobileNotifications] Push registration failed', error);

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      const nextDelay = RETRY_DELAY_MS * Math.pow(2, retryCount - 1); // 10s, 20s, 40s
      console.log(`[MobileNotifications] Retrying registration in ${nextDelay / 1000}s (Attempt ${retryCount}/${MAX_RETRIES})...`);
      setTimeout(() => {
        if (pendingRole) {
          PushNotifications.register().catch((err) => {
            console.error('[MobileNotifications] Failed to retry register', err);
          });
        }
      }, nextDelay);
    }
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


