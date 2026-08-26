import apiClient from '@/infrastructure/http/apiClient';

export async function becomeClient(sellerId: string): Promise<unknown> {
  try {
    const response = await apiClient.post(`buyers/sellers/${sellerId}/become-client`);
    return response.data;
  } catch (error) {
    console.error('Error becoming client:', error);
    throw error;
  }
}


