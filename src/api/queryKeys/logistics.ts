export const logisticsQueryKeys = {
  all: ['logistics'] as const,
  me: () => [...logisticsQueryKeys.all, 'me'] as const,
  requests: (sort?: string) => [...logisticsQueryKeys.all, 'requests', sort || 'priority'] as const,
  publicTracking: (token: string) => [...logisticsQueryKeys.all, 'publicTracking', token] as const,
};


