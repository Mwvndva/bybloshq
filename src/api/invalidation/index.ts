import { type QueryClient } from '@tanstack/react-query';
import { buyerQueryKeys } from '../queryKeys/buyer';
import { sellerQueryKeys } from '../queryKeys/seller';
import { adminQueryKeys } from '../queryKeys/admin';
import { logisticsQueryKeys } from '../queryKeys/logistics';
import { creatorQueryKeys } from '../queryKeys/creator';

export function invalidateBuyerQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: buyerQueryKeys.all });
}

export function invalidateWishlist(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: buyerQueryKeys.wishlist() });
}

export function invalidateSellerDashboard(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: sellerQueryKeys.dashboard() });
}

export function invalidateAdminQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
}

export function invalidateLogisticsQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: logisticsQueryKeys.all });
}

export function invalidateCreatorQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: creatorQueryKeys.all });
}


