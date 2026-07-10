export const commonQueryKeys = {
  products: (filters?: Record<string, unknown>) => ['products', filters || {}] as const,
  product: (id: string) => ['product', id] as const,
  featuredProducts: (limit?: number) => ['products', 'featured', limit || 8] as const,
  productsByLocation: (location: string) => ['products', 'location', location] as const,
  sellers: (params?: Record<string, unknown>) => ['sellers', params || {}] as const,
  seller: (id: string) => ['seller', id] as const,
  searchSellers: (filters?: Record<string, unknown>) => ['sellers', 'search', filters || {}] as const,
  searchProducts: (query: string, filters?: Record<string, unknown>) => ['products', 'search', query, filters || {}] as const,
  public: {
    shop: (shopName: string) => ['seller-shop', shopName] as const,
    products: (sellerId: string | number) => ['seller-public-products', sellerId] as const,
    sellers: (params?: Record<string, unknown>) => ['public-sellers', params?.page || 1, params?.limit || 48] as const,
  }
};


