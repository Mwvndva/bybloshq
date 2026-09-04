import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSellerCreatorsDashboard,
  updateCreatorListing,
  respondToCreatorRequest,
  type SellerCreatorsDashboardData
} from '../api/creatorsApi';

export function useSellerCreatorsQuery(enabled: boolean = true) {
  return useQuery<SellerCreatorsDashboardData>({
    queryKey: ['seller', 'creators-dashboard'],
    queryFn: () => getSellerCreatorsDashboard(),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useUpdateCreatorListingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { isCreatorMarketplaceEnabled?: boolean; creatorCommissionRate?: number }) =>
      updateCreatorListing(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'creators-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['seller-profile'] });
    },
  });
}

export function useRespondToCreatorRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, action }: { requestId: number; action: 'accept' | 'deny' }) =>
      respondToCreatorRequest(requestId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'creators-dashboard'] });
    },
  });
}
