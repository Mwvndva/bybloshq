import { buyerApiInstance, ApiError } from './instance';
import type { ApiOrder } from '@/shared/types';
import { storage } from '@/infrastructure/storage/storage';
import { getFreshCsrfToken } from '@/infrastructure/http/apiClient';
import { buildApiBaseUrl } from '@/infrastructure/http/apiBaseUrl';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function getOrders(): Promise<ApiOrder[]> {
  let responseBody: any = null;

  try {
    const response = await buyerApiInstance.get<any>('/orders/user');
    responseBody = response?.data !== undefined ? response.data : response;
    if (typeof responseBody === 'string' && responseBody.trim()) {
      try {
        responseBody = JSON.parse(responseBody);
      } catch {
        /* ignore json parse error */
      }
    }
  } catch {
    /* ignore Axios error for fetch fallback */
  }

  if (!responseBody || typeof responseBody !== 'object' || responseBody.status === 'error' || responseBody.status === 'fail') {
    try {
      const token = (await storage.get('buyerToken')) || localStorage.getItem('buyerToken');
      const csrfToken = await getFreshCsrfToken();
      const baseUrl = buildApiBaseUrl();
      const fetchRes = await fetch(`${baseUrl}/orders/user`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          'X-CSRF-Token': csrfToken || ''
        },
        credentials: 'include'
      });
      const textData = await fetchRes.text();
      if (textData && typeof textData === 'string') {
        try {
          responseBody = JSON.parse(textData);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore fetch fallback error */
    }
  }

  if (!responseBody || typeof responseBody !== 'object') {
    return [];
  }

  const rawOrders = Array.isArray(responseBody)
    ? responseBody
    : (Array.isArray(responseBody?.data)
        ? responseBody.data
        : (Array.isArray(responseBody?.data?.orders)
            ? responseBody.data.orders
            : (Array.isArray(responseBody?.orders)
                ? responseBody.orders
                : [])));

  return rawOrders.map((order: unknown) => {
    const o = (order && typeof order === 'object') ? (order as Record<string, unknown>) : {};
    return {
      ...o,
      items: o.items || [],
      status: typeof o.status === 'string' ? o.status.toUpperCase() : 'PENDING',
      paymentStatus: typeof o.paymentStatus === 'string' ? o.paymentStatus.toUpperCase() : 'PENDING'
    } as ApiOrder;
  });
}

export async function getOrder(orderId: string): Promise<ApiOrder> {
  try {
    const response = await buyerApiInstance.get<ApiResponse<ApiOrder>>(`/orders/${orderId}`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
}

export async function cancelOrder(orderId: string): Promise<{ success: boolean; message?: string }> {
  try {
    await buyerApiInstance.patch(`/orders/${orderId}/cancel`);
    return { success: true };
  } catch (error) {
    const err = error as ApiError;
    return {
      success: false,
      message: err.response?.data?.message || 'Failed to cancel order'
    };
  }
}

export async function confirmOrderReceipt(orderId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const idempotencyKey = `confirm-receipt-${orderId}`;

    await buyerApiInstance.patch(`/orders/${orderId}/confirm-receipt`, {}, {
      timeout: 30000,
      headers: {
        'Idempotency-Key': idempotencyKey
      }
    });

    return { success: true };
  } catch (error) {
    const err = error as ApiError;
    let errorMessage = 'Failed to confirm order receipt';

    if (err.code === 'ECONNABORTED') {
      errorMessage = 'Request timed out. Please check your internet connection and try again.';
    } else if (err.response) {
      errorMessage = err.response.data?.message || (err.response as { statusText?: string }).statusText || 'Server error occurred';
    } else if (err.request) {
      errorMessage = 'No response from server. Please try again later.';
    }

    throw new Error(errorMessage);
  }
}

export async function downloadDigitalProduct(orderId: string, productId: string, onProgress?: (percent: number) => void): Promise<void> {
  try {
    const response = await buyerApiInstance.get(`/orders/${orderId}/download/${productId}`, {
      responseType: 'blob',
      onDownloadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });

    const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
    const link = document.createElement('a');
    link.href = url;

    const contentDisposition = response.headers['content-disposition'];
    let filename = 'download.zip';
    if (contentDisposition) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    }

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();

    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    const err = error as ApiError;
    throw new Error(err.response?.data?.message || 'Failed to download digital product');
  }
}

export async function markOrderAsCollected(orderId: string): Promise<{ success: boolean; message?: string }> {
  try {
    await buyerApiInstance.post(`/buyers/orders/${orderId}/collected`);
    return { success: true };
  } catch (error) {
    const err = error as ApiError;
    return {
      success: false,
      message: err.response?.data?.message || 'Failed to mark order as collected'
    };
  }
}

