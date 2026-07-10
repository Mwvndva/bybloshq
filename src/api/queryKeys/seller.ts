export const sellerQueryKeys = {
  all: ['seller'] as const,
  profile: () => [...sellerQueryKeys.all, 'profile'] as const,
  dashboard: () => ['seller-dashboard'] as const,
  analytics: () => ['seller-dashboard', 'analytics'] as const,
  orders: () => ['seller-dashboard', 'orders'] as const,
  products: () => ['seller-dashboard', 'products'] as const,
  summary: () => ['seller-dashboard', 'summary'] as const,
  withdrawals: () => ['seller-dashboard', 'withdrawals'] as const,
  product: (id: string) => ['seller-product', id] as const,
};


