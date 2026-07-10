import { isNativeApp } from './mobileApp';

const ensureApiSuffix = (url: string) => {
  const normalized = url.replace(/\/$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
};

export const buildApiBaseUrl = () => {
  const envApiUrl = import.meta.env.VITE_API_URL;

  if (isNativeApp()) {
    const nativeApiUrl = import.meta.env.VITE_NATIVE_API_URL || envApiUrl || 'https://bybloshq.space';
    return ensureApiSuffix(nativeApiUrl);
  }

  if (import.meta.env.DEV && !envApiUrl) {
    return '/api';
  }

  return ensureApiSuffix(envApiUrl || '/api');
};


