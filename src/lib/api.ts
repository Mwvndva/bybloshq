import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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
const API_BASE_URL = normalizeApiUrl(import.meta.env.VITE_API_URL || 'http://localhost:3002');

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true, // Important for cookies
});

// Log the API configuration for debugging
console.log('API Configuration:', {
  baseURL: API_BASE_URL,
  env: import.meta.env.MODE,
  envVars: {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_BASE_URL: import.meta.env.VITE_BASE_URL,
  },
});

// Helper function to get token from localStorage
const getToken = () => {
  return localStorage.getItem('organizerToken');
};

// Add a request interceptor to include the token in requests (for backward compatibility)
api.interceptors.request.use(
  (config) => {
    // Skip adding token for auth endpoints when using cookies
    const authEndpoints = ['/organizers/login', '/organizers/register', '/organizers/forgot-password', '/organizers/reset-password/'];
    const isAuthEndpoint = authEndpoints.some(endpoint => config.url?.includes(endpoint));
    
    // For non-auth endpoints, try to get token from localStorage as fallback
    // but prioritize cookies (withCredentials: true handles this automatically)
    if (!isAuthEndpoint) {
      const token = getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // If it's a 401 error, clear auth state and redirect to login
    if (error.response?.status === 401) {
      // Clear localStorage (for backward compatibility)
      localStorage.removeItem('organizerToken');
      delete api.defaults.headers.common['Authorization'];
      
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/organizer/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// Helper function to handle API errors consistently
const handleApiError = (error) => {
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

// Export a function to set the auth token
export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('organizerToken', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('organizerToken');
    delete api.defaults.headers.common['Authorization'];
  }
};

// Export a function to check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('organizerToken');
};

// Export a function to log out
export const logout = () => {
  localStorage.removeItem('organizerToken');
  delete api.defaults.headers.common['Authorization'];
  // Redirect to login page
  window.location.href = '/organizer/login';
};

// Export a function to get the current user
// Define the organizer type
interface Organizer {
  id: string;
  email: string;
  name: string;
  // Add other organizer properties as needed
}

// Define the API response type
interface ApiResponse<T> {
  data: T;
  // Add other common response fields if they exist
  // e.g., status: string;
  //       message?: string;
}

interface OrganizerResponse {
  organizer: Organizer;
}

export const getCurrentUser = async (): Promise<Organizer> => {
  try {
    const response = await api.get<ApiResponse<OrganizerResponse>>('/organizers/me');
    return response.data.data.organizer;
  } catch (error: any) {
    // If not authenticated, clear the token
    if (error?.response?.status === 401) {
      setAuthToken(null);
    }
    throw error;
  }
};

export default api;
