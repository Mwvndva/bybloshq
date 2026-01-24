import axios from 'axios';
import { toast } from 'sonner';

// Normalize the API URL to ensure it ends with /api
const normalizeApiUrl = (url: string): string => {
  // Remove trailing slashes
  let normalized = url.replace(/\/+$/, '');
  // Ensure it ends with /api
  if (!normalized.endsWith('/api')) {
    normalized = `${normalized}${normalized.endsWith('/') ? '' : '/'}api`;
  }
  return normalized;
};

// Get the base URL from environment variables
const API_BASE_URL = normalizeApiUrl(
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3002' : '')
);

// Create secure axios instance that prioritizes HTTP-only cookies
const secureApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true, // Critical for HTTP-only cookies
  // Don't send Authorization header by default - rely on cookies
});

// Add a response interceptor to handle authentication errors
secureApi.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // If it's a 401 error, redirect to login
    if (error.response?.status === 401) {
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/organizer/login';
      }
    }

    return Promise.reject(error);
  }
);

// Helper function to handle API errors consistently
const handleSecureApiError = (error) => {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    const { status, data } = error.response;
    const message = data?.message || 'An error occurred';

    // Show error toast for client-side errors (4xx) and server errors (5xx)
    if (status >= 400) {
      toast.error(message);
    }

    return Promise.reject({ message, status, data });
  } else if (error.request) {
    // The request was made but no response was received
    toast.error('No response from server. Please check your connection.');
    return Promise.reject({ message: 'No response from server' });
  } else {
    // Something happened in setting up the request that triggered an Error
    console.error('Request setup error:', error.message);
    toast.error('Failed to process request');
    return Promise.reject({ message: error.message });
  }
};

export default secureApi;
export { handleSecureApiError };
