import { isNativeApp } from './mobileApp';

const ensureApiSuffix = (url: string) => {
  const normalized = url.replace(/\/$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
};

export const buildApiBaseUrl = () => {
  const envApiUrl = import.meta.env.VITE_API_URL;

  if (isNativeApp()) {
    const nativeApiUrl = import.meta.env.VITE_NATIVE_API_URL || envApiUrl || 'https://www.byblosafrica.site/api';
    return ensureApiSuffix(nativeApiUrl);
  }

  // In web browsers (dev & production), relative '/api' routes through the same-origin reverse proxy
  if (!envApiUrl || envApiUrl === '/api' || envApiUrl.startsWith('/')) {
    return '/api';
  }

  return ensureApiSuffix(envApiUrl);
};
