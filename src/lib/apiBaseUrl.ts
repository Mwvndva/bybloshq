import { isNativeApp } from './mobileApp';

const ensureApiSuffix = (url: string) => {
  const normalized = url.replace(/\/$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
};

export const buildApiBaseUrl = () => {
  const envApiUrl = import.meta.env.VITE_API_URL;

  if (isNativeApp()) {
    const nativeApiUrl = import.meta.env.VITE_NATIVE_API_URL || envApiUrl || 'https://byblosafrica.site';
    return ensureApiSuffix(nativeApiUrl);
  }

  if (typeof window !== 'undefined') {
    if (envApiUrl) {
      try {
        const parsed = new URL(envApiUrl, window.location.origin);
        // Align www vs non-www to match current window origin and avoid preflight 301 redirects
        if (
          parsed.hostname.replace(/^www\./, '') === window.location.hostname.replace(/^www\./, '')
        ) {
          return ensureApiSuffix(`${window.location.origin}${parsed.pathname}`);
        }
        return ensureApiSuffix(envApiUrl);
      } catch {
        return ensureApiSuffix(envApiUrl);
      }
    }
    return '/api';
  }

  if (import.meta.env.DEV && !envApiUrl) {
    return '/api';
  }

  return ensureApiSuffix(envApiUrl || '/api');
};
