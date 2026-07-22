import axios from 'axios';
import { toast } from 'sonner';
import { authStateManager } from './authState';
import { buildApiBaseUrl } from './apiBaseUrl';
import { storage } from './storage';
import { isNativeApp } from './mobileApp';

const baseURL = buildApiBaseUrl();

// Log API configuration in development

const apiClient = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    withCredentials: true, // Critical for HttpOnly cookies
    timeout: 30000, // 30 second timeout
});

// Request Interceptor: Logging & CSRF
let csrfTokenCache: string | null = null;
let lastFetchedAt: number = 0;
const CSRF_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch a fresh CSRF token from the backend
 */
export const getFreshCsrfToken = async () => {
    try {
        const response = await axios.get(`${baseURL}/public/csrf-token`, { withCredentials: true });
        csrfTokenCache = (response as import('axios').AxiosResponse<{ data?: { csrfToken?: string } }>).data?.data?.csrfToken || null;
        lastFetchedAt = Date.now();
        return csrfTokenCache;
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
        return null;
    }
};

/**
 * Manual override for CSRF token (used by other instances)
 */
export const setCachedCsrfToken = (token: string | null) => {
    csrfTokenCache = token;
    if (token) lastFetchedAt = Date.now();
};

/**
 * Get current cached token
 */
export const getCachedCsrfToken = () => csrfTokenCache;

apiClient.interceptors.request.use(
    async (config: import('axios').InternalAxiosRequestConfig) => {
        const url = config.url || '';
        let token = null;
        if (url.includes('/sellers')) token = await storage.get('sellerToken');
        else if (url.includes('/creators')) token = await storage.get('creatorToken');
        else if (url.includes('/admin')) token = await storage.get('adminToken');
        else if (url.includes('/buyers')) token = await storage.get('buyerToken');
        else if (url.includes('/logistics') || url.includes('/mzigo')) { try { token = localStorage.getItem('mzigoLogisticsToken'); } catch { token = null; } }
        
        if (!token && !(url.includes('/logistics') || url.includes('/mzigo'))) {
            // Generic URL with no role segment: use the token of the account that
            // is actually signed in (the recorded active role) rather than the
            // first token found in a fixed priority order, which could belong to a
            // different, leftover account and leak that user's data.
            const activeRole = await storage.get('activeRole');
            if (activeRole) {
                token = await storage.get(`${activeRole}Token`);
            }
            if (!token) {
                for (const r of ['buyer', 'seller', 'creator', 'admin']) {
                    token = await storage.get(`${r}Token`);
                    if (token) break;
                }
            }
        }

        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        // Attach CSRF token to non-GET requests
        if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
            // FIX (Task 11): Use cached CSRF token if it's not stale (10-minute TTL)
            const isFresh = csrfTokenCache && (Date.now() - lastFetchedAt < CSRF_TTL);

            if (isFresh) {
                config.headers['X-CSRF-Token'] = csrfTokenCache;
                return config;
            }

            // If we don't have a token or it's stale, fetch one and then proceed
            return getFreshCsrfToken().then((token) => {
                if (token) {
                    config.headers['X-CSRF-Token'] = token;
                }
                return config;
            });
        }

        return config;
    },
    (error) => {
        throw error;
    }
);

// Response Interceptor: Global Error Handling
/**
 * Get the login path based on the error URL
 */
const getLoginRedirectPath = (url: string): string => {
    const redirectMap: Record<string, string> = {
        '/buyers': '/buyer/login',
        '/sellers': '/seller/login',
        '/creators': '/creator/login',
        '/organizers': '/organizer/login',
        '/admin': '/admin/login',
    };

    return Object.entries(redirectMap).find(([key]) =>
        url.includes(key)
    )?.[1] || '/buyer/login';
};

/**
 * Handle 401 Unauthorized errors
 */
const handleUnauthorized = async (error: import('axios').AxiosError) => {
    const url = error.config?.url || 'unknown';
    const currentPath = globalThis.location.pathname;

    const isAuthCheck = url.includes('/profile') ||
        url.includes('/me') ||
        url.includes('/check-auth');

    const isPaymentSuccessPage = currentPath.includes('/payment/success') ||
        currentPath.includes('/checkout/success');

    if (authStateManager.isCurrentlyRehydrating()) {
        authStateManager.queueError(error);
        throw error;
    }

    const roles = ['buyer', 'seller', 'creator', 'organizer', 'admin'];
    let hadActiveSession = false;
    for (const role of roles) {
        if (await storage.get(`${role}SessionActive`) === 'true') {
            hadActiveSession = true;
            break;
        }
    }

    if (!isAuthCheck && !isPaymentSuccessPage && hadActiveSession) {
        toast.error('Session Expired', {
            description: 'Please log in again to continue.',
            duration: 4000,
        });

        roles.forEach(role => {
            localStorage.removeItem(`${role}SessionActive`);
        });
        await Promise.all(roles.map(role => storage.remove(`${role}SessionActive`)));

        const redirectPath = getLoginRedirectPath(url);

        const isPublicRoute = currentPath === '/' ||
            ['/login', '/register', '/forgot-password', '/reset-password', '/marketing'].some(p => currentPath.includes(p));

        if (isPublicRoute) {
            console.log(`[Auth] 401 on public route ${currentPath} - ignoring redirect`);
            return;
        }

        if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
            sessionStorage.setItem('redirectAfterLogin', currentPath);
        }

        if (!currentPath.includes('/login')) {
            setTimeout(() => {
                globalThis.location.href = redirectPath;
            }, 1000);
        }
    }
};

