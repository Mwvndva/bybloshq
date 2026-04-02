import axios from 'axios';
import { toast } from 'sonner';
import { authStateManager } from './authState';

// Determine Base URL
// Priority: VITE_API_URL -> localhost logic
const isDevelopment = import.meta.env.DEV;
const envApiUrl = import.meta.env.VITE_API_URL;

let baseURL = '';
if (isDevelopment && !envApiUrl) {
    baseURL = '/api'; // Use Vite proxy
} else {
    baseURL = (envApiUrl || '/api').replace(/\/$/, '');
    if (!baseURL.endsWith('/api')) {
        baseURL += '/api';
    }
}

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

/**
 * Fetch a fresh CSRF token from the backend
 */
export const getFreshCsrfToken = async () => {
    try {
        const response = await axios.get(`${baseURL}/public/csrf-token`, { withCredentials: true });
        csrfTokenCache = (response as any).data?.data?.csrfToken || null;
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
};

/**
 * Get current cached token
 */
export const getCachedCsrfToken = () => csrfTokenCache;

apiClient.interceptors.request.use(
    (config: any) => {
        // Attach CSRF token to non-GET requests
        if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
            // If we have a token, use it
            if (csrfTokenCache) {
                config.headers['X-CSRF-Token'] = csrfTokenCache;
                return config;
            }

            // If we don't have a token, fetch one and then proceed
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
const handleUnauthorized = (error: any) => {
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

    const roles = ['buyer', 'seller', 'organizer', 'admin'];
    const hadActiveSession = roles.some(role =>
        localStorage.getItem(`${role}SessionActive`) === 'true'
    );

    if (!isAuthCheck && !isPaymentSuccessPage && hadActiveSession) {
        toast.error('Session Expired', {
            description: 'Please log in again to continue.',
            duration: 4000,
        });

        roles.forEach(role => {
            localStorage.removeItem(`${role}SessionActive`);
        });

        const redirectPath = getLoginRedirectPath(url);

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
            handleUnauthorized(error);
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
