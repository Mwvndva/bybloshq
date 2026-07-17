import { useQuery } from '@tanstack/react-query';
import { getMyAccounts } from '@/api/account';

/**
 * Fetches which account types (buyer / seller / ambassador) the signed-in user
 * owns. Used to decide whether to show the account switcher and which options
 * to offer. Keyed globally and cleared on login/logout/switch alongside the
 * rest of the auth cache.
 */
export function useMyAccounts(enabled = true) {
  return useQuery({
    queryKey: ['my-accounts'],
    queryFn: getMyAccounts,
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
}
