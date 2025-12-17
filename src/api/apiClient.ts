// Simple API client using fetch
console.log('Environment variables:', import.meta.env);
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3002/api' : 'https://bybloshq-f1rz.onrender.com/api');

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string[]>;
}

async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    const error: ApiError = {
      message: data.message || 'An error occurred',
      status: response.status,
      errors: data.errors,
    };
    throw error;
  }

  return {
    data: data.data || data,
    message: data.message,
    success: data.success !== false, // Default to true if not specified
  };
}

export const apiRequest = async <T>(
  config: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    data?: any;
    headers?: Record<string, string>;
  }
): Promise<ApiResponse<T>> => {
  const { url, method = 'GET', data, headers = {} } = config;
  
  // Get auth token from localStorage
  const token = localStorage.getItem('buyer_token');
  
  // Set up request headers
  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };
  
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  // Build request options
  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
    credentials: 'include', // Include cookies for cross-origin requests
  };
  
  // Add request body for non-GET requests
  if (data && method !== 'GET') {
    requestOptions.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, requestOptions);
    return await handleResponse<T>(response);
  } catch (error) {
    if (error instanceof Error) {
      // Handle network errors
      throw {
        message: error.message || 'Network error occurred',
      } as ApiError;
    }
    // Re-throw the error if it's already an ApiError
    throw error;
  }
};