/**
 * Map a request URL to the role whose token it uses, so we know which stored
 * refresh token to spend when that request comes back 401.
 * Falls back to the persisted activeRole for generic endpoints (e.g. /orders,
 * /products) that have no role segment in their path.
 */
const roleFromRequestUrl = async (url: string): Promise<'buyer' | 'seller' | 'creator' | 'admin' | null> => {
    if (url.includes('/sellers')) return 'seller';
    if (url.includes('/creators')) return 'creator';
    if (url.includes('/admin')) return 'admin';
    if (url.includes('/buyers')) return 'buyer';
    // Generic URL — use whatever role is currently active
    const active = await storage.get('activeRole');
    if (active === 'buyer' || active === 'seller' || active === 'creator' || active === 'admin') {
        return active;
    }
    return null;
};

/**
 * Silent session renewal for BOTH web and native.
 *
 * On native (Capacitor): access token is a Bearer token stored in Preferences,
 * refresh token also stored in Preferences — both written at login.
 *
 * On web: access token is an HttpOnly cookie (handled by the browser), but the
 * refresh token is written to localStorage at login so we can exchange it here
 * without forcing the user to re-enter their password.
 *
 * When an authenticated request returns 401 we POST to /auth/refresh-token once,
 * store the new tokens, patch the Authorization header, and replay the original
 * request. If the refresh itself fails the refresh token is dropped and the user
 * is sent to the login screen.
 *
 * Returns the retried response on success, or null to fall through to normal
 * 401 handling.
 */
const tryRefreshAndRetry = async (error: import('axios').AxiosError) => {
    const config = error.config as (import('axios').InternalAxiosRequestConfig & { _refreshRetried?: boolean }) | undefined;
    if (!config) return null;

    const url = config.url || '';
    // Never loop on the refresh call itself, and don't try to refresh a failed
    // login/logout (there is no valid session yet, or it is being torn down).
    if (config._refreshRetried) return null;
    if (url.includes('/auth/refresh-token') || url.includes('/login') || url.includes('/logout')) return null;

    const role = await roleFromRequestUrl(url);
    if (!role) return null;

    const refreshToken = await storage.get(`${role}RefreshToken`);
    if (!refreshToken) return null;

    try {
        // Use a bare axios call (not apiClient) so this cannot recurse through the
        // response interceptor. CSRF still applies, so send a fresh double-submit token.
        let csrf = getCachedCsrfToken();
        if (!csrf) csrf = await getFreshCsrfToken();
        const resp = await axios.post(
            `${baseURL}/auth/refresh-token`,
            { refreshToken },
            { withCredentials: true, headers: csrf ? { 'X-CSRF-Token': csrf } : {} }
        );

        const data = (resp.data as { data?: { accessToken?: string; refreshToken?: string } })?.data;
        const newAccess = data?.accessToken;
        if (!newAccess) return null;

        await storage.set(`${role}Token`, newAccess);
        if (data?.refreshToken) await storage.set(`${role}RefreshToken`, data.refreshToken);

        config._refreshRetried = true;
        config.headers = config.headers || {};
        (config.headers as Record<string, string>)['Authorization'] = `Bearer ${newAccess}`;
        return await apiClient(config);
    } catch {
        // Refresh token expired or invalid — drop it so we stop retrying and let the
        // user log in again cleanly.
        await storage.remove(`${role}RefreshToken`);
        return null;
    }
};

// Response Interceptor: Global Error Handling
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const status = error.response?.status;
        const message = (error.response?.data as { message?: string })?.message || error.message || 'An error occurred';
        const config = error.config;

        // Handle 403 Forbidden - Potential CSRF Mismatch
        if (status === 403 && message.includes('CSRF mismatch') && !config._retry) {
            config._retry = true;
            console.warn('[CSRF] Mismatch detected. Refreshing token and retrying...');

            const newToken = await getFreshCsrfToken();
            if (newToken) {
                config.headers['X-CSRF-Token'] = newToken;
                return apiClient(config);
            }
        }

        // Handle Status Codes
        if (status === 401) {
            const retried = await tryRefreshAndRetry(error);
            if (retried) return retried;
            await handleUnauthorized(error);
        } else if (status && status >= 500) {
            toast.error('Server Error', {
                description: 'Something went wrong on our end. Please try again later.',
                duration: 5000,
            });
        } else if (status === 403) {
            toast.error('Access Denied', {
                description: message || 'You do not have permission to perform this action.',
                duration: 4000,
            });
        } else if (status === 429) {
            toast.error('Too Many Requests', {
                description: 'Please slow down and try again in a moment.',
                duration: 4000,
            });
        } else if (!status) {
            toast.error('Network Error', {
                description: 'Please check your internet connection and try again.',
                duration: 5000,
            });
        }

        throw error;
    }
);

export default apiClient;


