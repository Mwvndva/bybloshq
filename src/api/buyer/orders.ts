import { buyerApiInstance, ApiError } from './instance';
import type { ApiOrder } from '@/types/api/order';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function getOrders(): Promise<ApiOrder[]> {
  try {
    const response = await buyerApiInstance.get<ApiResponse<unknown[]>>('/orders/user');

    const transformedOrders = response.data.data.map((order: unknown) => {
      const o = order as Record<string, unknown>;
      return {
        ...o,
        items: o.items || [],
        status: typeof o.status === 'string' ? o.status.toUpperCase() : 'PENDING',
        paymentStatus: typeof o.paymentStatus === 'string' ? o.paymentStatus.toUpperCase() : 'PENDING'
      } as ApiOrder;
    });

    if (import.meta.env.DEV) {
      console.log('=== TRANSFORMED ORDERS ===', transformedOrders.length);
    }

    return transformedOrders;
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
}

export async function getOrder(orderId: string): Promise<ApiOrder> {
  try {
    const response = await buyerApiInstance.get<ApiResponse<ApiOrder>>(`/orders/${orderId}`);
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching order ${orderId}:`, error);
    throw error;
  }
}

export async function cancelOrder(orderId: string): Promise<{ success: boolean; message?: string }> {
  try {
    await buyerApiInstance.patch(`/orders/${orderId}/cancel`);
    return { success: true };
  } catch (error) {
    const err = error as ApiError;
    console.error(`Error cancelling order ${orderId}:`, err);
    return {
      success: false,
      message: err.response?.data?.message || 'Failed to cancel order'
    };
  }
}

export async function confirmOrderReceipt(orderId: string): Promise<{ success: boolean; message?: string }> {
  try {
    console.log(`Sending confirm receipt request for order ${orderId}...`);

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
    console.error(`Error confirming receipt for order ${orderId}:`, err);

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
    console.error('Error downloading digital product:', err);
    throw new Error(err.response?.data?.message || 'Failed to download digital product');
  }
}

export async function markOrderAsCollected(orderId: string): Promise<{ success: boolean; message?: string }> {
  try {
    console.log(`Sending mark as collected request for order ${orderId}...`);
    await buyerApiInstance.post(`/buyers/orders/${orderId}/collected`);
    return { success: true };
  } catch (error) {
    const err = error as ApiError;
    console.error(`Error marking order ${orderId} as collected:`, err);
    return {
      success: false,
      message: err.response?.data?.message || 'Failed to mark order as collected'
    };
  }
}


