import { useQuery } from '@tanstack/react-query';
import { getAvailableShops, type AvailableShop } from '../../api/marketplace';

export function useAvailableShopsQuery() {
  return useQuery<AvailableShop[]>({
    queryKey: ['creator', 'available-shops'],
    queryFn: () => getAvailableShops(),
    staleTime: 60 * 1000,
  });
}
