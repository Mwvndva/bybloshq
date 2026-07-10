import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sellerApi } from '@/api/seller';
import { normalizeSellerAnalytics } from '../dashboardUtils';
import { sellerDashboardQueryKeys } from '../queryKeys';
import type { AnalyticsData } from '../types';

interface UseSellerDashboardDataArgs {
  navigate: (path: string, options?: import('react-router-dom').NavigateOptions) => void;
  locationPathname: string;
  toast: (options: Record<string, unknown>) => void;
}

export function useSellerDashboardData({ navigate, locationPathname, toast }: UseSellerDashboardDataArgs) {
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: sellerDashboardQueryKeys.products,
    queryFn: () => sellerApi.getProducts(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false
  });

  const analyticsQuery = useQuery({
    queryKey: sellerDashboardQueryKeys.analytics,
    queryFn: () => sellerApi.getAnalytics(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false
  });

  const handleDashboardFetchError = useCallback((err: unknown) => {
    console.error('Error fetching dashboard data:', err);

    if (err.response?.status === 401) {
      localStorage.removeItem('sellerToken');
      toast({
        title: 'Session expired',
        description: 'Please log in again to continue',
        variant: 'destructive',
      });
      navigate('/seller/login', { state: { from: locationPathname } });
      return;
    }

    toast({
      title: 'Error',
      description: err.response?.data?.message || 'Failed to load dashboard data',
      variant: 'destructive',
    });
  }, [locationPathname, navigate, toast]);

  const products = useMemo(
    () => Array.isArray(productsQuery.data) ? productsQuery.data : [],
    [productsQuery.data]
  );

  const analytics = useMemo(
    () => normalizeSellerAnalytics(products, analyticsQuery.data),
    [analyticsQuery.data, products]
  );

  const isLoading = productsQuery.isLoading || analyticsQuery.isLoading;
  const error = productsQuery.error || analyticsQuery.error
    ? 'Failed to load data. Please try again later.'
    : null;

  const fetchData = useCallback(async (): Promise<AnalyticsData> => {
    try {
      const [productsData, analyticsData] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: sellerDashboardQueryKeys.products,
          queryFn: () => sellerApi.getProducts(),
          staleTime: 0
        }),
        queryClient.fetchQuery({
          queryKey: sellerDashboardQueryKeys.analytics,
          queryFn: () => sellerApi.getAnalytics(),
          staleTime: 0
        })
      ]);

      return normalizeSellerAnalytics(
        Array.isArray(productsData) ? productsData : [],
        analyticsData
      );
    } catch (err) {
      handleDashboardFetchError(err);

      return {
        totalProducts: 0,
        totalSales: 0,
        totalRevenue: 0,
        totalPayout: 0,
        balance: 0,
        clientCount: 0,
        creatorCount: 0,
        creatorGeneratedSales: 0,
        wishlistCount: 0,
        clickCount: 0,
        monthlySales: [],
        recentOrders: []
      };
    }
  }, [handleDashboardFetchError, queryClient]);

  const fetchProducts = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: sellerDashboardQueryKeys.products });
      await queryClient.invalidateQueries({ queryKey: sellerDashboardQueryKeys.analytics });
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: 'Failed to load products. Please try again.',
        variant: 'destructive',
      });
    }
  }, [queryClient, toast]);

  return {
    analytics,
    error,
    fetchData,
    fetchProducts,
    isLoading,
    products
  };
}


