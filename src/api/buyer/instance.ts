import apiClient from '@/lib/apiClient';

export const buyerApiInstance = apiClient;

export interface ApiError {
  message: string;
  response?: {
    data?: {
      message?: string;
      error?: string;
    };
    status?: number;
  };
  config?: import('axios').AxiosRequestConfig;
  code?: string;
  request?: unknown;
}


