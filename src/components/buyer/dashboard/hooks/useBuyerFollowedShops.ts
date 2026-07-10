import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import buyerApi from '@/api/buyer';
import { useToast } from '@/hooks/use-toast';
import {
  getShopId,
  isPhysicalShop,
  updateSellerClickCount,
  updateSellerClientCount
} from '../buyerShopUtils';

const FOLLOWED_SHOPS_QUERY_KEY = ['buyer-followed-shops'] as const;
const PUBLIC_SELLERS_QUERY_KEY = ['public-sellers'] as const;

const updatePublicSellerCache = (
  queryClient: QueryClient,
  shopId: string,
  updateSeller: (seller: any) => any
) => {
  queryClient.setQueriesData({ queryKey: PUBLIC_SELLERS_QUERY_KEY }, (current: any) => {
    if (!current?.sellers) return current;
    return {
      ...current,
      sellers: current.sellers.map((seller: any) => (
        getShopId(seller) === shopId ? updateSeller(seller) : seller
      ))
    };
  });
};

const updateFollowedShopCache = (
  queryClient: QueryClient,
  shopId: string,
  updateShop: (shop: any) => any
) => {
  queryClient.setQueryData<any[]>(FOLLOWED_SHOPS_QUERY_KEY, (current = []) =>
    current.map(item => getShopId(item) === shopId ? updateShop(item) : item)
  );
};

export function useBuyerFollowedShops(searchQuery: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [unfollowingShopId, setUnfollowingShopId] = useState<string | null>(null);

  const shopsQuery = useQuery({
    queryKey: FOLLOWED_SHOPS_QUERY_KEY,
    queryFn: () => buyerApi.getShops({ page: 1, limit: 48 }),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled
  });

  const shops = useMemo(() => shopsQuery.data || [], [shopsQuery.data]);

  const filteredShops = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return shops;

    return shops.filter((shop: any) => {
      const name = String(shop.shopName || shop.name || '').toLowerCase();
      const location = String(shop.location || shop.city || '').toLowerCase();
      return name.includes(query) || location.includes(query);
    });
  }, [shops, searchQuery]);

  const { onlineShops, physicalShops } = useMemo(() => {
    const online: any[] = [];
    const physical: any[] = [];

    filteredShops.forEach((shop: any) => {
      if (isPhysicalShop(shop)) {
        physical.push(shop);
      } else {
        online.push(shop);
      }
    });

    return { onlineShops: online, physicalShops: physical };
  }, [filteredShops]);

  const shopGroups = useMemo(() => ([
    {
      key: 'online' as const,
      title: 'Online Shops',
      count: onlineShops.length,
      shops: onlineShops,
      empty: searchQuery ? 'No online shops match your search.' : 'No online shops followed yet.'
    },
    {
      key: 'physical' as const,
      title: 'Physical Shops',
      count: physicalShops.length,
      shops: physicalShops,
      empty: searchQuery ? 'No physical shops match your search.' : 'No physical shops followed yet.'
    }
  ]), [onlineShops, physicalShops, searchQuery]);

  const unfollowShopMutation = useMutation({
    mutationFn: (shop: any) => buyerApi.leaveClient(getShopId(shop)),
    onMutate: async (shop: any) => {
      const shopId = getShopId(shop);
      setUnfollowingShopId(shopId);
      await queryClient.cancelQueries({ queryKey: FOLLOWED_SHOPS_QUERY_KEY });
      await queryClient.cancelQueries({ queryKey: PUBLIC_SELLERS_QUERY_KEY });

      const previousFollowedShops = queryClient.getQueryData<any[]>(FOLLOWED_SHOPS_QUERY_KEY);
      const previousPublicSellerQueries = queryClient.getQueriesData({ queryKey: PUBLIC_SELLERS_QUERY_KEY });

      queryClient.setQueryData<any[]>(FOLLOWED_SHOPS_QUERY_KEY, (current = []) =>
        current.filter(item => getShopId(item) !== shopId)
      );

      updatePublicSellerCache(queryClient, shopId, (seller) =>
        updateSellerClientCount(seller, Math.max(0, Number(seller.clientCount ?? seller.client_count ?? 0) - 1))
      );

      return { previousFollowedShops, previousPublicSellerQueries };
    },
    onError: (error, _shop, context) => {
      if (context?.previousFollowedShops) {
        queryClient.setQueryData(FOLLOWED_SHOPS_QUERY_KEY, context.previousFollowedShops);
      }
      context?.previousPublicSellerQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast({
        title: 'Could not unfollow shop',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive'
      });
    },
    onSuccess: (result: any, shop: any) => {
      const shopId = getShopId(shop);
      if (typeof result.clientCount === 'number') {
        updatePublicSellerCache(queryClient, shopId, (seller) =>
          updateSellerClientCount(seller, result.clientCount)
        );
      }
      toast({
        title: 'Shop unfollowed',
        description: result.message || 'The shop was removed from My Shops.'
      });
    },
    onSettled: () => {
      setUnfollowingShopId(null);
      queryClient.invalidateQueries({ queryKey: FOLLOWED_SHOPS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_SELLERS_QUERY_KEY });
    }
  });

  const handleShopClickCountChange = useCallback((shop: any, clickCount: number) => {
    const shopId = getShopId(shop);
    if (!shopId) return;

    updateFollowedShopCache(queryClient, shopId, (item) =>
      updateSellerClickCount(item, clickCount)
    );
    updatePublicSellerCache(queryClient, shopId, (seller) =>
      updateSellerClickCount(seller, clickCount)
    );
  }, [queryClient]);

  const handleUnfollowShop = useCallback((shop: any) => {
    unfollowShopMutation.mutate(shop);
  }, [unfollowShopMutation]);

  return {
    filteredShops,
    handleShopClickCountChange,
    handleUnfollowShop,
    isLoadingShops: shopsQuery.isLoading,
    shopGroups,
    shops,
    unfollowingShopId
  };
}


