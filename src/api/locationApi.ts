import apiClient from '@/lib/apiClient';

export interface LocationSearchResult {
  provider: string;
  id: string;
  displayName: string;
  lat: number;
  lng: number;
}

export async function searchLocations(query: string): Promise<LocationSearchResult[]> {
  const response = await apiClient.get('/locations/search', {
    params: { q: query }
  });

  return Array.isArray(response.data?.data) ? response.data.data : [];
}


