import apiClient from '@/infrastructure/http/apiClient';

export async function getOrderStatus(orderNumber: string, clientCheckoutToken?: string | null): Promise<unknown> {
  try {
    // Send the checkout ownership token so a verified buyer's poll can return an
    // auto-login token (backend gates it on this secret + payment success + verified).
    const url = clientCheckoutToken
      ? `/public/orders/${orderNumber}/status?client_checkout_token=${encodeURIComponent(clientCheckoutToken)}`
      : `/public/orders/${orderNumber}/status`;
    const response = await apiClient.get<unknown>(url);
    const data = response.data as Record<string, unknown>;
    return data.data;
  } catch (error) {
    console.error('Error fetching order status:', error);
    throw error;
  }
}
export async function initiateProduct(payload: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
  try {
    const response = await apiClient.post('/payments/initiate-product', payload, {
      headers: {
        'Idempotency-Key': idempotencyKey
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error initiating product:', error);
    throw error;
  }
}

export async function validateDiscountCode(payload: { code: string; order_amount: number }): Promise<unknown> {
  try {
    const response = await apiClient.post('/discount-codes/validate', payload);
    return response.data;
  } catch (error) {
    console.error('Error validating discount code:', error);
    throw error;
  }
}

export async function getPaymentStatus(reference: string): Promise<unknown> {
  try {
    const response = await apiClient.get(`/payments/status/${reference}`);
    return response.data;
  } catch (error) {
    console.error('Error getting payment status:', error);
    throw error;
  }
}

export async function getLogisticsQuote(payload: { legType: string; location: { address: string; latitude: number; longitude: number } }, signal?: AbortSignal): Promise<unknown> {
  try {
    const response = await apiClient.post('/payments/logistics-quote', payload, { signal });
    return response.data;
  } catch (error) {
    const err = error as Record<string, unknown>;
    if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
      throw error;
    }
    console.error('Error getting logistics quote:', error);
    throw error;
  }
}


