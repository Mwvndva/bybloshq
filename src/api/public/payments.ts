import { publicApi } from './instance';

export async function pollPaymentStatus(reference: string, maxAttempts: number = 30): Promise<unknown> {
  const attempts = 0;
  const interval = 5000;

  return new Promise((resolve, reject) => {
    let currentAttempts = attempts;
    const checkStatus = async () => {
      try {
        currentAttempts++;
        const response = await publicApi.get(`payments/status/${reference}`);
        const responseData = response.data as Record<string, unknown>;
        const status = typeof responseData.status === 'string' ? responseData.status.toLowerCase() : '';

        if (status === 'completed' || status === 'success' || status === 'failed' || status === 'cancelled') {
          resolve(response.data);
        } else if (currentAttempts >= maxAttempts) {
          resolve({ status: 'timeout', message: 'Polling timed out' });
        } else {
          setTimeout(checkStatus, interval);
        }
      } catch (error) {
        console.error('[pollPaymentStatus] Error:', error);
        if (currentAttempts >= maxAttempts) {
          reject(error);
        } else {
          setTimeout(checkStatus, interval);
        }
      }
    };

    checkStatus();
  });
}


