export const buyerQueryKeys = {
  all: ['buyer'] as const,
  profile: () => [...buyerQueryKeys.all, 'profile'] as const,
  wishlist: () => [...buyerQueryKeys.all, 'wishlist'] as const,
  orders: () => [...buyerQueryKeys.all, 'orders'] as const,
  order: (id: string) => [...buyerQueryKeys.all, 'orders', id] as const,
  refunds: () => [...buyerQueryKeys.all, 'refunds'] as const,
  shops: (params?: Record<string, unknown>) => [...buyerQueryKeys.all, 'shops', params || {}] as const,
  orderStatus: (orderNumber: string) => [...buyerQueryKeys.all, 'orderStatus', orderNumber] as const,
};


