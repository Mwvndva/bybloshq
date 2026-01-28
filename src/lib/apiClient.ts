import axios from 'axios';
import { toast } from 'sonner';

// Determine Base URL
// Priority: VITE_API_URL -> localhost logic
const isDevelopment = import.meta.env.DEV;
const envApiUrl = import.meta.env.VITE_API_URL;

let baseURL = '';
if (isDevelopment && !envApiUrl) {
    baseURL = '/api'; // Use Vite proxy
} else {
    baseURL = (envApiUrl || 'http://localhost:3002').replace(/\/$/, '');
    if (!baseURL.endsWith('/api')) {
        baseURL += '/api';
    }
}

// Log API configuration in development
if (isDevelopment) {
    console.log('🔧 [API Client] Configuration:', {
        baseURL,
        environment: import.meta.env.MODE,
        withCredentials: true
    });
}

const apiClient = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    withCredentials: true, // Critical for HttpOnly cookies
    timeout: 30000, // 30 second timeout
});

// Request Interceptor: Logging in development
apiClient.interceptors.request.use(
    (config) => {
        if (isDevelopment) {
            console.log(`📤 [API Request] ${config.method?.toUpperCase()} ${config.url}`);
        }
        return config;
    },
    (error) => {
        if (isDevelopment) {
            console.error('❌ [API Request Error]', error);
        }
        return Promise.reject(error);
    }
);

// Response Interceptor: Global Error Handling
apiClient.interceptors.response.use(
    (response) => {
        if (isDevelopment) {
            console.log(`📥 [API Response] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
        }
        return response;
    },
    (error) => {
        const status = error.response?.status;
        const message = (error.response?.data as any)?.message || error.message || 'An error occurred';
        const url = error.config?.url || 'unknown';

        if (isDevelopment) {
            console.error(`❌ [API Error] ${error.config?.method?.toUpperCase()} ${url} - ${status || 'Network Error'}`, {
                message,
                data: error.response?.data
            });
        }

        // Handle 401 Unauthorized - Session expired
        if (status === 401) {
            // Don't show toast or redirect for profile/auth check endpoints
            // This prevents redirect loops during initial auth checks
            const isAuthCheck = url.includes('/profile') ||
                url.includes('/me') ||
                url.includes('/check-auth');

            if (!isAuthCheck) {
                toast.error('Session Expired', {
                    description: 'Please log in again to continue.',
                    duration: 4000,
                });

                // Determine which login page to redirect to based on the URL
                const redirectMap: Record<string, string> = {
                    '/buyers': '/buyer/login',
                    '/sellers': '/seller/login',
                    '/organizers': '/organizer/login',
                    '/admin': '/admin/login',
                };

                const redirectPath = Object.entries(redirectMap).find(([key]) =>
                    url.includes(key)
                )?.[1] || '/buyer/login';

                // Only redirect if not already on a login page
                if (!window.location.pathname.includes('/login')) {
                    setTimeout(() => {
                        window.location.href = redirectPath;
                    }, 1000);
                }
            }
        }

        // Handle 500 Server Errors
        else if (status && status >= 500) {
            toast.error('Server Error', {
                description: 'Something went wrong on our end. Please try again later.',
                duration: 5000,
            });
        }

        // Handle 403 Forbidden
        else if (status === 403) {
            toast.error('Access Denied', {
                description: message || 'You do not have permission to perform this action.',
                duration: 4000,
            });
        }

        // Handle 429 Too Many Requests
        else if (status === 429) {
            toast.error('Too Many Requests', {
                description: 'Please slow down and try again in a moment.',
                duration: 4000,
            });
        }

        // Handle Network Errors
        else if (!status) {
            toast.error('Network Error', {
                description: 'Please check your internet connection and try again.',
                duration: 5000,
            });
        }

        return Promise.reject(error);
    }
);

export default apiClient;
