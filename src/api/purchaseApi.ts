import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3002/api' : 'https://bybloshq-f1rz.onrender.com/api');

// Create axios instance with base config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || localStorage.getItem('sellerToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export interface PurchaseRequest {
  productId: string;
  quantity: number;
  shippingAddress: string;
  paymentMethod: string;
}

export interface PurchaseResponse {
  id: string;
  orderNumber: string;
  status: 'pending' | 'completed' | 'failed';
  message?: string;
}

export interface TicketValidationResponse {
  valid: boolean;
  status: 'valid' | 'not_found' | 'already_scanned';
  ticket?: {
    id: string;
    ticketNumber: string;
    eventName: string;
    customerName: string;
    scanned: boolean;
    scannedAt?: string;
  };
  message: string;
}

// Cache for in-flight requests to prevent duplicates
const requestCache = new Map<string, Promise<any>>();

export const purchaseApi: {
  purchaseProduct(purchaseData: PurchaseRequest): Promise<PurchaseResponse>;
  validateTicket(ticketNumber: string): Promise<TicketValidationResponse>;
  getPurchaseStatus(orderId: string): Promise<PurchaseResponse>;
} = {
  async purchaseProduct(purchaseData: PurchaseRequest): Promise<PurchaseResponse> {
    try {
      const response = await api.post<PurchaseResponse>('/purchases', purchaseData);
      // Ensure the response has the required fields
      if (!response.data.id || !response.data.orderNumber || !response.data.status) {
        throw new Error('Invalid response format from server');
      }
      return {
        id: response.data.id,
        orderNumber: response.data.orderNumber,
        status: response.data.status,
        message: response.data.message
      };
    } catch (error: any) {
      console.error('Purchase failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to complete purchase');
    }
  },

  async validateTicket(ticketNumber: string): Promise<TicketValidationResponse> {
    const cacheKey = `validate_${ticketNumber}`;
    
    // Return existing promise if there's already a request for this ticket
    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey)!;
    }
    
    const requestPromise = (async () => {
      try {
        // Use POST for validation since it modifies state (marks ticket as scanned)
        const response = await api.post<TicketValidationResponse>(
          `/tickets/validate/${encodeURIComponent(ticketNumber)}`,
          {}, // Empty body since we're just validating by ticket number
          {
            baseURL: API_URL,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        
        // Ensure the response has the required fields
        if (response.data.valid === undefined || !response.data.status || !response.data.message) {
          throw new Error('Invalid validation response format');
        }
        
        return {
          valid: response.data.valid,
          status: response.data.status,
          message: response.data.message,
          ticket: response.data.ticket
        };
      } catch (error: any) {
        console.error('Ticket validation failed:', error);
        const errorResponse: TicketValidationResponse = {
          valid: false,
          status: 'not_found',
          message: error.response?.data?.message || 'Failed to validate ticket',
          ticket: undefined // Explicitly set to undefined to match the type
        };
        return errorResponse;
      } finally {
        // Clean up the cache when the request completes
        requestCache.delete(cacheKey);
      }
    })();
    
    // Cache the request promise
    requestCache.set(cacheKey, requestPromise);
    
    return requestPromise;
  },

  async getPurchaseStatus(orderId: string): Promise<PurchaseResponse> {
    try {
      const response = await api.get<PurchaseResponse>(`/purchases/${orderId}`);
      
      // Ensure the response has the required fields
      if (!response.data.id || !response.data.orderNumber || !response.data.status) {
        throw new Error('Invalid purchase status response format');
      }
      
      return {
        id: response.data.id,
        orderNumber: response.data.orderNumber,
        status: response.data.status,
        message: response.data.message
      };
    } catch (error: any) {
      console.error('Failed to fetch purchase status:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch purchase status');
    }
  }
};
