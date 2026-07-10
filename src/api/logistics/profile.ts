import apiClient from '@/lib/apiClient';
import { LogisticsPartner, logisticsHeaders } from './auth';

export async function fetchLogisticsMe() {
  const response = await apiClient.get('/logistics/me', {
    headers: logisticsHeaders(),
  });
  return response.data?.data?.partner as LogisticsPartner;
}


