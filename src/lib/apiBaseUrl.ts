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

  // Web application environment:
  if (typeof window !== 'undefined') {
    if (!envApiUrl) {
      return '/api';
    }

    try {
      const url = new URL(envApiUrl, window.location.origin);
      const envHost = url.hostname.replace(/^www\./, '');
      const winHost = window.location.hostname.replace(/^www\./, '');

      // If VITE_API_URL points to the same domain (byblosafrica.site vs www.byblosafrica.site),
      // match current window.location.origin so browser requests do not trigger a 301/302 preflight redirect.
      if (envHost === winHost) {
        const basePath = (url.pathname === '/' || !url.pathname) ? '/api' : url.pathname;
        return ensureApiSuffix(`${window.location.origin}${basePath}`);
      }

      return ensureApiSuffix(envApiUrl);
    } catch {
      return ensureApiSuffix(envApiUrl);
    }
  }

  if (import.meta.env.DEV && !envApiUrl) {
    return '/api';
  }

  return ensureApiSuffix(envApiUrl || '/api');
};
