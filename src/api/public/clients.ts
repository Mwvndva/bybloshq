import { publicApi } from './instance';

export async function becomeClient(sellerId: string): Promise<unknown> {
  try {
    const response = await publicApi.post(`buyers/sellers/${sellerId}/become-client`);
    return response.data;
  } catch (error) {
    console.error('Error becoming client:', error);
    throw error;
  }
}


