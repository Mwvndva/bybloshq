import { isNativeApp } from './mobileApp';

const ensureApiSuffix = (url: string) => {
  const normalized = url.replace(/\/$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
};

export const buildApiBaseUrl = () => {
  const envApiUrl = import.meta.env.VITE_API_URL;

  if (isNativeApp()) {
    const nativeApiUrl = import.meta.env.VITE_NATIVE_API_URL || envApiUrl || 'https://byblos-backend-fky5.onrender.com/api';
    return ensureApiSuffix(nativeApiUrl);
  }

  // In web browsers (dev & production), relative '/api' routes through the same-origin reverse proxy
  if (!envApiUrl || envApiUrl === '/api' || envApiUrl.startsWith('/')) {
    return '/api';
  }

  // Defensive check: If web build is configured with an absolute cross-origin URL
  if (typeof window !== 'undefined' && (envApiUrl.includes('onrender.com') || /^https?:\/\//i.test(envApiUrl))) {
    console.error(
      `[CRITICAL CONFIG WARNING] VITE_API_URL is set to an absolute cross-origin URL: "${envApiUrl}". ` +
      `In web environments, bypassing the same-origin reverse proxy ('/api') breaks CSRF validation and SameSite cookie synchronization in modern browsers.`
    );
  }

  return ensureApiSuffix(envApiUrl);
};
