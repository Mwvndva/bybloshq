import axios from 'axios';
import { toast } from 'sonner';
import { authStateManager } from './authState';
import { buildApiBaseUrl } from './apiBaseUrl';
import { storage } from './storage';

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
        csrfTokenCache = (response as any).data?.data?.csrfToken || null;
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
    async (config: any) => {
        const url = config.url || '';
        let token = null;
        if (url.includes('/sellers')) token = await storage.get('sellerToken');
        else if (url.includes('/creators')) token = await storage.get('creatorToken');
        else if (url.includes('/admin')) token = await storage.get('adminToken');
        else if (url.includes('/buyers')) token = await storage.get('buyerToken');
        
        if (!token) {
            for (const r of ['buyer', 'seller', 'creator', 'admin']) {
                token = await storage.get(`${r}Token`);
                if (token) break;
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
const handleUnauthorized = async (error: any) => {
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

// Response Interceptor: Global Error Handling
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const status = error.response?.status;
        const message = (error.response?.data as any)?.message || error.message || 'An error occurred';
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
