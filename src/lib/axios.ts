import axios from 'axios';

// Get the API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Create a basic axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to clean up URLs
apiClient.interceptors.request.use((config) => {
  // If the URL already starts with http, leave it as is
  if (config.url?.startsWith('http')) {
    return config;
  }

  // Remove any leading slashes to prevent double slashes
  if (config.url) {
    config.url = config.url.replace(/^\/+/, '');

    // Remove 'api/' from the beginning of the URL if it exists
    // since we're already including it in the baseURL
    if (config.url.startsWith('api/')) {
      config.url = config.url.replace(/^api\//, '');
    }
  }

  return config;
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token here if needed
    // const token = localStorage.getItem('authToken');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error: any) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response: any) => {
    return response.data;
  },
  (error: any) => {
    if (error.response) {
      const { status, data } = error.response;

      if (status === 401) {
        console.error('Unauthorized access - please login again');
      } else if (status === 403) {
        console.error('You do not have permission to perform this action');
      } else if (status === 404) {
        console.error('The requested resource was not found');
      } else if (status >= 500) {
        console.error('Server error - please try again later');
      }

      return Promise.reject(data?.message || 'An error occurred');
    } else if (error.request) {
      console.error('No response received from server. Please check your connection.');
      return Promise.reject('Network error - please check your connection');
    } else {
      console.error('Request error:', error.message);
      return Promise.reject(error.message || 'An unknown error occurred');
    }
  }
);

// Helper functions for making API requests
export const apiRequest = {
  get: <T>(url: string, config?: any) => apiClient.get<T>(url, config).then(res => res as unknown as T),
  post: <T>(url: string, data?: any, config?: any) => apiClient.post<T>(url, data, config).then(res => res as unknown as T),
  put: <T>(url: string, data?: any, config?: any) => apiClient.put<T>(url, data, config).then(res => res as unknown as T),
  delete: <T>(url: string, config?: any) => apiClient.delete<T>(url, config).then(res => res as unknown as T),
  patch: <T>(url: string, data?: any, config?: any) => apiClient.patch<T>(url, data, config).then(res => res as unknown as T),
};

export default apiClient;
